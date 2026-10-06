// Vault-wide knowledge index (search, [[wikilinks]], backlinks, #tags).
// Other canvases are read from disk; the open canvas comes from the live workspace.

import { CanvasRepository, KnowledgeIndex, type IndexCanvas } from '@mosaicflow/vault-core';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import { tauriFsAdapter } from '$lib/services/tauriFsAdapter';
import { vaultStore } from './vault.svelte';
import { workspace } from './workspace.svelte';

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
  private loadedKey = '';
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;

  /** (Re)reads every canvas from disk when the vault or its canvas list changed. */
  async loadVault(force = false) {
    const canvases = vaultStore.canvases;
    const key = canvases.map((c) => `${c.id}:${c.updated_at}`).join('|');
    if (!force && key === this.loadedKey) return this.compose();
    this.loadedKey = key;
    this.loading = true;
    const next = new Map<string, IndexCanvas>();
    for (const c of canvases) {
      try {
        const repo = new CanvasRepository(tauriFsAdapter, c.path, (type) => nodeRegistry.getBodyMapping(type));
        next.set(c.id, { id: c.id, name: c.name, nodes: await repo.readAllNodes() });
      } catch (error) {
        console.warn(`[knowledge] Skipping canvas ${c.name}:`, error);
      }
    }
    this.disk = next;
    this.loading = false;
    this.compose();
  }

  /** Debounced refresh of the open canvas (called when workspace nodes change). */
  scheduleLiveRefresh() {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => this.compose(), 400);
  }

  private compose() {
    const current = vaultStore.currentCanvas;
    const canvases = [...this.disk.values()].filter((c) => c.id !== current?.id);
    if (current) {
      canvases.push({
        id: current.id,
        name: current.name,
        nodes: workspace.nodes.map((n) => ({ id: n.id, type: n.type as string, data: n.data as Record<string, unknown> })),
      });
    }
    this.index = new KnowledgeIndex(canvases);
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
