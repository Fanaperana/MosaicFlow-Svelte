// MosaicFlow Tauri Path Utilities
//
// Tauri-specific path resolution that requires AppHandle.
// Portable path types (VaultPaths, CanvasPaths, sanitize_name) live in mosaicflow_core.

use std::path::PathBuf;
use tauri::Manager;

use mosaicflow_core::{MosaicError, MosaicResult};

/// Get the app data directory
pub fn get_data_dir(app_handle: &tauri::AppHandle) -> MosaicResult<PathBuf> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| MosaicError::io_error(e))?;

    let data_dir = config_dir.join("data");
    mosaicflow_core::ensure_dir(&data_dir)?;

    Ok(data_dir)
}

/// Get the app config file path
pub fn get_config_path(app_handle: &tauri::AppHandle) -> MosaicResult<PathBuf> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| MosaicError::io_error(e))?;

    mosaicflow_core::ensure_dir(&config_dir)?;
    Ok(config_dir.join("config.json"))
}

/// Get the plugins directory
pub fn get_plugins_dir(app_handle: &tauri::AppHandle) -> MosaicResult<PathBuf> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| MosaicError::io_error(e))?;

    let plugins_dir = config_dir.join("plugins");
    mosaicflow_core::ensure_dir(&plugins_dir)?;

    Ok(plugins_dir)
}
