// Live sync: watches the open canvas folder and applies node/edge files changed by other tools
// (MCP server, text editors, file sync) without a reload. The app's own writes are ignored.

import { toast } from 'svelte-sonner';
import { workspace } from '$lib/stores/workspace.svelte';
import { isKnownContent, normalizePath } from './diskEcho';
import { hasPendingNodeSave, readNodeFromDisk } from './nodeFileService';
import { hasPendingEdgeSave, loadEdge } from './edgeFileService';

const NODE_FILE = /^nodes\/([A-Za-z0-9_][A-Za-z0-9_.-]*)\.md$/;
// edges/<id>.json (v3), edges/<id>/joined.json or the edges/<id> folder itself (v2)
const EDGE_FILE = /^edges\/([A-Za-z0-9_][A-Za-z0-9_.-]*?)(?:\.json|\/joined\.json)?$/;
const BATCH_DELAY = 120;

let stopWatching: (() => void) | null = null;
let root = '';
let watchedPath = '';
const dirtyNodes = new Set<string>();
const dirtyEdges = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let externalChanges = 0;

export async function startLiveSync(canvasPath: string) {
  stopLiveSync();
  watchedPath = canvasPath;
  root = normalizePath(canvasPath).replace(/\/$/, '');
  try {
    const { watch } = await import('@tauri-apps/plugin-fs');
    const unwatch = await watch(canvasPath, (event) => onPaths(event.paths), { recursive: true, delayMs: 150 });
    // The canvas may have been switched while the watcher was starting.
    if (watchedPath !== canvasPath) {
      unwatch();
      return;
    }
    stopWatching = unwatch;
  } catch (error) {
    console.warn('[live-sync] File watching unavailable:', error);
  }
}

export function stopLiveSync() {
  stopWatching?.();
  stopWatching = null;
  watchedPath = '';
  dirtyNodes.clear();
  dirtyEdges.clear();
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = null;
}

function onPaths(paths: string[]) {
  for (const raw of paths) {
    const path = normalizePath(raw);
    if (!path.startsWith(`${root}/`)) continue;
    const rel = path.slice(root.length + 1);
    const node = NODE_FILE.exec(rel);
    if (node) dirtyNodes.add(node[1]);
    const edge = EDGE_FILE.exec(rel);
    if (edge) dirtyEdges.add(edge[1]);
  }
  if ((dirtyNodes.size || dirtyEdges.size) && !batchTimer) {
    batchTimer = setTimeout(applyBatch, BATCH_DELAY);
  }
}

async function readIfChanged(...paths: string[]): Promise<'missing' | 'same' | 'changed'> {
  const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
  for (const path of paths) {
    if (await exists(path)) return isKnownContent(path, await readTextFile(path)) ? 'same' : 'changed';
  }
  return 'missing';
}

async function applyBatch() {
  batchTimer = null;
  const base = watchedPath;
  const nodeIds = [...dirtyNodes];
  const edgeIds = [...dirtyEdges];
  dirtyNodes.clear();
  dirtyEdges.clear();
  let applied = 0;

  for (const id of nodeIds) {
    if (hasPendingNodeSave(id)) continue;
    try {
      const state = await readIfChanged(`${base}/nodes/${id}.md`);
      if (base !== watchedPath) return;
      if (state === 'missing') {
        if (workspace.getNode(id)) {
          workspace.removeExternalNode(id);
          applied++;
        }
      } else if (state === 'changed') {
        const node = await readNodeFromDisk(id);
        if (node && base === watchedPath) {
          workspace.applyExternalNode(node);
          applied++;
        }
      }
    } catch (error) {
      console.warn(`[live-sync] Could not apply nodes/${id}.md:`, error);
    }
  }

  for (const id of edgeIds) {
    if (hasPendingEdgeSave(id)) continue;
    try {
      const state = await readIfChanged(`${base}/edges/${id}.json`, `${base}/edges/${id}/joined.json`);
      if (base !== watchedPath) return;
      if (state === 'missing') {
        if (workspace.getEdge(id)) {
          workspace.removeExternalEdge(id);
          applied++;
        }
      } else if (state === 'changed') {
        const edge = await loadEdge(id);
        if (edge && base === watchedPath) {
          workspace.applyExternalEdge(edge);
          applied++;
        }
      }
    } catch (error) {
      console.warn(`[live-sync] Could not apply edges/${id}:`, error);
    }
  }

  if (applied > 0) {
    externalChanges += applied;
    toast.info(`Canvas updated from disk`, { id: 'live-sync', description: `${applied} change${applied === 1 ? '' : 's'} applied` });
  }
}

/** Count of external changes applied since start (used by tests). */
export function externalChangeCount(): number {
  return externalChanges;
}
