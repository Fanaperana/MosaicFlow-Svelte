// Manual page order for the sidebar, kept in the vault (.mosaicflow/page-order.json) so it travels with it.
// Pages not in the list (new or created elsewhere) follow in their usual order.

import type { CanvasInfo } from '$lib/services/vaultService';

const FILE = '.mosaicflow/page-order.json';

class PageOrder {
  ids = $state<string[]>([]);
  private vault: string | null = null;

  async load(vaultPath: string | null) {
    if (vaultPath === this.vault) return;
    this.vault = vaultPath;
    this.ids = [];
    if (!vaultPath) return;
    try {
      const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
      const path = `${vaultPath}/${FILE}`;
      if (!(await exists(path))) return;
      const raw = JSON.parse(await readTextFile(path));
      if (this.vault === vaultPath && Array.isArray(raw)) this.ids = raw.filter((id): id is string => typeof id === 'string');
    } catch {
      // Unreadable order file: fall back to the default order.
    }
  }

  sort(canvases: CanvasInfo[]): CanvasInfo[] {
    const rank = new Map(this.ids.map((id, i) => [id, i]));
    return canvases
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (rank.get(a.c.id) ?? Infinity) - (rank.get(b.c.id) ?? Infinity) || a.i - b.i)
      .map(({ c }) => c);
  }

  /** Moves a page to `index` in the shown list and saves the whole order. */
  async move(shown: CanvasInfo[], id: string, index: number) {
    const ids = shown.map((c) => c.id).filter((x) => x !== id);
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
    this.ids = ids;
    if (!this.vault) return;
    const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
    await mkdir(`${this.vault}/.mosaicflow`, { recursive: true });
    await writeTextFile(`${this.vault}/${FILE}`, JSON.stringify(ids, null, 2));
  }
}

export const pageOrder = new PageOrder();
