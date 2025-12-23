// Vault Service
//
// Handles all vault-related operations

use crate::core::{self, paths::VaultPaths, MosaicError, MosaicResult};
use crate::models::{CanvasInfo, VaultInfo, VaultMeta};
use crate::services::CanvasService;
use std::path::Path;

pub struct VaultService;

impl VaultService {
    /// Create a new vault at the specified path
    pub fn create(path: &Path, name: &str, description: Option<&str>) -> MosaicResult<VaultInfo> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        // Check if already exists
        if vault_paths.is_valid() {
            return Err(MosaicError::already_exists("Vault"));
        }

        // Create directory structure
        vault_paths.create_all()?;

        // Create vault metadata
        let vault_id = core::generate_uuid();
        let mut meta = VaultMeta::new(vault_id.clone(), name.to_string());
        if let Some(desc) = description {
            meta = meta.with_description(desc.to_string());
        }

        // Write vault.json
        core::write_json(&vault_paths.vault_json, &meta)?;

        // Create default canvas
        let _canvas = CanvasService::create(&vault_paths.canvases, &vault_id, "Untitled", None)?;

        Ok(VaultInfo {
            id: vault_id,
            path: path.to_string_lossy().to_string(),
            name: name.to_string(),
            description: description.unwrap_or("").to_string(),
            created_at: meta.created_at,
            updated_at: meta.updated_at,
            canvas_count: 1,
        })
    }

    /// Open an existing vault
    pub fn open(path: &Path) -> MosaicResult<VaultInfo> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if !vault_paths.is_valid() {
            return Err(MosaicError::vault_not_found(&path.to_string_lossy()));
        }

        // Read vault metadata
        let meta: VaultMeta = core::read_json(&vault_paths.vault_json)?;

        // Count canvases
        let canvas_count = Self::count_canvases(&vault_paths.canvases);

        Ok(VaultInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
            canvas_count,
        ))
    }

    /// Rename a vault
    pub fn rename(path: &Path, new_name: &str) -> MosaicResult<VaultInfo> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if !vault_paths.is_valid() {
            return Err(MosaicError::vault_not_found(&path.to_string_lossy()));
        }

        // Read and update metadata
        let mut meta: VaultMeta = core::read_json(&vault_paths.vault_json)?;
        meta.name = new_name.to_string();
        meta.touch();

        // Write back
        core::write_json(&vault_paths.vault_json, &meta)?;

        let canvas_count = Self::count_canvases(&vault_paths.canvases);

        Ok(VaultInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
            canvas_count,
        ))
    }

    /// Update vault description
    pub fn update_description(path: &Path, description: &str) -> MosaicResult<VaultInfo> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if !vault_paths.is_valid() {
            return Err(MosaicError::vault_not_found(&path.to_string_lossy()));
        }

        let mut meta: VaultMeta = core::read_json(&vault_paths.vault_json)?;
        meta.description = description.to_string();
        meta.touch();

        core::write_json(&vault_paths.vault_json, &meta)?;

        let canvas_count = Self::count_canvases(&vault_paths.canvases);

        Ok(VaultInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
            canvas_count,
        ))
    }

    /// Check if path is a valid vault
    pub fn is_valid(path: &Path) -> bool {
        VaultPaths::from_root(&path.to_path_buf()).is_valid()
    }

    /// Get vault info without opening
    pub fn get_info(path: &Path) -> MosaicResult<Option<VaultInfo>> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if !vault_paths.is_valid() {
            return Ok(None);
        }

        let meta: VaultMeta = core::read_json(&vault_paths.vault_json)?;
        let canvas_count = Self::count_canvases(&vault_paths.canvases);

        Ok(Some(VaultInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
            canvas_count,
        )))
    }

    /// List all canvases in a vault
    pub fn list_canvases(path: &Path) -> MosaicResult<Vec<CanvasInfo>> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());
        CanvasService::list(&vault_paths.canvases)
    }

    /// Get vault ID from vault.json
    pub fn get_vault_id(path: &Path) -> MosaicResult<Option<String>> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if !vault_paths.is_valid() {
            return Ok(None);
        }

        let meta: VaultMeta = core::read_json(&vault_paths.vault_json)?;
        Ok(Some(meta.id))
    }

    /// Count canvases in vault
    fn count_canvases(canvases_dir: &Path) -> usize {
        core::list_subdirs(canvases_dir)
            .map(|dirs| dirs.len())
            .unwrap_or(0)
    }
}
