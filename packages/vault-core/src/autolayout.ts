// Automatic layout for imported graphs, the "Tidy up" command and the MCP auto_layout tool.
// Layered layout (longest-path ranks + barycentre ordering) for graphs with edges, a grid otherwise.

import type { Point, Size } from './types';

export interface LayoutNode extends Size {
  id: string;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutOptions {
  direction?: 'LR' | 'TB';
  /** Space between layers (columns for LR). Leaves a lane for edges and labels. */
  layerGap?: number;
  /** Space between nodes in the same layer. */
  nodeGap?: number;
  /** Top-left corner of the result. */
  origin?: Point;
  /** Max columns when falling back to a grid. */
  gridColumns?: number;
}

/** Returns a top-left position per node id. */
export function autoLayout(nodes: LayoutNode[], edges: LayoutEdge[], options: LayoutOptions = {}): Map<string, Point> {
  const direction = options.direction ?? 'LR';
  const layerGap = options.layerGap ?? 160;
  const nodeGap = options.nodeGap ?? 60;
  const origin = options.origin ?? { x: 0, y: 0 };
  const ids = new Set(nodes.map((n) => n.id));
  const inner = edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target);

  if (inner.length === 0) return gridLayout(nodes, { ...options, origin });

  const out = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of breakCycles(nodes, inner)) {
    out.get(e.source)!.push(e.target);
    incoming.get(e.target)!.push(e.source);
  }

  // Longest-path layering keeps every edge pointing forward.
  const rank = new Map<string, number>();
  const visit = (id: string, stack = new Set<string>()): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (stack.has(id)) return 0;
    stack.add(id);
    const r = Math.max(-1, ...incoming.get(id)!.map((p) => visit(p, stack))) + 1;
    stack.delete(id);
    rank.set(id, r);
    return r;
  };
  nodes.forEach((n) => visit(n.id));

  const layers: string[][] = [];
  for (const n of nodes) (layers[rank.get(n.id)!] ??= []).push(n.id);

  // A few barycentre sweeps reduce crossings.
  const indexIn = (layer: string[]) => new Map(layer.map((id, i) => [id, i]));
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let l = 1; l < layers.length; l++) {
      const prev = indexIn(layers[l - 1]);
      layers[l] = sortByBarycentre(layers[l], (id) => incoming.get(id)!.map((p) => prev.get(p)).filter((v): v is number => v !== undefined));
    }
    for (let l = layers.length - 2; l >= 0; l--) {
      const next = indexIn(layers[l + 1]);
      layers[l] = sortByBarycentre(layers[l], (id) => out.get(id)!.map((c) => next.get(c)).filter((v): v is number => v !== undefined));
    }
  }

  const size = new Map(nodes.map((n) => [n.id, n]));
  const positions = new Map<string, Point>();
  const across = (id: string) => (direction === 'LR' ? size.get(id)!.height : size.get(id)!.width);
  const along = (id: string) => (direction === 'LR' ? size.get(id)!.width : size.get(id)!.height);
  const extents = layers.map((layer) => layer.reduce((s, id) => s + across(id), 0) + nodeGap * Math.max(0, layer.length - 1));
  const widest = Math.max(...extents);

  let main = 0;
  layers.forEach((layer, l) => {
    // Centre each layer on the widest one so the flow reads as a balanced tree.
    let cross = (widest - extents[l]) / 2;
    for (const id of layer) {
      positions.set(id, direction === 'LR'
        ? { x: origin.x + main, y: origin.y + cross }
        : { x: origin.x + cross, y: origin.y + main });
      cross += across(id) + nodeGap;
    }
    main += Math.max(...layer.map(along)) + layerGap;
  });

  // Isolated nodes go in a grid below/after the layered part.
  const isolated = nodes.filter((n) => !inner.some((e) => e.source === n.id || e.target === n.id));
  if (isolated.length > 0) {
    const placed = nodes.filter((n) => !isolated.includes(n));
    const maxY = Math.max(...placed.map((n) => positions.get(n.id)!.y + n.height));
    const grid = gridLayout(isolated, { ...options, origin: { x: origin.x, y: maxY + layerGap } });
    grid.forEach((p, id) => positions.set(id, p));
  }
  return snap(positions);
}

function sortByBarycentre(layer: string[], neighbours: (id: string) => number[]): string[] {
  const keyed = layer.map((id, i) => {
    const ns = neighbours(id);
    return { id, key: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : i };
  });
  return keyed.sort((a, b) => a.key - b.key).map((k) => k.id);
}

/** Drops back-edges found by DFS so the remaining graph is acyclic. */
function breakCycles(nodes: LayoutNode[], edges: LayoutEdge[]): LayoutEdge[] {
  const adj = new Map<string, LayoutEdge[]>();
  for (const e of edges) (adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e);
  const state = new Map<string, 1 | 2>();
  const keep: LayoutEdge[] = [];
  const dfs = (id: string) => {
    state.set(id, 1);
    for (const e of adj.get(id) ?? []) {
      const s = state.get(e.target);
      if (s === 1) continue;
      keep.push(e);
      if (!s) dfs(e.target);
    }
    state.set(id, 2);
  };
  nodes.forEach((n) => !state.has(n.id) && dfs(n.id));
  return keep;
}

export function gridLayout(nodes: LayoutNode[], options: LayoutOptions = {}): Map<string, Point> {
  const gap = options.nodeGap ?? 60;
  const origin = options.origin ?? { x: 0, y: 0 };
  const columns = options.gridColumns ?? Math.max(1, Math.ceil(Math.sqrt(nodes.length * 1.6)));
  const positions = new Map<string, Point>();
  let y = origin.y;
  for (let i = 0; i < nodes.length; i += columns) {
    const row = nodes.slice(i, i + columns);
    let x = origin.x;
    for (const n of row) {
      positions.set(n.id, { x, y });
      x += n.width + gap;
    }
    y += Math.max(...row.map((n) => n.height)) + gap;
  }
  return snap(positions);
}

/**
 * Places nodes in the given order, left to right, wrapping into rows so the result is roughly 16:10.
 * Suits pages made of a few large blocks (groups) where a layered layout would be one long strip.
 */
export function wrapLayout(nodes: LayoutNode[], options: LayoutOptions & { maxWidth?: number } = {}): Map<string, Point> {
  const gap = options.nodeGap ?? 160;
  const origin = options.origin ?? { x: 0, y: 0 };
  const area = nodes.reduce((s, n) => s + (n.width + gap) * (n.height + gap), 0);
  const widest = Math.max(0, ...nodes.map((n) => n.width));
  const maxWidth = Math.max(widest, options.maxWidth ?? Math.sqrt(area * 1.6));
  const positions = new Map<string, Point>();
  let x = origin.x;
  let y = origin.y;
  let rowHeight = 0;
  for (const n of nodes) {
    if (x > origin.x && x - origin.x + n.width > maxWidth) {
      x = origin.x;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    positions.set(n.id, { x, y });
    x += n.width + gap;
    rowHeight = Math.max(rowHeight, n.height);
  }
  return snap(positions);
}

function snap(positions: Map<string, Point>): Map<string, Point> {
  positions.forEach((p, id) => positions.set(id, { x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 }));
  return positions;
}
