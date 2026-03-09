/**
 * Workspace API
 * 
 * All workspace data operations (nodes, edges).
 */

import { safeInvoke } from './bridge';
import type { WorkspaceData, WorkspaceNode, WorkspaceEdge } from './types';
import { devStorage } from './dev-storage';

export async function load(canvasPath: string): Promise<WorkspaceData> {
  return safeInvoke('load_workspace', { canvasPath }, () =>
    devStorage.loadWorkspace(canvasPath)
  );
}

export async function save(canvasPath: string, data: WorkspaceData): Promise<void> {
  return safeInvoke('save_workspace', {
    canvasPath,
    data
  }, () => devStorage.saveWorkspace(canvasPath, data));
}

export async function updateNodes(canvasPath: string, nodes: WorkspaceNode[]): Promise<void> {
  return safeInvoke('update_nodes', {
    canvasPath,
    nodes
  }, () => {
    const data = devStorage.loadWorkspace(canvasPath);
    data.nodes = nodes;
    devStorage.saveWorkspace(canvasPath, data);
  });
}

export async function updateEdges(canvasPath: string, edges: WorkspaceEdge[]): Promise<void> {
  return safeInvoke('update_edges', {
    canvasPath,
    edges
  }, () => {
    const data = devStorage.loadWorkspace(canvasPath);
    data.edges = edges;
    devStorage.saveWorkspace(canvasPath, data);
  });
}

export async function addNode(canvasPath: string, node: WorkspaceNode): Promise<void> {
  return safeInvoke('add_node', {
    canvasPath,
    node
  }, () => {
    const data = devStorage.loadWorkspace(canvasPath);
    data.nodes.push(node);
    devStorage.saveWorkspace(canvasPath, data);
  });
}

export async function removeNode(canvasPath: string, nodeId: string): Promise<void> {
  return safeInvoke('remove_node', {
    canvasPath,
    nodeId
  }, () => {
    const data = devStorage.loadWorkspace(canvasPath);
    data.nodes = data.nodes.filter((n: WorkspaceNode) => n.id !== nodeId);
    devStorage.saveWorkspace(canvasPath, data);
  });
}

export async function addEdge(canvasPath: string, edge: WorkspaceEdge): Promise<void> {
  return safeInvoke('add_edge', {
    canvasPath,
    edge
  }, () => {
    const data = devStorage.loadWorkspace(canvasPath);
    data.edges.push(edge);
    devStorage.saveWorkspace(canvasPath, data);
  });
}

export async function removeEdge(canvasPath: string, edgeId: string): Promise<void> {
  return safeInvoke('remove_edge', {
    canvasPath,
    edgeId
  }, () => {
    const data = devStorage.loadWorkspace(canvasPath);
    data.edges = data.edges.filter((e: WorkspaceEdge) => e.id !== edgeId);
    devStorage.saveWorkspace(canvasPath, data);
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
    canvasPath,
    nodesToAdd,
    nodesToRemove,
    edgesToAdd,
    edgesToRemove
  }, () => {
    const data = devStorage.loadWorkspace(canvasPath);
    data.nodes = data.nodes.filter((n: WorkspaceNode) => !nodesToRemove.includes(n.id));
    data.nodes.push(...nodesToAdd);
    data.edges = data.edges.filter((e: WorkspaceEdge) => !edgesToRemove.includes(e.id));
    data.edges.push(...edgesToAdd);
    devStorage.saveWorkspace(canvasPath, data);
  });
}
