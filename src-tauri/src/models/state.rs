// App State Models
//
// Data structures for app-level state persistence

use serde::{Deserialize, Serialize};

/// App-level state stored in data/data.json
/// Tracks the current session state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppState {
    /// UUID of the last opened vault
    #[serde(default)]
    pub last_vault_id: Option<String>,
    /// UUID of the last opened canvas
    #[serde(default)]
    pub last_canvas_id: Option<String>,
    /// When the app state was last updated
    #[serde(default)]
    pub updated_at: String,
    /// App version for migration purposes
    #[serde(default = "default_version")]
    pub version: String,
}

fn default_version() -> String {
    "1.0.0".to_string()
}

impl AppState {
    pub fn new() -> Self {
        Self {
            last_vault_id: None,
            last_canvas_id: None,
            updated_at: crate::core::now_iso(),
            version: default_version(),
        }
    }

    pub fn touch(&mut self) {
        self.updated_at = crate::core::now_iso();
    }

    pub fn set_last_vault(&mut self, vault_id: String) {
        self.last_vault_id = Some(vault_id);
        self.touch();
    }

    pub fn set_last_canvas(&mut self, canvas_id: String) {
        self.last_canvas_id = Some(canvas_id);
        self.touch();
    }

    pub fn set_last_opened(&mut self, vault_id: Option<String>, canvas_id: Option<String>) {
        if vault_id.is_some() {
            self.last_vault_id = vault_id;
        }
        if canvas_id.is_some() {
            self.last_canvas_id = canvas_id;
        }
        self.touch();
    }
}
