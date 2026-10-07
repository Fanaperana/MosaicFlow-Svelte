// Vault-wide knowledge index (search, [[wikilinks]], backlinks, #tags).
// Other canvases are read from disk; the open canvas comes from the live workspace.

import { untrack } from 'svelte';
import { CanvasRepository, KnowledgeIndex, absoluteRects, type IndexCanvas, type Point } from '@mosaicflow/vault-core';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import { tauriFsAdapter } from '$lib/services/tauriFsAdapter';
import { vaultStore } from './vault.svelte';
import { workspace } from './workspace.svelte';

/** Absolute, canvas-space box of a node, used for mini-map previews. */
export interface MiniNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

type LayoutInput = { id: string; type: string; parentId?: string; position: Point; width?: number; height?: number; data: Record<string, unknown> };

function toMiniNodes(nodes: LayoutInput[]): MiniNode[] {
  const rects = absoluteRects(nodes);
  return nodes.map((n) => {
    const r = rects.get(n.id)!;
    const color = typeof n.data.borderColor === 'string' ? n.data.borderColor : undefined;
    return { id: n.id, type: n.type, x: r.x, y: r.y, width: r.width, height: r.height, color };
  });
}

class KnowledgeStore {
  index = $state.raw(new KnowledgeIndex([]));
  /** Canvas filter: words and/or #tags; non-matching nodes fade out. */
  filter = $state('');
  loading = $state(false);

  /** Tag of a single-tag filter ("#rust" -> "rust"), used to mark pills as active. */
  get activeTag(): string | null {
    const m = /^#([\w/-]+)$/.exec(this.filter.trim());
    return m ? m[1].toLowerCase() : null;
  }

  private disk = new Map<string, IndexCanvas>();
  private layouts = new Map<string, MiniNode[]>();
  private edges = new Map<string, { source: string; target: string }[]>();
  /** Canvas whose nodes are currently in the workspace (null while switching pages). */
  private liveCanvasId: string | null = null;
  private loadedKey = '';
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every rebuild so views (e.g. the graph) can react. */
  revision = $state(0);

  /** (Re)reads every canvas from disk when the vault or its canvas list changed. */
  async loadVault(force = false) {
    const canvases = vaultStore.canvases;
    const key = canvases.map((c) => `${c.id}:${c.updated_at}`).join('|');
    if (!force && key === this.loadedKey) return this.compose();
    this.loadedKey = key;
    this.loading = true;
    const next = new Map<string, IndexCanvas>();
    const layouts = new Map<string, MiniNode[]>();
    const edges = new Map<string, { source: string; target: string }[]>();
    for (const c of canvases) {
      try {
        const repo = new CanvasRepository(tauriFsAdapter, c.path, (type) => nodeRegistry.getBodyMapping(type));
        const nodes = await repo.readAllNodes();
        next.set(c.id, { id: c.id, name: c.name, nodes });
        layouts.set(c.id, toMiniNodes(nodes));
        edges.set(c.id, (await repo.readAllEdges().catch(() => [])).map((e) => ({ source: e.source, target: e.target })));
      } catch (error) {
        console.warn(`[knowledge] Skipping canvas ${c.name}:`, error);
      }
    }
    // The open page is newer in memory than on disk.
    if (this.liveCanvasId) {
      next.delete(this.liveCanvasId);
      layouts.delete(this.liveCanvasId);
      edges.delete(this.liveCanvasId);
    }
    for (const [id, canvas] of this.disk) if (id === this.liveCanvasId) next.set(id, canvas);
    this.disk = next;
    this.layouts = layouts;
    this.edges = edges;
    this.loading = false;
    this.compose();
  }

  /** The workspace now holds this canvas's nodes. */
  attachLive(canvasId: string) {
    this.liveCanvasId = canvasId;
    this.compose();
  }

  /** Snapshots the open canvas before the workspace is cleared, so links to its nodes keep resolving. */
  detachLive() {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.compose();
    this.liveCanvasId = null;
  }

  /** Canvas edges (connections drawn on the canvas) per canvas id. */
  canvasEdges(canvasId: string): { source: string; target: string }[] {
    return this.edges.get(canvasId) ?? [];
  }

  /** Node boxes of a canvas; the open canvas is read live from the workspace. */
  canvasLayout(canvasId: string): MiniNode[] {
    if (canvasId !== this.liveCanvasId) return this.layouts.get(canvasId) ?? [];
    return toMiniNodes(this.liveLayoutInput());
  }

  private liveLayoutInput() {
    return workspace.nodes.map((n) => ({
      id: n.id,
      type: n.type as string,
      parentId: n.parentId,
      position: n.position,
      width: n.width ?? n.measured?.width,
      height: n.height ?? n.measured?.height,
      data: n.data as Record<string, unknown>,
    }));
  }

  /** Debounced refresh of the open canvas (called when workspace nodes change). */
  scheduleLiveRefresh() {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => this.compose(), 400);
  }

  private compose() {
    // Called from effects: reading the workspace here must not subscribe them to it.
    untrack(() => this.composeNow());
  }

  private composeNow() {
    // Fold the live workspace into the per-canvas snapshot so it survives page switches.
    const live = this.liveCanvasId ? vaultStore.canvases.find((c) => c.id === this.liveCanvasId) : undefined;
    if (live) {
      const input = this.liveLayoutInput();
      this.disk.set(live.id, { id: live.id, name: live.name, nodes: input.map(({ id, type, data }) => ({ id, type, data })) });
      this.layouts.set(live.id, toMiniNodes(input));
      this.edges.set(live.id, workspace.edges.map((e) => ({ source: e.source, target: e.target })));
    }
    // Names may have changed (rename) since the snapshot was taken.
    const canvases = [...this.disk.values()].map((c) => {
      const info = vaultStore.canvases.find((v) => v.id === c.id);
      return info && info.name !== c.name ? { ...c, name: info.name } : c;
    }).filter((c) => vaultStore.canvases.some((v) => v.id === c.id));
    this.index = new KnowledgeIndex(canvases);
    this.revision++;
  }

  toggleTag(tag: string | null) {
    this.filter = tag && this.activeTag !== tag ? `#${tag}` : '';
  }

  /** Ids of open-canvas nodes matching the filter (null when no filter is set). */
  matchingNodeIds(canvasId: string | undefined): Set<string> | null {
    if (!this.filter.trim() || !canvasId) return null;
    return new Set(this.index.search(this.filter, { canvasId, limit: 10_000 }).map((h) => h.node.id));
  }
}

export const knowledge = new KnowledgeStore();
