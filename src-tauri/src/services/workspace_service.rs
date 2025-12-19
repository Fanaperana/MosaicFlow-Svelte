// Workspace Service
//
// Handles workspace data operations (nodes, edges)

use std::path::Path;
use crate::core::{self, MosaicResult, paths::CanvasPaths};
use crate::models::{WorkspaceData, WorkspaceNode, WorkspaceEdge};

pub struct WorkspaceService;

impl WorkspaceService {
    /// Load workspace data from canvas
    pub fn load(canvas_path: &Path) -> MosaicResult<WorkspaceData> {
        let canvas_paths = CanvasPaths::from_root(&canvas_path.to_path_buf());
        
        if canvas_paths.workspace_json.exists() {
            core::read_json(&canvas_paths.workspace_json)
        } else {
            Ok(WorkspaceData::new())
        }
    }

    /// Save workspace data to canvas
    pub fn save(canvas_path: &Path, data: &WorkspaceData) -> MosaicResult<()> {
        let canvas_paths = CanvasPaths::from_root(&canvas_path.to_path_buf());
        core::write_json(&canvas_paths.workspace_json, data)
    }

    /// Update nodes only (merge operation)
    pub fn update_nodes(canvas_path: &Path, nodes: Vec<WorkspaceNode>) -> MosaicResult<()> {
        let mut data = Self::load(canvas_path)?;
        data.nodes = nodes;
        Self::save(canvas_path, &data)
    }

    /// Update edges only (merge operation)
    pub fn update_edges(canvas_path: &Path, edges: Vec<WorkspaceEdge>) -> MosaicResult<()> {
        let mut data = Self::load(canvas_path)?;
        data.edges = edges;
        Self::save(canvas_path, &data)
    }

    /// Add a single node
    pub fn add_node(canvas_path: &Path, node: WorkspaceNode) -> MosaicResult<()> {
        let mut data = Self::load(canvas_path)?;
        data.add_node(node);
        Self::save(canvas_path, &data)
    }

    /// Remove a single node
    pub fn remove_node(canvas_path: &Path, node_id: &str) -> MosaicResult<()> {
        let mut data = Self::load(canvas_path)?;
        data.remove_node(node_id);
        Self::save(canvas_path, &data)
    }

    /// Add a single edge
    pub fn add_edge(canvas_path: &Path, edge: WorkspaceEdge) -> MosaicResult<()> {
        let mut data = Self::load(canvas_path)?;
        data.add_edge(edge);
        Self::save(canvas_path, &data)
    }

    /// Remove a single edge
    pub fn remove_edge(canvas_path: &Path, edge_id: &str) -> MosaicResult<()> {
        let mut data = Self::load(canvas_path)?;
        data.remove_edge(edge_id);
        Self::save(canvas_path, &data)
    }

    /// Batch update multiple nodes and edges
    pub fn batch_update(
        canvas_path: &Path,
        nodes_to_add: Vec<WorkspaceNode>,
        nodes_to_remove: Vec<String>,
        edges_to_add: Vec<WorkspaceEdge>,
        edges_to_remove: Vec<String>,
    ) -> MosaicResult<()> {
        let mut data = Self::load(canvas_path)?;
        
        // Remove items first
        for node_id in nodes_to_remove {
            data.remove_node(&node_id);
        }
        for edge_id in edges_to_remove {
            data.remove_edge(&edge_id);
        }
        
        // Add new items
        for node in nodes_to_add {
            data.add_node(node);
        }
        for edge in edges_to_add {
            data.add_edge(edge);
        }
        
        Self::save(canvas_path, &data)
    }
}
