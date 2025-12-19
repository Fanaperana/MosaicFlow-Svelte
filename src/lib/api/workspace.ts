/**
 * Workspace API
 * 
 * All workspace data operations (nodes, edges).
 */

import { safeInvoke } from './bridge';
import type { WorkspaceData, WorkspaceNode, WorkspaceEdge } from './types';
import { devStorage } from './dev-storage';

export async function load(canvasPath: string): Promise<WorkspaceData> {
  return safeInvoke('load_workspace', { canvas_path: canvasPath }, () =>
    devStorage.loadWorkspace(canvasPath)
  );
}

export async function save(canvasPath: string, data: WorkspaceData): Promise<void> {
  return safeInvoke('save_workspace', {
    canvas_path: canvasPath,
    data
  }, () => devStorage.saveWorkspace(canvasPath, data));
}

export async function updateNodes(canvasPath: string, nodes: WorkspaceNode[]): Promise<void> {
  return safeInvoke('update_nodes', {
    canvas_path: canvasPath,
    nodes
  });
}

export async function updateEdges(canvasPath: string, edges: WorkspaceEdge[]): Promise<void> {
  return safeInvoke('update_edges', {
    canvas_path: canvasPath,
    edges
  });
}

export async function addNode(canvasPath: string, node: WorkspaceNode): Promise<void> {
  return safeInvoke('add_node', {
    canvas_path: canvasPath,
    node
  });
}

export async function removeNode(canvasPath: string, nodeId: string): Promise<void> {
  return safeInvoke('remove_node', {
    canvas_path: canvasPath,
    node_id: nodeId
  });
}

export async function addEdge(canvasPath: string, edge: WorkspaceEdge): Promise<void> {
  return safeInvoke('add_edge', {
    canvas_path: canvasPath,
    edge
  });
}

export async function removeEdge(canvasPath: string, edgeId: string): Promise<void> {
  return safeInvoke('remove_edge', {
    canvas_path: canvasPath,
    edge_id: edgeId
  });
}

export async function batchUpdate(
  canvasPath: string,
  nodesToAdd: WorkspaceNode[],
  nodesToRemove: string[],
  edgesToAdd: WorkspaceEdge[],
  edgesToRemove: string[]
): Promise<void> {
  return safeInvoke('batch_update_workspace', {
    canvas_path: canvasPath,
    nodes_to_add: nodesToAdd,
    nodes_to_remove: nodesToRemove,
    edges_to_add: edgesToAdd,
    edges_to_remove: edgesToRemove
  });
}
