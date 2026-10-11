// Canvas-space rects of every non-container node, shared by all edges for obstacle-aware routing.

import { absoluteRects, type Rect } from '@mosaicflow/vault-core';
import { workspace } from './workspace.svelte';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';

class EdgeObstacles {
  rects = $derived.by(() => {
    const sized = workspace.nodes.map((n) => ({
      ...n,
      width: n.measured?.width ?? n.width,
      height: n.measured?.height ?? n.height,
    }));
    const all = absoluteRects(sized);
    const out = new Map<string, Rect>();
    for (const n of workspace.nodes) {
      if (n.hidden || nodeRegistry.isContainer(n.type)) continue;
      const r = all.get(n.id);
      if (r) out.set(n.id, r);
    }
    return out;
  });
}

export const edgeObstacles = new EdgeObstacles();
