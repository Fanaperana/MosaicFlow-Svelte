// Vault Commands
//
// Tauri command handlers for vault operations

use crate::events::EventEmitter;
use crate::models::VaultInfo;
use crate::services::{HistoryService, StateService, VaultService};
use std::path::Path;
use tauri::AppHandle;

/// Create a new vault
#[tauri::command]
pub async fn create_vault(
    app_handle: AppHandle,
    path: String,
    name: String,
    description: Option<String>,
) -> Result<VaultInfo, String> {
    let vault_path = Path::new(&path);

    let vault = VaultService::create(vault_path, &name, description.as_deref())
        .map_err(|e| e.to_string())?;

    // Track in history
    HistoryService::track_vault(
        &app_handle,
        vault.id.clone(),
        vault.name.clone(),
        vault.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Update state
    StateService::update_last_opened(&app_handle, Some(vault.id.clone()), None)
        .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.vault_created(&vault.id, &vault.path, &vault.name);

    Ok(vault)
}

/// Open an existing vault
#[tauri::command]
pub async fn open_vault(app_handle: AppHandle, path: String) -> Result<VaultInfo, String> {
    let vault_path = Path::new(&path);

    let vault = VaultService::open(vault_path).map_err(|e| e.to_string())?;

    // Track in history
    HistoryService::track_vault(
        &app_handle,
        vault.id.clone(),
        vault.name.clone(),
        vault.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Update state
    StateService::update_last_opened(&app_handle, Some(vault.id.clone()), None)
        .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.vault_opened(&vault.id, &vault.path, &vault.name);

    Ok(vault)
}

/// Rename a vault
#[tauri::command]
pub async fn rename_vault(
    app_handle: AppHandle,
    vault_path: String,
    new_name: String,
) -> Result<VaultInfo, String> {
    let path = Path::new(&vault_path);

    let vault = VaultService::rename(path, &new_name).map_err(|e| e.to_string())?;

    // Update history
    HistoryService::track_vault(
        &app_handle,
        vault.id.clone(),
        vault.name.clone(),
        vault.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.vault_updated(&vault.id, &vault.path, &vault.name);

    Ok(vault)
}

/// Update vault description
#[tauri::command]
pub async fn update_vault_description(
    app_handle: AppHandle,
    vault_path: String,
    description: String,
) -> Result<VaultInfo, String> {
    let path = Path::new(&vault_path);

    let vault = VaultService::update_description(path, &description).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.vault_updated(&vault.id, &vault.path, &vault.name);

    Ok(vault)
}

/// Check if path is a valid vault
#[tauri::command]
pub async fn is_valid_vault(path: String) -> Result<bool, String> {
    Ok(VaultService::is_valid(Path::new(&path)))
}

/// Get vault info without opening
#[tauri::command]
pub async fn get_vault_info(path: String) -> Result<Option<VaultInfo>, String> {
    VaultService::get_info(Path::new(&path)).map_err(|e| e.to_string())
}
