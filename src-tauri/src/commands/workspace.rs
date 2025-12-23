// Workspace Commands
//
// Tauri command handlers for workspace data operations

use crate::events::{EventEmitter, WorkspaceChangeType};
use crate::models::{WorkspaceData, WorkspaceEdge, WorkspaceNode};
use crate::services::WorkspaceService;
use std::path::Path;
use tauri::AppHandle;

/// Load workspace data
#[tauri::command]
pub async fn load_workspace(
    app_handle: AppHandle,
    canvas_path: String,
) -> Result<WorkspaceData, String> {
    let data = WorkspaceService::load(Path::new(&canvas_path)).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.workspace_loaded(&canvas_path);

    Ok(data)
}

/// Save workspace data
#[tauri::command]
pub async fn save_workspace(
    app_handle: AppHandle,
    canvas_path: String,
    data: WorkspaceData,
) -> Result<(), String> {
    WorkspaceService::save(Path::new(&canvas_path), &data).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.workspace_saved(&canvas_path);

    Ok(())
}

/// Update nodes only
#[tauri::command]
pub async fn update_nodes(
    app_handle: AppHandle,
    canvas_path: String,
    nodes: Vec<WorkspaceNode>,
) -> Result<(), String> {
    let node_ids: Vec<String> = nodes.iter().map(|n| n.id.clone()).collect();

    WorkspaceService::update_nodes(Path::new(&canvas_path), nodes).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.nodes_changed(&canvas_path, WorkspaceChangeType::NodesUpdated, node_ids);

    Ok(())
}

/// Update edges only
#[tauri::command]
pub async fn update_edges(
    app_handle: AppHandle,
    canvas_path: String,
    edges: Vec<WorkspaceEdge>,
) -> Result<(), String> {
    let edge_ids: Vec<String> = edges.iter().map(|e| e.id.clone()).collect();

    WorkspaceService::update_edges(Path::new(&canvas_path), edges).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.edges_changed(&canvas_path, WorkspaceChangeType::EdgesUpdated, edge_ids);

    Ok(())
}

/// Add a single node
#[tauri::command]
pub async fn add_node(
    app_handle: AppHandle,
    canvas_path: String,
    node: WorkspaceNode,
) -> Result<(), String> {
    let node_id = node.id.clone();

    WorkspaceService::add_node(Path::new(&canvas_path), node).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.nodes_changed(&canvas_path, WorkspaceChangeType::NodesAdded, vec![node_id]);

    Ok(())
}

/// Remove a single node
#[tauri::command]
pub async fn remove_node(
    app_handle: AppHandle,
    canvas_path: String,
    node_id: String,
) -> Result<(), String> {
    WorkspaceService::remove_node(Path::new(&canvas_path), &node_id).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.nodes_changed(
        &canvas_path,
        WorkspaceChangeType::NodesDeleted,
        vec![node_id],
    );

    Ok(())
}

/// Add a single edge
#[tauri::command]
pub async fn add_edge(
    app_handle: AppHandle,
    canvas_path: String,
    edge: WorkspaceEdge,
) -> Result<(), String> {
    let edge_id = edge.id.clone();

    WorkspaceService::add_edge(Path::new(&canvas_path), edge).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.edges_changed(&canvas_path, WorkspaceChangeType::EdgesAdded, vec![edge_id]);

    Ok(())
}

/// Remove a single edge
#[tauri::command]
pub async fn remove_edge(
    app_handle: AppHandle,
    canvas_path: String,
    edge_id: String,
) -> Result<(), String> {
    WorkspaceService::remove_edge(Path::new(&canvas_path), &edge_id).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.edges_changed(
        &canvas_path,
        WorkspaceChangeType::EdgesDeleted,
        vec![edge_id],
    );

    Ok(())
}

/// Batch update nodes and edges
#[tauri::command]
pub async fn batch_update_workspace(
    app_handle: AppHandle,
    canvas_path: String,
    nodes_to_add: Vec<WorkspaceNode>,
    nodes_to_remove: Vec<String>,
    edges_to_add: Vec<WorkspaceEdge>,
    edges_to_remove: Vec<String>,
) -> Result<(), String> {
    WorkspaceService::batch_update(
        Path::new(&canvas_path),
        nodes_to_add,
        nodes_to_remove.clone(),
        edges_to_add,
        edges_to_remove.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    if !nodes_to_remove.is_empty() {
        emitter.nodes_changed(
            &canvas_path,
            WorkspaceChangeType::BatchUpdate,
            nodes_to_remove,
        );
    }
    if !edges_to_remove.is_empty() {
        emitter.edges_changed(
            &canvas_path,
            WorkspaceChangeType::BatchUpdate,
            edges_to_remove,
        );
    }

    Ok(())
}
