// App Config Models
//
// Data structures for app-level configuration persistence
// This is the old-style config that tracks vault paths directly

use serde::{Deserialize, Serialize};

/// App configuration stored in config.json
/// Tracks current vault path and recent vaults
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    /// Path to the currently open vault
    #[serde(default)]
    pub current_vault_path: Option<String>,
    /// Path to the currently open canvas
    #[serde(default)]
    pub current_canvas_path: Option<String>,
    /// List of recently opened vaults
    #[serde(default)]
    pub recent_vaults: Vec<RecentVault>,
}

/// Recent vault entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentVault {
    /// Vault name
    pub name: String,
    /// Vault path
    pub path: String,
    /// When the vault was last opened (ISO 8601)
    pub last_opened: String,
}

impl AppConfig {
    pub fn new() -> Self {
        Self::default()
    }
}
