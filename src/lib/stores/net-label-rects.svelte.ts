// Where node net labels are drawn, so edge labels can steer clear of them.

import { absoluteRects, type Rect } from '@mosaicflow/vault-core';
import { workspace } from './workspace.svelte';

class NetLabelRects {
  /** Tag boxes per node, relative to the node's top-left corner. */
  local = $state<Record<string, Rect[]>>({});

  /** Tag boxes in canvas coordinates. */
  absolute = $derived.by(() => {
    const ids = Object.keys(this.local);
    if (!ids.length) return [] as Rect[];
    const origins = absoluteRects(workspace.nodes);
    return ids.flatMap((id) => {
      const o = origins.get(id);
      return o ? this.local[id].map((r) => ({ ...r, x: r.x + o.x, y: r.y + o.y })) : [];
    });
  });

  set(nodeId: string, rects: Rect[]) {
    const prev = this.local[nodeId];
    if (!rects.length) {
      if (prev) {
        const next = { ...this.local };
        delete next[nodeId];
        this.local = next;
      }
      return;
    }
    if (prev && JSON.stringify(prev) === JSON.stringify(rects)) return;
    this.local = { ...this.local, [nodeId]: rects };
  }
}

export const netLabelRects = new NetLabelRects();

/**
 * Tags of edges shown as labels, in canvas coordinates. An edge only avoids edges whose id sorts
 * before its own, so placements settle in one pass instead of pushing each other back and forth.
 */
class EdgeTagRects {
  byEdge = $state<Record<string, Rect[]>>({});

  before(edgeId: string): Rect[] {
    return Object.entries(this.byEdge).flatMap(([id, rects]) => (id < edgeId ? rects : []));
  }

  set(edgeId: string, rects: Rect[]) {
    const prev = this.byEdge[edgeId];
    if (!rects.length && !prev) return;
    if (prev && JSON.stringify(prev) === JSON.stringify(rects)) return;
    const next = { ...this.byEdge };
    if (rects.length) next[edgeId] = rects;
    else delete next[edgeId];
    this.byEdge = next;
  }
}

export const edgeTagRects = new EdgeTagRects();
