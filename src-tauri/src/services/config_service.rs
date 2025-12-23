// Config Service
//
// Handles app-level configuration persistence

use crate::core::{self, paths::get_config_path, MosaicResult};
use crate::models::AppConfig;
use tauri::AppHandle;

pub struct ConfigService;

impl ConfigService {
    /// Load app configuration from disk
    pub fn load(app_handle: &AppHandle) -> MosaicResult<AppConfig> {
        let path = get_config_path(app_handle)?;

        if path.exists() {
            core::read_json(&path)
        } else {
            Ok(AppConfig::new())
        }
    }

    /// Save app configuration to disk
    pub fn save(app_handle: &AppHandle, config: &AppConfig) -> MosaicResult<()> {
        let path = get_config_path(app_handle)?;
        core::write_json(&path, config)
    }
}
