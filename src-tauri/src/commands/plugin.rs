// Plugin Commands
//
// Tauri commands for plugin discovery and management

use tauri::AppHandle;

use crate::services::PluginService;
use crate::services::plugin_service::DiscoveredPlugin;

/// Get the plugins directory path
#[tauri::command]
pub fn get_plugins_dir(app_handle: AppHandle) -> Result<String, String> {
    PluginService::get_plugins_path(&app_handle)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Discover all external plugins
#[tauri::command]
pub fn discover_plugins(app_handle: AppHandle) -> Result<Vec<DiscoveredPlugin>, String> {
    PluginService::discover_plugins(&app_handle)
        .map_err(|e| e.to_string())
}

/// Read a plugin's main module content (for dynamic loading)
#[tauri::command]
pub fn read_plugin_module(app_handle: AppHandle, plugin_id: String) -> Result<String, String> {
    PluginService::read_plugin_module(&app_handle, &plugin_id)
        .map_err(|e| e.to_string())
}
