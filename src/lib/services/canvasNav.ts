// Keyboard navigation between nodes: moves the selection to the nearest node in a direction.

import { absoluteRects } from '@mosaicflow/vault-core';
import { workspace } from '$lib/stores/workspace.svelte';
import { settings } from '$lib/stores/settings.svelte';

export type NavDirection = 'left' | 'right' | 'up' | 'down';

type Point = { x: number; y: number };

function centerOf(r: { x: number; y: number; width: number; height: number }): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Distance along the direction plus a penalty for drifting sideways; null when behind. */
function score(from: Point, to: Point, dir: NavDirection): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const [main, side] = dir === 'left' ? [-dx, dy] : dir === 'right' ? [dx, dy] : dir === 'up' ? [-dy, dx] : [dy, dx];
  if (main <= 1) return null;
  return main + Math.abs(side) * 2;
}

function viewportCenter(): Point {
  const pane = document.querySelector('.svelte-flow')?.getBoundingClientRect();
  const { x, y, zoom } = workspace.viewport;
  return pane ? { x: (pane.width / 2 - x) / zoom, y: (pane.height / 2 - y) / zoom } : { x: 0, y: 0 };
}

export function selectInDirection(dir: NavDirection) {
  const rects = absoluteRects(workspace.nodes);
  const currentId = workspace.selectedNodeIds.at(-1);
  const current = currentId ? rects.get(currentId) : undefined;

  let candidates = [...rects.keys()].filter((id) => id !== currentId && !workspace.getNode(id)?.hidden);
  if (current && settings.current.canvas.keyboardNav === 'connected') {
    const linked = new Set(
      workspace.edges.flatMap((e) => (e.source === currentId ? [e.target] : e.target === currentId ? [e.source] : [])),
    );
    candidates = candidates.filter((id) => linked.has(id));
  }

  const from = current ? centerOf(current) : viewportCenter();
  let best: { id: string; s: number } | null = null;
  for (const id of candidates) {
    const to = centerOf(rects.get(id)!);
    // Without a selection, pick the node nearest the middle of the screen.
    const s = current ? score(from, to, dir) : Math.hypot(to.x - from.x, to.y - from.y);
    if (s !== null && (!best || s < best.s)) best = { id, s };
  }
  if (!best) return;
  workspace.setSelectedNodes([best.id]);
  window.dispatchEvent(new CustomEvent('mosaicflow:revealNode', { detail: { id: best.id } }));
}
