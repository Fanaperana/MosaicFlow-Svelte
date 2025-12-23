// History Service
//
// Handles history tracking and persistence

use crate::core::{self, paths::get_data_dir, MosaicResult};
use crate::models::{AppHistory, CanvasHistoryEntry, VaultHistoryEntry};
use std::path::PathBuf;
use tauri::AppHandle;

pub struct HistoryService;

impl HistoryService {
    /// Get history file path
    fn history_path(app_handle: &AppHandle) -> MosaicResult<PathBuf> {
        let data_dir = get_data_dir(app_handle)?;
        Ok(data_dir.join("history.json"))
    }

    /// Load history from disk
    pub fn load(app_handle: &AppHandle) -> MosaicResult<AppHistory> {
        let path = Self::history_path(app_handle)?;

        if path.exists() {
            core::read_json(&path)
        } else {
            Ok(AppHistory::default())
        }
    }

    /// Save history to disk
    pub fn save(app_handle: &AppHandle, history: &AppHistory) -> MosaicResult<()> {
        let path = Self::history_path(app_handle)?;
        core::write_json(&path, history)
    }

    /// Track vault open
    pub fn track_vault(
        app_handle: &AppHandle,
        id: String,
        name: String,
        path: String,
    ) -> MosaicResult<()> {
        let mut history = Self::load(app_handle)?;
        history.track_vault(id, name, path);
        Self::save(app_handle, &history)
    }

    /// Track canvas open
    pub fn track_canvas(
        app_handle: &AppHandle,
        id: String,
        vault_id: String,
        name: String,
        path: String,
    ) -> MosaicResult<()> {
        let mut history = Self::load(app_handle)?;
        history.track_canvas(id, vault_id, name, path);
        Self::save(app_handle, &history)
    }

    /// Remove vault from history
    pub fn remove_vault(app_handle: &AppHandle, vault_id: &str) -> MosaicResult<()> {
        let mut history = Self::load(app_handle)?;
        history.remove_vault(vault_id);
        Self::save(app_handle, &history)
    }

    /// Remove canvas from history
    pub fn remove_canvas(app_handle: &AppHandle, canvas_id: &str) -> MosaicResult<()> {
        let mut history = Self::load(app_handle)?;
        history.remove_canvas(canvas_id);
        Self::save(app_handle, &history)
    }

    /// Get recent vaults
    pub fn get_recent_vaults(
        app_handle: &AppHandle,
        limit: usize,
    ) -> MosaicResult<Vec<VaultHistoryEntry>> {
        let history = Self::load(app_handle)?;
        Ok(history.recent_vaults(limit).into_iter().cloned().collect())
    }

    /// Get recent canvases
    pub fn get_recent_canvases(
        app_handle: &AppHandle,
        vault_id: Option<&str>,
        limit: usize,
    ) -> MosaicResult<Vec<CanvasHistoryEntry>> {
        let history = Self::load(app_handle)?;
        Ok(history
            .recent_canvases(vault_id, limit)
            .into_iter()
            .cloned()
            .collect())
    }

    /// Find vault by ID
    pub fn find_vault(
        app_handle: &AppHandle,
        vault_id: &str,
    ) -> MosaicResult<Option<VaultHistoryEntry>> {
        let history = Self::load(app_handle)?;
        Ok(history.find_vault(vault_id).cloned())
    }

    /// Find canvas by ID
    pub fn find_canvas(
        app_handle: &AppHandle,
        canvas_id: &str,
    ) -> MosaicResult<Option<CanvasHistoryEntry>> {
        let history = Self::load(app_handle)?;
        Ok(history.find_canvas(canvas_id).cloned())
    }
}
