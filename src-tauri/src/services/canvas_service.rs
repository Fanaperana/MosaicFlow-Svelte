// Canvas Service
//
// Handles all canvas-related operations

use crate::core::{self, CanvasPaths, MosaicError, MosaicResult, VaultPaths};
use crate::models::{CanvasFile, CanvasInfo, CanvasUIState};
use crate::services::MigrationService;
use std::path::{Path, PathBuf};

pub struct CanvasService;

impl CanvasService {
    /// Create a new canvas in a vault
    pub fn create(
        canvases_dir: &Path,
        vault_id: &str,
        name: &str,
        description: Option<&str>,
    ) -> MosaicResult<CanvasInfo> {
        // Generate folder name
        let folder_name = core::sanitize_name(name);
        let canvas_path = canvases_dir.join(&folder_name);

        // Handle name collision
        let final_path = if canvas_path.exists() {
            let mut counter = 1;
            loop {
                let new_name = format!("{}_{}", folder_name, counter);
                let new_path = canvases_dir.join(&new_name);
                if !new_path.exists() {
                    break new_path;
                }
                counter += 1;
            }
        } else {
            canvas_path
        };

        let canvas_paths = CanvasPaths::from_root(&final_path);

        // Create directory structure
        canvas_paths.create_all()?;

        let mut file = CanvasFile::new(
            core::generate_uuid(),
            vault_id.to_string(),
            name.to_string(),
        );
        if let Some(desc) = description {
            file.description = desc.to_string();
        }
        core::write_json(&canvas_paths.canvas_json, &file)?;

        Ok(CanvasInfo::from_file(
            &file,
            final_path.to_string_lossy().to_string(),
        ))
    }

    /// Open a canvas, migrating v1/v2 canvases to v3 first
    pub fn open(path: &Path) -> MosaicResult<CanvasInfo> {
        let file = Self::read_file(path)?;
        Ok(CanvasInfo::from_file(
            &file,
            path.to_string_lossy().to_string(),
        ))
    }

    /// Reads canvas.json, migrating older formats on the way.
    fn read_file(path: &Path) -> MosaicResult<CanvasFile> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());

        if canvas_paths.is_valid_v3() {
            return core::read_json(&canvas_paths.canvas_json);
        }
        if !canvas_paths.is_valid_v2() {
            if !canvas_paths.is_valid_v1() {
                return Err(MosaicError::canvas_not_found(&path.to_string_lossy()));
            }
            MigrationService::migrate_canvas(path)?;
        }
        MigrationService::migrate_v2_to_v3(path)?;
        core::read_json(&canvas_paths.canvas_json)
    }

    fn write_file(path: &Path, file: &CanvasFile) -> MosaicResult<()> {
        core::write_json(
            &CanvasPaths::from_root(&path.to_path_buf()).canvas_json,
            file,
        )
    }

    /// List all canvases in a directory
    pub fn list(canvases_dir: &Path) -> MosaicResult<Vec<CanvasInfo>> {
        let subdirs = core::list_subdirs(canvases_dir)?;

        let mut canvases = Vec::new();
        for dir in subdirs {
            if let Ok(info) = Self::open(&dir) {
                canvases.push(info);
            }
        }

        // Sort by updated_at descending
        canvases.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(canvases)
    }

    /// Rename a canvas
    pub fn rename(path: &Path, new_name: &str) -> MosaicResult<CanvasInfo> {
        let mut file = Self::read_file(path)?;
        file.name = new_name.to_string();
        file.touch();
        Self::write_file(path, &file)?;

        // Optionally rename folder
        let new_folder_name = core::sanitize_name(new_name);
        let parent = path
            .parent()
            .ok_or_else(|| MosaicError::io_error("Cannot get parent"))?;
        let new_path = parent.join(&new_folder_name);

        let final_path = if new_path != path && !new_path.exists() {
            core::rename(path, &new_path)?;
            new_path
        } else {
            path.to_path_buf()
        };

        Ok(CanvasInfo::from_file(
            &file,
            final_path.to_string_lossy().to_string(),
        ))
    }

    /// Delete a canvas
    pub fn delete(path: &Path) -> MosaicResult<Option<String>> {
        // Try to get canvas ID before deletion (for history and state cleanup)
        let canvas_id = Self::get_canvas_id(path);

        core::remove_dir_all(path)?;
        if let Some(state) = Self::state_path(path, canvas_id.as_deref()) {
            let _ = std::fs::remove_file(state);
        }

        Ok(canvas_id)
    }

    /// Update canvas tags
    pub fn update_tags(path: &Path, tags: Vec<String>) -> MosaicResult<CanvasInfo> {
        let mut file = Self::read_file(path)?;
        file.tags = tags;
        file.touch();
        Self::write_file(path, &file)?;
        Ok(CanvasInfo::from_file(
            &file,
            path.to_string_lossy().to_string(),
        ))
    }

    /// Update canvas description
    pub fn update_description(path: &Path, description: &str) -> MosaicResult<CanvasInfo> {
        let mut file = Self::read_file(path)?;
        file.description = description.to_string();
        file.touch();
        Self::write_file(path, &file)?;
        Ok(CanvasInfo::from_file(
            &file,
            path.to_string_lossy().to_string(),
        ))
    }

    /// <vault>/.mosaicflow/state/<canvas id>.json for a canvas at <vault>/canvases/<folder>
    fn state_path(path: &Path, canvas_id: Option<&str>) -> Option<PathBuf> {
        let id = canvas_id?;
        // The id comes from a file in the vault; never let it name a path outside state/.
        if id.is_empty()
            || !id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return None;
        }
        let vault_root = path.parent()?.parent()?.to_path_buf();
        Some(VaultPaths::from_root(&vault_root).canvas_state(id))
    }

    /// Load canvas UI state
    pub fn load_state(path: &Path) -> MosaicResult<CanvasUIState> {
        let id = Self::read_file(path)?.id;
        match Self::state_path(path, Some(&id)) {
            Some(state) if state.exists() => core::read_json(&state),
            _ => Ok(CanvasUIState::default()),
        }
    }

    /// Save canvas UI state
    pub fn save_state(path: &Path, state: &CanvasUIState) -> MosaicResult<()> {
        let id = Self::read_file(path)?.id;
        let target = Self::state_path(path, Some(&id))
            .ok_or_else(|| MosaicError::io_error("Canvas is not inside a vault"))?;

        let mut state = state.clone();
        state.touch();

        core::write_json(&target, &state)
    }

    /// Get canvas ID from canvas.json (older formats are migrated first)
    fn get_canvas_id(path: &Path) -> Option<String> {
        Self::read_file(path).ok().map(|f| f.id)
    }
}
