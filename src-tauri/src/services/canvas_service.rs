// Canvas Service
//
// Handles all canvas-related operations

use std::path::Path;
use crate::core::{self, MosaicResult, MosaicError, paths::CanvasPaths};
use crate::models::{CanvasMeta, CanvasInfo, CanvasUIState, WorkspaceData};
use crate::services::MigrationService;

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
        
        // Create canvas metadata
        let canvas_id = core::generate_uuid();
        let mut meta = CanvasMeta::new(canvas_id.clone(), vault_id.to_string(), name.to_string());
        if let Some(desc) = description {
            meta = meta.with_description(desc.to_string());
        }
        
        // Write meta.json
        core::write_json(&canvas_paths.meta_json, &meta)?;
        
        // Create initial UI state
        let state = CanvasUIState::default();
        core::write_json(&canvas_paths.state_json, &state)?;
        
        // Create empty workspace
        let workspace = WorkspaceData::new();
        core::write_json(&canvas_paths.workspace_json, &workspace)?;
        
        Ok(CanvasInfo::from_meta(&meta, final_path.to_string_lossy().to_string()))
    }

    /// Open a canvas (with auto-migration from v1)
    pub fn open(path: &Path) -> MosaicResult<CanvasInfo> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        
        // Check v2 format first
        if canvas_paths.is_valid_v2() {
            let meta: CanvasMeta = core::read_json(&canvas_paths.meta_json)?;
            return Ok(CanvasInfo::from_meta(&meta, path.to_string_lossy().to_string()));
        }
        
        // Try v1 format and migrate
        if canvas_paths.is_valid_v1() {
            return MigrationService::migrate_canvas(path);
        }
        
        Err(MosaicError::canvas_not_found(&path.to_string_lossy()))
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
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        
        // Ensure v2 format (auto-migrate if needed)
        let _info = Self::open(path)?;
        
        // Read and update metadata
        let mut meta: CanvasMeta = core::read_json(&canvas_paths.meta_json)?;
        meta.name = new_name.to_string();
        meta.touch();
        
        // Write back
        core::write_json(&canvas_paths.meta_json, &meta)?;
        
        // Optionally rename folder
        let new_folder_name = core::sanitize_name(new_name);
        let parent = path.parent().ok_or_else(|| MosaicError::io_error("Cannot get parent"))?;
        let new_path = parent.join(&new_folder_name);
        
        let final_path = if new_path != path && !new_path.exists() {
            core::rename(path, &new_path)?;
            new_path
        } else {
            path.to_path_buf()
        };
        
        Ok(CanvasInfo::from_meta(&meta, final_path.to_string_lossy().to_string()))
    }

    /// Delete a canvas
    pub fn delete(path: &Path) -> MosaicResult<Option<String>> {
        // Try to get canvas ID before deletion (for history cleanup)
        let canvas_id = Self::get_canvas_id(path);
        
        core::remove_dir_all(path)?;
        
        Ok(canvas_id)
    }

    /// Update canvas tags
    pub fn update_tags(path: &Path, tags: Vec<String>) -> MosaicResult<CanvasInfo> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        
        if !canvas_paths.is_valid_v2() {
            return Err(MosaicError::canvas_not_found(&path.to_string_lossy()));
        }
        
        let mut meta: CanvasMeta = core::read_json(&canvas_paths.meta_json)?;
        meta.tags = tags;
        meta.touch();
        
        core::write_json(&canvas_paths.meta_json, &meta)?;
        
        Ok(CanvasInfo::from_meta(&meta, path.to_string_lossy().to_string()))
    }

    /// Update canvas description
    pub fn update_description(path: &Path, description: &str) -> MosaicResult<CanvasInfo> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        
        if !canvas_paths.is_valid_v2() {
            return Err(MosaicError::canvas_not_found(&path.to_string_lossy()));
        }
        
        let mut meta: CanvasMeta = core::read_json(&canvas_paths.meta_json)?;
        meta.description = description.to_string();
        meta.touch();
        
        core::write_json(&canvas_paths.meta_json, &meta)?;
        
        Ok(CanvasInfo::from_meta(&meta, path.to_string_lossy().to_string()))
    }

    /// Load canvas UI state
    pub fn load_state(path: &Path) -> MosaicResult<CanvasUIState> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        
        if canvas_paths.state_json.exists() {
            core::read_json(&canvas_paths.state_json)
        } else {
            Ok(CanvasUIState::default())
        }
    }

    /// Save canvas UI state
    pub fn save_state(path: &Path, state: &CanvasUIState) -> MosaicResult<()> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        core::ensure_dir(&canvas_paths.mosaic)?;
        
        let mut state = state.clone();
        state.touch();
        
        core::write_json(&canvas_paths.state_json, &state)
    }

    /// Get canvas ID from meta.json
    fn get_canvas_id(path: &Path) -> Option<String> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        
        if canvas_paths.is_valid_v2() {
            core::read_json::<CanvasMeta>(&canvas_paths.meta_json)
                .ok()
                .map(|m| m.id)
        } else {
            None
        }
    }
}
