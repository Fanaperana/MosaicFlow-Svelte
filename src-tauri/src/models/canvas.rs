// Canvas Models
//
// Data structures for canvas management

use serde::{Deserialize, Serialize};

/// Canvas metadata stored in .mosaic/meta.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasMeta {
    /// Unique identifier (UUID v4)
    pub id: String,
    /// Parent vault UUID
    pub vault_id: String,
    /// Display name
    pub name: String,
    /// Optional description
    #[serde(default)]
    pub description: String,
    /// Tags for organization
    #[serde(default)]
    pub tags: Vec<String>,
    /// When the canvas was created (ISO 8601)
    pub created_at: String,
    /// When the canvas was last modified (ISO 8601)
    pub updated_at: String,
    /// Schema version for migrations
    #[serde(default = "default_version")]
    pub version: String,
}

fn default_version() -> String {
    "2.0.0".to_string()
}

impl CanvasMeta {
    pub fn new(id: String, vault_id: String, name: String) -> Self {
        let now = crate::core::now_iso();
        Self {
            id,
            vault_id,
            name,
            description: String::new(),
            tags: vec![],
            created_at: now.clone(),
            updated_at: now,
            version: default_version(),
        }
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = description;
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    pub fn touch(&mut self) {
        self.updated_at = crate::core::now_iso();
    }

    pub fn add_tag(&mut self, tag: String) {
        if !self.tags.contains(&tag) {
            self.tags.push(tag);
            self.touch();
        }
    }

    pub fn remove_tag(&mut self, tag: &str) {
        if let Some(pos) = self.tags.iter().position(|t| t == tag) {
            self.tags.remove(pos);
            self.touch();
        }
    }
}

/// Canvas info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasInfo {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

impl CanvasInfo {
    pub fn from_meta(meta: &CanvasMeta, path: String) -> Self {
        Self {
            id: meta.id.clone(),
            vault_id: meta.vault_id.clone(),
            name: meta.name.clone(),
            description: meta.description.clone(),
            path,
            created_at: meta.created_at.clone(),
            updated_at: meta.updated_at.clone(),
            tags: meta.tags.clone(),
        }
    }
}

/// Lightweight canvas reference for lists
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasRef {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub path: String,
}

impl From<&CanvasInfo> for CanvasRef {
    fn from(info: &CanvasInfo) -> Self {
        Self {
            id: info.id.clone(),
            vault_id: info.vault_id.clone(),
            name: info.name.clone(),
            path: info.path.clone(),
        }
    }
}

/// Canvas UI state stored in .mosaic/state.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanvasUIState {
    /// Viewport position and zoom
    #[serde(default)]
    pub viewport: ViewportState,
    /// Currently selected node IDs
    #[serde(default)]
    pub selected_nodes: Vec<String>,
    /// Currently selected edge IDs
    #[serde(default)]
    pub selected_edges: Vec<String>,
    /// Canvas mode (select, drag, etc.)
    #[serde(default = "default_canvas_mode")]
    pub canvas_mode: String,
    /// Last modified timestamp
    #[serde(default)]
    pub updated_at: String,
}

fn default_canvas_mode() -> String {
    "select".to_string()
}

/// Viewport state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewportState {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

impl Default for ViewportState {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        }
    }
}

impl CanvasUIState {
    pub fn touch(&mut self) {
        self.updated_at = crate::core::now_iso();
    }
}
