// State Service
//
// Handles app-level state persistence

use crate::core::{self, paths::get_data_dir, MosaicResult};
use crate::models::AppState;
use std::path::PathBuf;
use tauri::AppHandle;

pub struct StateService;

impl StateService {
    /// Get state file path
    fn state_path(app_handle: &AppHandle) -> MosaicResult<PathBuf> {
        let data_dir = get_data_dir(app_handle)?;
        Ok(data_dir.join("data.json"))
    }

    /// Load app state from disk
    pub fn load(app_handle: &AppHandle) -> MosaicResult<AppState> {
        let path = Self::state_path(app_handle)?;

        if path.exists() {
            core::read_json(&path)
        } else {
            Ok(AppState::new())
        }
    }

    /// Save app state to disk
    pub fn save(app_handle: &AppHandle, state: &AppState) -> MosaicResult<()> {
        let path = Self::state_path(app_handle)?;
        core::write_json(&path, state)
    }

    /// Update last opened vault/canvas
    pub fn update_last_opened(
        app_handle: &AppHandle,
        vault_id: Option<String>,
        canvas_id: Option<String>,
    ) -> MosaicResult<()> {
        let mut state = Self::load(app_handle)?;
        state.set_last_opened(vault_id, canvas_id);
        Self::save(app_handle, &state)
    }

    /// Set last vault
    pub fn set_last_vault(app_handle: &AppHandle, vault_id: String) -> MosaicResult<()> {
        let mut state = Self::load(app_handle)?;
        state.set_last_vault(vault_id);
        Self::save(app_handle, &state)
    }

    /// Set last canvas
    pub fn set_last_canvas(app_handle: &AppHandle, canvas_id: String) -> MosaicResult<()> {
        let mut state = Self::load(app_handle)?;
        state.set_last_canvas(canvas_id);
        Self::save(app_handle, &state)
    }

    /// Get last vault ID
    pub fn get_last_vault_id(app_handle: &AppHandle) -> MosaicResult<Option<String>> {
        let state = Self::load(app_handle)?;
        Ok(state.last_vault_id)
    }

    /// Get last canvas ID
    pub fn get_last_canvas_id(app_handle: &AppHandle) -> MosaicResult<Option<String>> {
        let state = Self::load(app_handle)?;
        Ok(state.last_canvas_id)
    }
}
