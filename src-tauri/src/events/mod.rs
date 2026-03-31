// MosaicFlow Events System
//
// Provides real-time updates to the frontend via Tauri events
// This is the backbone for reactive UI updates

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

/// Event names used throughout the application
pub mod event_names {
    // Vault events
    pub const VAULT_CREATED: &str = "vault:created";
    pub const VAULT_OPENED: &str = "vault:opened";
    pub const VAULT_UPDATED: &str = "vault:updated";
    pub const VAULT_CLOSED: &str = "vault:closed";

    // Canvas events
    pub const CANVAS_CREATED: &str = "canvas:created";
    pub const CANVAS_OPENED: &str = "canvas:opened";
    pub const CANVAS_UPDATED: &str = "canvas:updated";
    pub const CANVAS_CLOSED: &str = "canvas:closed";
    pub const CANVAS_DELETED: &str = "canvas:deleted";

    // Workspace events
    pub const WORKSPACE_LOADED: &str = "workspace:loaded";
    pub const WORKSPACE_SAVED: &str = "workspace:saved";
    pub const WORKSPACE_CHANGED: &str = "workspace:changed";

    // State events
    pub const STATE_CHANGED: &str = "state:changed";
    pub const HISTORY_CHANGED: &str = "history:changed";
}

/// Event payload for vault updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEvent {
    pub vault_id: String,
    pub vault_path: String,
    pub vault_name: String,
    pub timestamp: String,
}

/// Event payload for canvas updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasEvent {
    pub canvas_id: String,
    pub canvas_path: String,
    pub canvas_name: String,
    pub vault_id: String,
    pub timestamp: String,
}

/// Event payload for workspace changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEvent {
    pub canvas_path: String,
    pub change_type: WorkspaceChangeType,
    pub node_ids: Option<Vec<String>>,
    pub edge_ids: Option<Vec<String>>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceChangeType {
    Loaded,
    Saved,
    NodesAdded,
    NodesUpdated,
    NodesDeleted,
    EdgesAdded,
    EdgesUpdated,
    EdgesDeleted,
    BatchUpdate,
}

/// Event payload for state changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateEvent {
    pub last_vault_id: Option<String>,
    pub last_canvas_id: Option<String>,
    pub timestamp: String,
}

/// Event payload for history changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEvent {
    pub vault_count: usize,
    pub canvas_count: usize,
    pub timestamp: String,
}

/// Event emitter helper
pub struct EventEmitter<'a> {
    app_handle: &'a AppHandle,
}

impl<'a> EventEmitter<'a> {
    pub fn new(app_handle: &'a AppHandle) -> Self {
        Self { app_handle }
    }

    /// Emit an event to all windows, logging on failure
    fn emit_event<T: Serialize + Clone>(&self, event: &str, payload: T) {
        if let Err(e) = self.app_handle.emit(event, payload) {
            eprintln!("[EventEmitter] Failed to emit '{}': {}", event, e);
        }
    }

    fn now() -> String {
        mosaicflow_core::now_iso()
    }

    // -- Vault events ---------------------------------------------------------

    fn vault_event(vault_id: &str, path: &str, name: &str) -> VaultEvent {
        VaultEvent {
            vault_id: vault_id.to_string(),
            vault_path: path.to_string(),
            vault_name: name.to_string(),
            timestamp: Self::now(),
        }
    }

    pub fn vault_created(&self, vault_id: &str, path: &str, name: &str) {
        self.emit_event(event_names::VAULT_CREATED, Self::vault_event(vault_id, path, name));
    }

    pub fn vault_opened(&self, vault_id: &str, path: &str, name: &str) {
        self.emit_event(event_names::VAULT_OPENED, Self::vault_event(vault_id, path, name));
    }

    pub fn vault_updated(&self, vault_id: &str, path: &str, name: &str) {
        self.emit_event(event_names::VAULT_UPDATED, Self::vault_event(vault_id, path, name));
    }

    pub fn vault_closed(&self, vault_id: &str, path: &str, name: &str) {
        self.emit_event(event_names::VAULT_CLOSED, Self::vault_event(vault_id, path, name));
    }

    // -- Canvas events --------------------------------------------------------

    fn canvas_event(canvas_id: &str, path: &str, name: &str, vault_id: &str) -> CanvasEvent {
        CanvasEvent {
            canvas_id: canvas_id.to_string(),
            canvas_path: path.to_string(),
            canvas_name: name.to_string(),
            vault_id: vault_id.to_string(),
            timestamp: Self::now(),
        }
    }

    pub fn canvas_created(&self, canvas_id: &str, path: &str, name: &str, vault_id: &str) {
        self.emit_event(
            event_names::CANVAS_CREATED,
            Self::canvas_event(canvas_id, path, name, vault_id),
        );
    }

    pub fn canvas_opened(&self, canvas_id: &str, path: &str, name: &str, vault_id: &str) {
        self.emit_event(
            event_names::CANVAS_OPENED,
            Self::canvas_event(canvas_id, path, name, vault_id),
        );
    }

    pub fn canvas_updated(&self, canvas_id: &str, path: &str, name: &str, vault_id: &str) {
        self.emit_event(
            event_names::CANVAS_UPDATED,
            Self::canvas_event(canvas_id, path, name, vault_id),
        );
    }

    pub fn canvas_deleted(&self, canvas_id: &str, vault_id: &str) {
        self.emit_event(
            event_names::CANVAS_DELETED,
            Self::canvas_event(canvas_id, "", "", vault_id),
        );
    }

    pub fn canvas_closed(&self, canvas_id: &str, path: &str, name: &str, vault_id: &str) {
        self.emit_event(
            event_names::CANVAS_CLOSED,
            Self::canvas_event(canvas_id, path, name, vault_id),
        );
    }

    // -- Workspace events -----------------------------------------------------

    pub fn workspace_loaded(&self, canvas_path: &str) {
        self.emit_event(
            event_names::WORKSPACE_LOADED,
            WorkspaceEvent {
                canvas_path: canvas_path.to_string(),
                change_type: WorkspaceChangeType::Loaded,
                node_ids: None,
                edge_ids: None,
                timestamp: Self::now(),
            },
        );
    }

    pub fn workspace_saved(&self, canvas_path: &str) {
        self.emit_event(
            event_names::WORKSPACE_SAVED,
            WorkspaceEvent {
                canvas_path: canvas_path.to_string(),
                change_type: WorkspaceChangeType::Saved,
                node_ids: None,
                edge_ids: None,
                timestamp: Self::now(),
            },
        );
    }

    pub fn nodes_changed(
        &self,
        canvas_path: &str,
        change_type: WorkspaceChangeType,
        node_ids: Vec<String>,
    ) {
        self.emit_event(
            event_names::WORKSPACE_CHANGED,
            WorkspaceEvent {
                canvas_path: canvas_path.to_string(),
                change_type,
                node_ids: Some(node_ids),
                edge_ids: None,
                timestamp: Self::now(),
            },
        );
    }

    pub fn edges_changed(
        &self,
        canvas_path: &str,
        change_type: WorkspaceChangeType,
        edge_ids: Vec<String>,
    ) {
        self.emit_event(
            event_names::WORKSPACE_CHANGED,
            WorkspaceEvent {
                canvas_path: canvas_path.to_string(),
                change_type,
                node_ids: None,
                edge_ids: Some(edge_ids),
                timestamp: Self::now(),
            },
        );
    }

    // -- State events ---------------------------------------------------------

    pub fn state_changed(&self, vault_id: Option<String>, canvas_id: Option<String>) {
        self.emit_event(
            event_names::STATE_CHANGED,
            StateEvent {
                last_vault_id: vault_id,
                last_canvas_id: canvas_id,
                timestamp: Self::now(),
            },
        );
    }

    pub fn history_changed(&self, vault_count: usize, canvas_count: usize) {
        self.emit_event(
            event_names::HISTORY_CHANGED,
            HistoryEvent {
                vault_count,
                canvas_count,
                timestamp: Self::now(),
            },
        );
    }
}
