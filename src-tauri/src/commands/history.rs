// History Commands
//
// Tauri command handlers for history operations

use crate::events::EventEmitter;
use crate::models::{AppHistory, CanvasHistoryEntry, VaultHistoryEntry};
use crate::services::HistoryService;
use tauri::AppHandle;

/// Load history
#[tauri::command]
pub async fn load_history(app_handle: AppHandle) -> Result<AppHistory, String> {
    HistoryService::load(&app_handle).map_err(|e| e.to_string())
}

/// Track vault open
#[tauri::command]
pub async fn track_vault_open(
    app_handle: AppHandle,
    id: String,
    name: String,
    path: String,
) -> Result<(), String> {
    HistoryService::track_vault(&app_handle, id, name, path).map_err(|e| e.to_string())?;

    // Emit event
    let history = HistoryService::load(&app_handle).map_err(|e| e.to_string())?;
    let emitter = EventEmitter::new(&app_handle);
    emitter.history_changed(history.vaults.len(), history.canvases.len());

    Ok(())
}

/// Track canvas open
#[tauri::command]
pub async fn track_canvas_open(
    app_handle: AppHandle,
    id: String,
    vault_id: String,
    name: String,
    path: String,
) -> Result<(), String> {
    HistoryService::track_canvas(&app_handle, id, vault_id, name, path)
        .map_err(|e| e.to_string())?;

    // Emit event
    let history = HistoryService::load(&app_handle).map_err(|e| e.to_string())?;
    let emitter = EventEmitter::new(&app_handle);
    emitter.history_changed(history.vaults.len(), history.canvases.len());

    Ok(())
}

/// Remove vault from history
#[tauri::command]
pub async fn remove_vault_from_history(
    app_handle: AppHandle,
    vault_id: String,
) -> Result<(), String> {
    HistoryService::remove_vault(&app_handle, &vault_id).map_err(|e| e.to_string())?;

    // Emit event
    let history = HistoryService::load(&app_handle).map_err(|e| e.to_string())?;
    let emitter = EventEmitter::new(&app_handle);
    emitter.history_changed(history.vaults.len(), history.canvases.len());

    Ok(())
}

/// Remove canvas from history
#[tauri::command]
pub async fn remove_canvas_from_history(
    app_handle: AppHandle,
    canvas_id: String,
) -> Result<(), String> {
    HistoryService::remove_canvas(&app_handle, &canvas_id).map_err(|e| e.to_string())?;

    // Emit event
    let history = HistoryService::load(&app_handle).map_err(|e| e.to_string())?;
    let emitter = EventEmitter::new(&app_handle);
    emitter.history_changed(history.vaults.len(), history.canvases.len());

    Ok(())
}

/// Get recent vaults
#[tauri::command]
pub async fn get_recent_vaults(
    app_handle: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<VaultHistoryEntry>, String> {
    HistoryService::get_recent_vaults(&app_handle, limit.unwrap_or(10)).map_err(|e| e.to_string())
}

/// Get recent canvases
#[tauri::command]
pub async fn get_recent_canvases(
    app_handle: AppHandle,
    vault_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<CanvasHistoryEntry>, String> {
    HistoryService::get_recent_canvases(&app_handle, vault_id.as_deref(), limit.unwrap_or(10))
        .map_err(|e| e.to_string())
}

/// Find vault by ID
#[tauri::command]
pub async fn find_vault_by_id(
    app_handle: AppHandle,
    vault_id: String,
) -> Result<Option<VaultHistoryEntry>, String> {
    HistoryService::find_vault(&app_handle, &vault_id).map_err(|e| e.to_string())
}

/// Find canvas by ID
#[tauri::command]
pub async fn find_canvas_by_id(
    app_handle: AppHandle,
    canvas_id: String,
) -> Result<Option<CanvasHistoryEntry>, String> {
    HistoryService::find_canvas(&app_handle, &canvas_id).map_err(|e| e.to_string())
}
