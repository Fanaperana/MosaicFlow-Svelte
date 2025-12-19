// Vault Models
//
// Data structures for vault management

use serde::{Deserialize, Serialize};

/// Vault metadata stored in vault.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMeta {
    /// Unique identifier (UUID v4)
    pub id: String,
    /// Display name
    pub name: String,
    /// Optional description
    #[serde(default)]
    pub description: String,
    /// When the vault was created (ISO 8601)
    pub created_at: String,
    /// When the vault was last modified (ISO 8601)
    pub updated_at: String,
    /// Schema version for migrations
    #[serde(default = "default_version")]
    pub version: String,
}

fn default_version() -> String {
    "2.0.0".to_string()
}

impl VaultMeta {
    pub fn new(id: String, name: String) -> Self {
        let now = crate::core::now_iso();
        Self {
            id,
            name,
            description: String::new(),
            created_at: now.clone(),
            updated_at: now,
            version: default_version(),
        }
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = description;
        self
    }

    pub fn touch(&mut self) {
        self.updated_at = crate::core::now_iso();
    }
}

/// Vault info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub canvas_count: usize,
}

impl VaultInfo {
    pub fn from_meta(meta: &VaultMeta, path: String, canvas_count: usize) -> Self {
        Self {
            id: meta.id.clone(),
            path,
            name: meta.name.clone(),
            description: meta.description.clone(),
            created_at: meta.created_at.clone(),
            updated_at: meta.updated_at.clone(),
            canvas_count,
        }
    }
}

/// Lightweight vault reference for lists
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultRef {
    pub id: String,
    pub name: String,
    pub path: String,
}

impl From<&VaultInfo> for VaultRef {
    fn from(info: &VaultInfo) -> Self {
        Self {
            id: info.id.clone(),
            name: info.name.clone(),
            path: info.path.clone(),
        }
    }
}
