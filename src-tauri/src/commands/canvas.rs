// Canvas Commands
//
// Tauri command handlers for canvas operations

use crate::events::EventEmitter;
use crate::models::{CanvasInfo, CanvasUIState};
use crate::services::{CanvasService, HistoryService, StateService, VaultService};
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

/// Create a new canvas in a vault
#[tauri::command]
pub async fn create_canvas(
    app_handle: AppHandle,
    vault_path: String,
    vault_id: String,
    name: String,
    description: Option<String>,
) -> Result<CanvasInfo, String> {
    let vault = Path::new(&vault_path);
    let canvases_dir = vault.join("canvases");

    let canvas = CanvasService::create(&canvases_dir, &vault_id, &name, description.as_deref())
        .map_err(|e| e.to_string())?;

    // Allow canvas directory in fs scope for state persistence (recursive includes .mosaic and all subdirs)
    let canvas_path = Path::new(&canvas.path);
    let _ = app_handle.fs_scope().allow_directory(canvas_path, true);

    // Track in history
    HistoryService::track_canvas(
        &app_handle,
        canvas.id.clone(),
        canvas.vault_id.clone(),
        canvas.name.clone(),
        canvas.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Update state
    StateService::update_last_opened(&app_handle, None, Some(canvas.id.clone()))
        .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_created(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);

    Ok(canvas)
}

/// Open a canvas
#[tauri::command]
pub async fn open_canvas(app_handle: AppHandle, canvas_path: String) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas = CanvasService::open(path).map_err(|e| e.to_string())?;

    // Allow canvas directory in fs scope for state persistence (recursive includes .mosaic and all subdirs)
    let _ = app_handle.fs_scope().allow_directory(path, true);

    // Track in history
    HistoryService::track_canvas(
        &app_handle,
        canvas.id.clone(),
        canvas.vault_id.clone(),
        canvas.name.clone(),
        canvas.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Update state
    StateService::update_last_opened(&app_handle, None, Some(canvas.id.clone()))
        .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_opened(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);

    Ok(canvas)
}

/// List all canvases in a vault
#[tauri::command]
pub async fn list_canvases(vault_path: String) -> Result<Vec<CanvasInfo>, String> {
    VaultService::list_canvases(Path::new(&vault_path)).map_err(|e| e.to_string())
}

/// Rename a canvas
#[tauri::command]
pub async fn rename_canvas(
    app_handle: AppHandle,
    canvas_path: String,
    new_name: String,
) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas = CanvasService::rename(path, &new_name).map_err(|e| e.to_string())?;

    // Update history
    HistoryService::track_canvas(
        &app_handle,
        canvas.id.clone(),
        canvas.vault_id.clone(),
        canvas.name.clone(),
        canvas.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_updated(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);

    Ok(canvas)
}

/// Delete a canvas
#[tauri::command]
pub async fn delete_canvas(app_handle: AppHandle, canvas_path: String) -> Result<(), String> {
    let path = Path::new(&canvas_path);

    // Get canvas info before deletion
    let canvas = CanvasService::open(path).ok();

    // Delete the canvas
    let canvas_id = CanvasService::delete(path).map_err(|e| e.to_string())?;

    // Remove from history
    if let Some(id) = canvas_id.as_ref() {
        let _ = HistoryService::remove_canvas(&app_handle, id);
    }

    // Emit event
    if let Some(c) = canvas {
        let emitter = EventEmitter::new(&app_handle);
        emitter.canvas_deleted(&c.id, &c.vault_id);
    }

    Ok(())
}

/// Update canvas tags
#[tauri::command]
pub async fn update_canvas_tags(
    app_handle: AppHandle,
    canvas_path: String,
    tags: Vec<String>,
) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas = CanvasService::update_tags(path, tags).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_updated(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);

    Ok(canvas)
}

/// Update canvas description
#[tauri::command]
pub async fn update_canvas_description(
    app_handle: AppHandle,
    canvas_path: String,
    description: String,
) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas =
        CanvasService::update_description(path, &description).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_updated(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);

    Ok(canvas)
}

/// Load canvas UI state
#[tauri::command]
pub async fn load_canvas_state(canvas_path: String) -> Result<CanvasUIState, String> {
    CanvasService::load_state(Path::new(&canvas_path)).map_err(|e| e.to_string())
}

/// Save canvas UI state
#[tauri::command]
pub async fn save_canvas_state(canvas_path: String, state: CanvasUIState) -> Result<(), String> {
    CanvasService::save_state(Path::new(&canvas_path), &state).map_err(|e| e.to_string())
}
