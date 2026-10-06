import type { Point, Size } from './types';

export interface Rect extends Point, Size {}

export interface PlacementOptions {
  /** Place next to this rect (e.g. a related node); otherwise to the right of everything. */
  near?: Rect;
  /** Minimum empty space between nodes. */
  gap?: number;
  /** Grid step used while searching for free space. */
  step?: number;
  /** How many search rings to try before falling back to below all nodes. */
  maxRings?: number;
  /** Smallest allowed top-left corner (e.g. a group's inner padding). */
  min?: Point;
}

/** Stable sort so every node comes after its ancestors (required by subflow renderers). */
export function orderParentsFirst<T extends { id: string; parentId?: string }>(nodes: T[]): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = (node: T): number => {
    let d = 0;
    let parent = node.parentId ? byId.get(node.parentId) : undefined;
    while (parent && d < nodes.length) {
      d++;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return d;
  };
  return nodes
    .map((node, index) => ({ node, index, depth: depth(node) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map((entry) => entry.node);
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/** Canvas-space rects for every node (positions of children are relative to their parent). */
export function absoluteRects<T extends { id: string; parentId?: string; position: Point; width?: number; height?: number }>(
  nodes: T[],
  fallback: Size = { width: 200, height: 120 }
): Map<string, Rect> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, Rect>();
  const resolve = (node: T, depth = 0): Rect => {
    const cached = out.get(node.id);
    if (cached) return cached;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const origin = parent && depth < nodes.length ? resolve(parent, depth + 1) : { x: 0, y: 0 };
    const rect = {
      x: origin.x + node.position.x,
      y: origin.y + node.position.y,
      width: node.width ?? fallback.width,
      height: node.height ?? fallback.height,
    };
    out.set(node.id, rect);
    return rect;
  };
  nodes.forEach((n) => resolve(n));
  return out;
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Finds the closest position to the anchor where `size` does not overlap any `occupied` rect.
 * All rects must share one coordinate space (canvas space, or the same parent's space).
 */
export function findFreePosition(occupied: Rect[], size: Size, options: PlacementOptions = {}): Point {
  const gap = options.gap ?? 40;
  const step = options.step ?? 40;
  const maxRings = options.maxRings ?? 40;

  const all = boundsOf(occupied);
  const anchor: Point = options.near
    ? { x: options.near.x + options.near.width + gap, y: options.near.y }
    : all
      ? { x: all.x + all.width + gap, y: all.y }
      : { x: 0, y: 0 };

  const min = options.min;
  const fits = (p: Point) =>
    (!min || (p.x >= min.x && p.y >= min.y)) && !occupied.some((r) => rectsOverlap({ ...p, ...size }, r, gap));

  for (let ring = 0; ring <= maxRings; ring++) {
    const candidates: Point[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        candidates.push({ x: anchor.x + dx * step, y: anchor.y + dy * step });
      }
    }
    candidates.sort(
      (a, b) =>
        Math.abs(a.x - anchor.x) + Math.abs(a.y - anchor.y) -
        (Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y))
    );
    const hit = candidates.find(fits);
    if (hit) return hit;
  }

  return all ? { x: all.x, y: all.y + all.height + gap } : anchor;
}
