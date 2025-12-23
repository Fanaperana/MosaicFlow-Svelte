// Migration Service
//
// Handles migration of old data formats to new versions

use crate::core::{
    self,
    paths::{CanvasPaths, VaultPaths},
    MosaicError, MosaicResult,
};
use crate::models::{CanvasInfo, CanvasMeta, CanvasUIState, VaultInfo, VaultMeta};
use std::path::Path;

pub struct MigrationService;

impl MigrationService {
    /// Migrate vault from v1 to v2 format
    pub fn migrate_vault(path: &Path) -> MosaicResult<VaultInfo> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if !vault_paths.vault_json.exists() {
            return Err(MosaicError::vault_not_found(&path.to_string_lossy()));
        }

        // Read as generic JSON
        let content = core::read_string(&vault_paths.vault_json)?;
        let mut json: serde_json::Value = serde_json::from_str(&content)?;

        let now = core::now_iso();

        // Add ID if missing
        if json.get("id").is_none() {
            json["id"] = serde_json::Value::String(core::generate_uuid());
        }

        // Add description if missing
        if json.get("description").is_none() {
            json["description"] = serde_json::Value::String(String::new());
        }

        // Update version
        json["version"] = serde_json::Value::String("2.0.0".to_string());
        json["updated_at"] = serde_json::Value::String(now);

        // Write back
        let updated_content = serde_json::to_string_pretty(&json)?;
        core::write_string(&vault_paths.vault_json, &updated_content)?;

        // Parse as VaultMeta
        let meta: VaultMeta = serde_json::from_str(&updated_content)?;
        let canvas_count = core::list_subdirs(&vault_paths.canvases)
            .map(|dirs| dirs.len())
            .unwrap_or(0);

        Ok(VaultInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
            canvas_count,
        ))
    }

    /// Migrate canvas from v1 to v2 format
    pub fn migrate_canvas(path: &Path) -> MosaicResult<CanvasInfo> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        let old_canvas_json = path.join("canvas.json");

        // Create .mosaic directory
        core::ensure_dir(&canvas_paths.mosaic)?;

        let now = core::now_iso();

        // Read old format if exists
        let (canvas_id, vault_id, name, _created_at, _updated_at) = if old_canvas_json.exists() {
            let content = core::read_string(&old_canvas_json)?;
            let json: serde_json::Value = serde_json::from_str(&content)?;

            let id = json
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(core::generate_uuid);

            let name = json
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Untitled".to_string());

            let created = json
                .get("created_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| now.clone());

            let updated = json
                .get("updated_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| now.clone());

            // Try to get vault_id from parent vault
            let vault_id =
                Self::get_vault_id_from_canvas_path(path).unwrap_or_else(core::generate_uuid);

            (id, vault_id, name, created, updated)
        } else {
            (
                core::generate_uuid(),
                Self::get_vault_id_from_canvas_path(path).unwrap_or_else(core::generate_uuid),
                path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Untitled")
                    .to_string(),
                now.clone(),
                now.clone(),
            )
        };

        // Create meta.json
        let meta = CanvasMeta::new(canvas_id, vault_id, name);
        core::write_json(&canvas_paths.meta_json, &meta)?;

        // Create state.json if not exists
        if !canvas_paths.state_json.exists() {
            let state = CanvasUIState::default();
            core::write_json(&canvas_paths.state_json, &state)?;
        }

        Ok(CanvasInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
        ))
    }

    /// Get vault ID from canvas path by reading parent vault.json
    fn get_vault_id_from_canvas_path(canvas_path: &Path) -> Option<String> {
        // canvas_path is like /path/to/vault/canvases/MyCanvas
        let vault_path = canvas_path.parent()?.parent()?;
        let vault_json = vault_path.join("vault.json");

        if vault_json.exists() {
            let content = core::read_string(&vault_json).ok()?;
            let json: serde_json::Value = serde_json::from_str(&content).ok()?;
            json.get("id")?.as_str().map(|s| s.to_string())
        } else {
            None
        }
    }

    /// Check if vault needs migration
    pub fn vault_needs_migration(path: &Path) -> bool {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if let Ok(content) = core::read_string(&vault_paths.vault_json) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                return json.get("id").is_none()
                    || json.get("version").and_then(|v| v.as_str()) != Some("2.0.0");
            }
        }

        true
    }

    /// Check if canvas needs migration
    pub fn canvas_needs_migration(path: &Path) -> bool {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        !canvas_paths.is_valid_v2() && canvas_paths.is_valid_v1()
    }
}
