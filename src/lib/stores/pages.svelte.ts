// Page (canvas) navigation: back/forward history, recently opened pages, and the pages sidebar.

import { vaultStore } from './vault.svelte';
import { workspace } from './workspace.svelte';
import type { CanvasInfo } from '$lib/services/vaultService';
import { renameCanvas as renameCanvasApi } from '$lib/services/vaultService';
import { flushPendingSaves as flushNodeSaves } from '$lib/services/nodeFileService';
import { flushPendingSaves as flushEdgeSaves } from '$lib/services/edgeFileService';

const SIDEBAR_KEY = 'mosaicflow:pages-sidebar';
const RECENTS_KEY = 'mosaicflow:recent-pages';
const MAX_HISTORY = 50;
const MAX_RECENTS = 8;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; navigation still works for this session.
  }
}

class PageNavigation {
  backStack = $state<string[]>([]);
  forwardStack = $state<string[]>([]);
  sidebarOpen = $state(readJson(SIDEBAR_KEY, true));
  /** Recently opened canvas ids per vault path, most recent first. */
  private recents = $state<Record<string, string[]>>(readJson(RECENTS_KEY, {}));

  private current: string | null = null;
  private vaultPath: string | null = null;
  private traveling = false;

  get canGoBack(): boolean {
    return this.backStack.length > 0;
  }

  get canGoForward(): boolean {
    return this.forwardStack.length > 0;
  }

  /** Recently opened canvases of the current vault that still exist. */
  get recentCanvases(): CanvasInfo[] {
    const ids = this.recents[vaultStore.currentVault?.path ?? ''] ?? [];
    return ids.map((id) => vaultStore.canvases.find((c) => c.id === id)).filter((c): c is CanvasInfo => !!c);
  }

  /** Records that a canvas became current (called whenever the open canvas changes). */
  visit(canvasId: string) {
    const vaultPath = vaultStore.currentVault?.path ?? null;
    if (vaultPath !== this.vaultPath) {
      this.vaultPath = vaultPath;
      this.backStack = [];
      this.forwardStack = [];
      this.current = null;
    }
    if (canvasId === this.current) {
      this.traveling = false;
      return;
    }

    if (this.traveling) {
      this.traveling = false;
    } else if (this.current) {
      this.backStack = [...this.backStack, this.current].slice(-MAX_HISTORY);
      this.forwardStack = [];
    }
    this.current = canvasId;

    if (vaultPath) {
      const list = [canvasId, ...(this.recents[vaultPath] ?? []).filter((id) => id !== canvasId)].slice(0, MAX_RECENTS);
      this.recents = { ...this.recents, [vaultPath]: list };
      writeJson(RECENTS_KEY, this.recents);
    }
  }

  goBack() {
    this.travel('back');
  }

  goForward() {
    this.travel('forward');
  }

  private travel(direction: 'back' | 'forward') {
    const stack = direction === 'back' ? [...this.backStack] : [...this.forwardStack];
    let target: CanvasInfo | undefined;
    // Skip entries whose canvas was deleted meanwhile.
    while (stack.length && !target) {
      const id = direction === 'back' ? stack.pop()! : stack.shift()!;
      target = vaultStore.canvases.find((c) => c.id === id);
    }

    const from = this.current;
    if (direction === 'back') {
      this.backStack = stack;
      if (target && from) this.forwardStack = [from, ...this.forwardStack];
    } else {
      this.forwardStack = stack;
      if (target && from) this.backStack = [...this.backStack, from];
    }
    if (!target) return;

    this.traveling = true;
    vaultStore.openCanvas(target);
  }

  toggleSidebar(open = !this.sidebarOpen) {
    this.sidebarOpen = open;
    writeJson(SIDEBAR_KEY, open);
  }

  /** Renames any canvas; the open one is flushed first because its folder moves on disk. */
  async renameCanvas(canvas: CanvasInfo, name: string): Promise<boolean> {
    const next = name.trim();
    if (!next || next === canvas.name) return false;

    if (vaultStore.currentCanvas?.id === canvas.id) {
      await Promise.all([flushNodeSaves(), flushEdgeSaves()]);
      const ok = await vaultStore.renameCurrentCanvas(next);
      if (ok && vaultStore.currentCanvas) {
        workspace.name = next;
        workspace.initFileServices(vaultStore.currentCanvas.path);
      }
      return ok;
    }

    const updated = await renameCanvasApi(canvas.path, next);
    if (!updated) return false;
    vaultStore.canvases = vaultStore.canvases.map((c) => (c.id === canvas.id ? updated : c));
    return true;
  }
}

export const pageNav = new PageNavigation();
