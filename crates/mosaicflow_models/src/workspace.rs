// Workspace Models
//
// Data structures for canvas workspace (nodes, edges)

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Workspace data stored in workspace.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceData {
    /// Schema version
    #[serde(default = "default_version")]
    pub version: String,
    /// Nodes in the workspace
    #[serde(default)]
    pub nodes: Vec<WorkspaceNode>,
    /// Edges connecting nodes
    #[serde(default)]
    pub edges: Vec<WorkspaceEdge>,
    /// Workspace settings
    #[serde(default)]
    pub settings: WorkspaceSettings,
}

fn default_version() -> String {
    "2.0.0".to_string()
}

/// Node in the workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceNode {
    /// Unique node ID
    pub id: String,
    /// Node type (note, image, link, etc.)
    #[serde(rename = "type")]
    pub node_type: String,
    /// Position on canvas
    pub position: Position,
    /// Node dimensions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    /// Z-index for layering
    #[serde(default = "default_z_index")]
    pub z_index: i32,
    /// Parent node ID (for grouped nodes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    /// Type-specific data
    pub data: HashMap<String, Value>,
}

fn default_z_index() -> i32 {
    1
}

/// Position on canvas
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Edge connecting nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEdge {
    /// Unique edge ID
    pub id: String,
    /// Source node ID
    pub source: String,
    /// Target node ID
    pub target: String,
    /// Source handle ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    /// Target handle ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
    /// Edge type (default, straight, step, smoothstep, bezier)
    #[serde(default = "default_edge_type")]
    pub edge_type: String,
    /// Edge label
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Whether edge is animated
    #[serde(default)]
    pub animated: bool,
    /// Edge-specific data
    #[serde(default)]
    pub data: HashMap<String, Value>,
}

fn default_edge_type() -> String {
    "default".to_string()
}

/// Workspace settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    #[serde(default = "default_grid_size")]
    pub grid_size: u32,
    #[serde(default = "default_snap_to_grid")]
    pub snap_to_grid: bool,
    #[serde(default = "default_show_minimap")]
    pub show_minimap: bool,
    #[serde(default = "default_auto_save")]
    pub auto_save: bool,
    #[serde(default = "default_auto_save_interval")]
    pub auto_save_interval: u32,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_node_color")]
    pub default_node_color: String,
    #[serde(default = "default_edge_color")]
    pub default_edge_color: String,
}

fn default_grid_size() -> u32 {
    20
}
fn default_snap_to_grid() -> bool {
    true
}
fn default_show_minimap() -> bool {
    true
}
fn default_auto_save() -> bool {
    true
}
fn default_auto_save_interval() -> u32 {
    1000
}
fn default_theme() -> String {
    "dark".to_string()
}
fn default_node_color() -> String {
    "#1e1e1e".to_string()
}
fn default_edge_color() -> String {
    "#555555".to_string()
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            grid_size: default_grid_size(),
            snap_to_grid: default_snap_to_grid(),
            show_minimap: default_show_minimap(),
            auto_save: default_auto_save(),
            auto_save_interval: default_auto_save_interval(),
            theme: default_theme(),
            default_node_color: default_node_color(),
            default_edge_color: default_edge_color(),
        }
    }
}

impl WorkspaceData {
    /// Create an empty workspace
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a node
    pub fn add_node(&mut self, node: WorkspaceNode) {
        self.nodes.push(node);
    }

    /// Add an edge
    pub fn add_edge(&mut self, edge: WorkspaceEdge) {
        self.edges.push(edge);
    }

    /// Remove a node and its connected edges
    pub fn remove_node(&mut self, node_id: &str) {
        self.nodes.retain(|n| n.id != node_id);
        self.edges
            .retain(|e| e.source != node_id && e.target != node_id);
    }

    /// Remove an edge
    pub fn remove_edge(&mut self, edge_id: &str) {
        self.edges.retain(|e| e.id != edge_id);
    }

    /// Find a node by ID
    pub fn find_node(&self, node_id: &str) -> Option<&WorkspaceNode> {
        self.nodes.iter().find(|n| n.id == node_id)
    }

    /// Find a node by ID (mutable)
    pub fn find_node_mut(&mut self, node_id: &str) -> Option<&mut WorkspaceNode> {
        self.nodes.iter_mut().find(|n| n.id == node_id)
    }
}
