// Node File Service
// Real-time persistence of nodes as markdown files: <canvas>/nodes/<id>.md
// The on-disk format lives in @mosaicflow/vault-core so external tools (e.g. an MCP server) share it.

import { CanvasRepository, orderParentsFirst, type StoredNode } from '@mosaicflow/vault-core';
import type { MosaicNode, MosaicNodeData, NodeType } from '$lib/types';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import { tauriFsAdapter } from './tauriFsAdapter';
import { readLegacyNode } from './legacyNodeFormat';

const CONTENT_SAVE_DELAY = 300; // Fast for typing
const PROPERTIES_SAVE_DELAY = 100; // Faster for position/size changes

const pending = new Map<string, { node: MosaicNode; timer: ReturnType<typeof setTimeout> }>();

let repository: CanvasRepository | null = null;

export function initNodeFileService(path: string) {
  repository = new CanvasRepository(tauriFsAdapter, path, (type) => nodeRegistry.getBodyMapping(type));
}

function toStored(node: MosaicNode): StoredNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
    parentId: node.parentId,
    extent: node.extent,
    expandParent: node.expandParent,
    data: node.data as Record<string, unknown>,
  };
}

function fromStored(stored: StoredNode): MosaicNode {
  const onLoad = nodeRegistry.get(stored.type)?.onLoad;
  const data = onLoad ? onLoad(stored.data) : stored.data;
  return {
    id: stored.id,
    type: stored.type as NodeType,
    position: stored.position,
    width: stored.width,
    height: stored.height,
    zIndex: stored.zIndex,
    parentId: stored.parentId,
    extent: stored.extent as MosaicNode['extent'],
    expandParent: stored.expandParent,
    draggable: !data.locked,
    data: data as MosaicNodeData,
  };
}

async function writeNode(repo: CanvasRepository, node: MosaicNode) {
  try {
    await repo.writeNode(toStored(node));
  } catch (error) {
    console.error(`Error saving node ${node.id}:`, error);
  }
}

function scheduleWrite(node: MosaicNode, delay: number) {
  const repo = repository;
  if (!repo) return;

  const existing = pending.get(node.id);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(node.id);
    writeNode(repo, node);
  }, delay);
  pending.set(node.id, { node, timer });
}

// Content and properties live in the same file; both just schedule a write of the latest node.
export function saveNodeContent(node: MosaicNode) {
  scheduleWrite(node, CONTENT_SAVE_DELAY);
}

export function saveNodeProperties(node: MosaicNode) {
  scheduleWrite(node, PROPERTIES_SAVE_DELAY);
}

export async function saveNodeImmediate(node: MosaicNode) {
  const repo = repository;
  if (!repo) return;
  const existing = pending.get(node.id);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(node.id);
  }
  await writeNode(repo, node);
}

export async function deleteNodeFolder(nodeId: string) {
  const repo = repository;
  if (!repo) return;

  const existing = pending.get(nodeId);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(nodeId);
  }

  try {
    await repo.deleteNode(nodeId);
  } catch (error) {
    console.error(`Error deleting node ${nodeId}:`, error);
  }
}

/**
 * Loads every node file in the canvas. Nodes that only exist in the legacy
 * folder format (listed in the manifest) are migrated to markdown on the fly.
 */
export async function loadAllNodes(nodesManifest: Record<string, { type: NodeType }>): Promise<MosaicNode[]> {
  const repo = repository;
  if (!repo) return [];

  const stored = await repo.readAllNodes();
  const seen = new Set(stored.map((n) => n.id));

  for (const [nodeId, { type }] of Object.entries(nodesManifest)) {
    if (seen.has(nodeId)) continue;
    try {
      const legacy = await readLegacyNode(tauriFsAdapter, repo.root, nodeId, type);
      if (!legacy) continue;
      await repo.writeNode(legacy);
      stored.push(legacy);
      seen.add(nodeId);
    } catch (error) {
      console.error(`Error migrating legacy node ${nodeId}:`, error);
    }
  }

  const manifestOrder = Object.keys(nodesManifest);
  const rank = (id: string) => {
    const i = manifestOrder.indexOf(id);
    return i === -1 ? manifestOrder.length : i;
  };
  stored.sort((a, b) => rank(a.id) - rank(b.id));

  return orderParentsFirst(stored.map(fromStored));
}

// True while the app has an unsaved change for this node (the app's version wins).
export function hasPendingNodeSave(nodeId: string): boolean {
  return pending.has(nodeId);
}

/** Reads one node file; null when it no longer exists. */
export async function readNodeFromDisk(nodeId: string): Promise<MosaicNode | null> {
  const repo = repository;
  if (!repo) return null;
  const stored = await repo.readNode(nodeId);
  return stored ? fromStored(stored) : null;
}

// Write all pending saves now (call before closing or switching canvas)
export async function flushPendingSaves() {
  const repo = repository;
  const entries = [...pending.values()];
  pending.clear();
  for (const { node, timer } of entries) {
    clearTimeout(timer);
    if (repo) await writeNode(repo, node);
  }
}

export function resetNodeFileService() {
  flushPendingSaves();
  repository = null;
}
