// History Models
//
// Data structures for tracking recently opened items

use serde::{Deserialize, Serialize};

/// History tracking stored in data/history.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppHistory {
    /// Recently opened vaults
    #[serde(default)]
    pub vaults: Vec<VaultHistoryEntry>,
    /// Recently opened canvases
    #[serde(default)]
    pub canvases: Vec<CanvasHistoryEntry>,
    /// Maximum items to keep in history
    #[serde(default = "default_max_history")]
    pub max_items: usize,
}

fn default_max_history() -> usize {
    50
}

impl AppHistory {
    /// Add or update vault in history
    pub fn track_vault(&mut self, id: String, name: String, path: String) {
        let now = crate::core::now_iso();
        
        if let Some(entry) = self.vaults.iter_mut().find(|v| v.id == id) {
            entry.name = name;
            entry.path = path;
            entry.last_opened = now;
            entry.open_count += 1;
        } else {
            self.vaults.push(VaultHistoryEntry {
                id,
                name,
                path,
                last_opened: now.clone(),
                open_count: 1,
                added_at: now,
            });
        }
        
        // Sort by last_opened descending
        self.vaults.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
        
        // Trim to max items
        if self.vaults.len() > self.max_items {
            self.vaults.truncate(self.max_items);
        }
    }

    /// Add or update canvas in history
    pub fn track_canvas(&mut self, id: String, vault_id: String, name: String, path: String) {
        let now = crate::core::now_iso();
        
        if let Some(entry) = self.canvases.iter_mut().find(|c| c.id == id) {
            entry.name = name;
            entry.path = path;
            entry.last_opened = now;
            entry.open_count += 1;
        } else {
            self.canvases.push(CanvasHistoryEntry {
                id,
                vault_id,
                name,
                path,
                last_opened: now.clone(),
                open_count: 1,
                added_at: now,
            });
        }
        
        // Sort by last_opened descending
        self.canvases.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
        
        // Trim to max items
        if self.canvases.len() > self.max_items {
            self.canvases.truncate(self.max_items);
        }
    }

    /// Remove vault from history (and its canvases)
    pub fn remove_vault(&mut self, vault_id: &str) {
        self.vaults.retain(|v| v.id != vault_id);
        self.canvases.retain(|c| c.vault_id != vault_id);
    }

    /// Remove canvas from history
    pub fn remove_canvas(&mut self, canvas_id: &str) {
        self.canvases.retain(|c| c.id != canvas_id);
    }

    /// Get recent vaults
    pub fn recent_vaults(&self, limit: usize) -> Vec<&VaultHistoryEntry> {
        self.vaults.iter().take(limit).collect()
    }

    /// Get recent canvases (optionally filtered by vault)
    pub fn recent_canvases(&self, vault_id: Option<&str>, limit: usize) -> Vec<&CanvasHistoryEntry> {
        self.canvases
            .iter()
            .filter(|c| vault_id.map_or(true, |vid| c.vault_id == vid))
            .take(limit)
            .collect()
    }

    /// Find vault by ID
    pub fn find_vault(&self, vault_id: &str) -> Option<&VaultHistoryEntry> {
        self.vaults.iter().find(|v| v.id == vault_id)
    }

    /// Find canvas by ID
    pub fn find_canvas(&self, canvas_id: &str) -> Option<&CanvasHistoryEntry> {
        self.canvases.iter().find(|c| c.id == canvas_id)
    }
}

/// Entry in vault history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultHistoryEntry {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// File system path
    pub path: String,
    /// Last time this vault was opened
    pub last_opened: String,
    /// Number of times opened
    pub open_count: u32,
    /// When the vault was first added to history
    pub added_at: String,
}

/// Entry in canvas history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasHistoryEntry {
    /// Unique identifier
    pub id: String,
    /// Parent vault UUID
    pub vault_id: String,
    /// Display name
    pub name: String,
    /// File system path
    pub path: String,
    /// Last time this canvas was opened
    pub last_opened: String,
    /// Number of times opened
    pub open_count: u32,
    /// When the canvas was first added to history
    pub added_at: String,
}
