// State Commands
//
// Tauri command handlers for app state operations

use crate::events::EventEmitter;
use crate::models::AppState;
use crate::services::StateService;
use tauri::AppHandle;

/// Load app state
#[tauri::command]
pub async fn load_app_state(app_handle: AppHandle) -> Result<AppState, String> {
    StateService::load(&app_handle).map_err(|e| e.to_string())
}

/// Save app state
#[tauri::command]
pub async fn save_app_state(app_handle: AppHandle, state: AppState) -> Result<(), String> {
    StateService::save(&app_handle, &state).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.state_changed(state.last_vault_id, state.last_canvas_id);

    Ok(())
}

/// Update last opened vault/canvas
#[tauri::command]
pub async fn update_last_opened(
    app_handle: AppHandle,
    vault_id: Option<String>,
    canvas_id: Option<String>,
) -> Result<(), String> {
    StateService::update_last_opened(&app_handle, vault_id.clone(), canvas_id.clone())
        .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.state_changed(vault_id, canvas_id);

    Ok(())
}
