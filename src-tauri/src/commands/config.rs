// Config Commands
//
// Tauri command handlers for app configuration operations

use tauri::AppHandle;
use crate::models::AppConfig;
use crate::services::ConfigService;

/// Load app configuration
#[tauri::command]
pub async fn load_app_config(app_handle: AppHandle) -> Result<AppConfig, String> {
    ConfigService::load(&app_handle)
        .map_err(|e| e.to_string())
}

/// Save app configuration
#[tauri::command]
pub async fn save_app_config(
    app_handle: AppHandle,
    config: AppConfig,
) -> Result<bool, String> {
    ConfigService::save(&app_handle, &config)
        .map(|_| true)
        .map_err(|e| e.to_string())
}
