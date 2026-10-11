// Orthogonal edge routing around nodes: A* over a sparse grid built from the obstacles' edges,
// with a penalty per bend so routes stay simple. Pure functions; no Svelte or xyflow state.

export type Side = 'left' | 'right' | 'top' | 'bottom';
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DIR: Record<Side, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
const MARGIN = 12;
const STUB = 14;
const BEND_COST = 60;
const REGION_PAD = 320;
const MAX_OBSTACLES = 60;

function inside(p: Point, r: Rect): boolean {
  return p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
}

function inflate(r: Rect, m: number): Rect {
  return { x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m };
}

/** Points along xyflow's default bezier (same control-point offsets), for hit-testing. */
export function sampleBezier(s: Point, sSide: Side, t: Point, tSide: Side, steps = 24): Point[] {
  const control = (p: Point, side: Side, other: Point): Point => {
    const d = DIR[side];
    const distance = d.x !== 0 ? (other.x - p.x) * d.x : (other.y - p.y) * d.y;
    const offset = distance >= 0 ? 0.5 * distance : 0.25 * 25 * Math.sqrt(-distance);
    return { x: p.x + d.x * offset, y: p.y + d.y * offset };
  };
  const c1 = control(s, sSide, t);
  const c2 = control(t, tSide, s);
  const points: Point[] = [];
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u ** 2, d = u ** 3;
    points.push({ x: a * s.x + b * c1.x + c * c2.x + d * t.x, y: a * s.y + b * c1.y + c * c2.y + d * t.y });
  }
  return points;
}

/** True when any sampled point of the path falls inside an obstacle. */
export function hitsObstacle(points: Point[], obstacles: Rect[]): boolean {
  return points.some((p) => obstacles.some((r) => inside(p, inflate(r, 4))));
}

/** Points of a straight segment, for hit-testing straight edges. */
export function sampleLine(s: Point, t: Point, steps = 24): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < steps; i++) out.push({ x: s.x + ((t.x - s.x) * i) / steps, y: s.y + ((t.y - s.y) * i) / steps });
  return out;
}

class Heap<T> {
  private items: { key: number; value: T }[] = [];
  get size() {
    return this.items.length;
  }
  push(key: number, value: T) {
    const a = this.items;
    a.push({ key, value });
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p].key <= a[i].key) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0].value;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].key < a[m].key) m = l;
        if (r < a.length && a[r].key < a[m].key) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Orthogonal route from a source handle to a target handle that keeps clear of `obstacles`
 * (the source and target nodes should not be in the list). Returns null when no route exists.
 */
export function routeOrthogonal(source: Point, sourceSide: Side, target: Point, targetSide: Side, obstacles: Rect[]): Point[] | null {
  const sd = DIR[sourceSide];
  const td = DIR[targetSide];
  const start = { x: source.x + sd.x * STUB, y: source.y + sd.y * STUB };
  const end = { x: target.x + td.x * STUB, y: target.y + td.y * STUB };

  const region = {
    x: Math.min(start.x, end.x) - REGION_PAD,
    y: Math.min(start.y, end.y) - REGION_PAD,
    width: Math.abs(start.x - end.x) + 2 * REGION_PAD,
    height: Math.abs(start.y - end.y) + 2 * REGION_PAD,
  };
  const blocks = obstacles
    .filter((r) => r.x < region.x + region.width && r.x + r.width > region.x && r.y < region.y + region.height && r.y + r.height > region.y)
    .slice(0, MAX_OBSTACLES)
    // Nodes packed right next to a handle keep their exact outline so the route can still leave.
    .map((r) => {
      const wide = inflate(r, MARGIN);
      return inside(start, wide) || inside(end, wide) ? r : wide;
    });
  if (blocks.some((b) => inside(start, b) || inside(end, b))) return null;

  const xs = [...new Set([start.x, end.x, (start.x + end.x) / 2, ...blocks.flatMap((b) => [b.x, b.x + b.width])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, (start.y + end.y) / 2, ...blocks.flatMap((b) => [b.y, b.y + b.height])])].sort((a, b) => a - b);
  const W = xs.length;
  const H = ys.length;
  const free = (x: number, y: number) => !blocks.some((b) => inside({ x, y }, b));
  const open = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) open[j * W + i] = free(xs[i], ys[j]) ? 1 : 0;

  const si = xs.indexOf(start.x), sj = ys.indexOf(start.y);
  const ei = xs.indexOf(end.x), ej = ys.indexOf(end.y);
  const steps: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dirIndex = (dx: number, dy: number) => steps.findIndex(([a, b]) => a === dx && b === dy);
  const startDir = dirIndex(sd.x, sd.y);
  const arriveDir = dirIndex(-td.x, -td.y);

  // State = cell * 4 + direction of travel.
  const cost = new Float64Array(W * H * 4).fill(Infinity);
  const prev = new Int32Array(W * H * 4).fill(-1);
  const heap = new Heap<number>();
  const h = (i: number, j: number) => Math.abs(xs[i] - end.x) + Math.abs(ys[j] - end.y);
  const first = (sj * W + si) * 4 + startDir;
  cost[first] = 0;
  heap.push(h(si, sj), first);

  let goal = -1;
  while (heap.size) {
    const state = heap.pop()!;
    const cell = state >> 2;
    const dir = state & 3;
    const i = cell % W, j = (cell / W) | 0;
    if (i === ei && j === ej && dir === arriveDir) {
      goal = state;
      break;
    }
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = steps[d];
      if (dx === -steps[dir][0] && dy === -steps[dir][1]) continue; // no U-turns
      const ni = i + dx, nj = j + dy;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || !open[nj * W + ni]) continue;
      if (!free((xs[i] + xs[ni]) / 2, (ys[j] + ys[nj]) / 2)) continue;
      const next = (nj * W + ni) * 4 + d;
      const extra = d === dir ? 0 : BEND_COST;
      const c = cost[state] + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + extra;
      if (c < cost[next]) {
        cost[next] = c;
        prev[next] = state;
        heap.push(c + h(ni, nj), next);
      }
    }
  }
  if (goal < 0) return null;

  const cells: Point[] = [];
  for (let s = goal; s >= 0; s = prev[s]) {
    const cell = s >> 2;
    cells.push({ x: xs[cell % W], y: ys[(cell / W) | 0] });
  }
  cells.reverse();
  return simplify([source, ...cells, target]);
}

/** Drops repeated and collinear points. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    const before = out[out.length - 2];
    if (before && last && ((before.x === last.x && last.x === p.x) || (before.y === last.y && last.y === p.y))) out.pop();
    out.push(p);
  }
  return out;
}

/** SVG path through orthogonal points with rounded corners, plus the point halfway along it. */
export function roundedPath(points: Point[], radius = 10): { path: string; mid: Point } {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let k = 1; k < points.length - 1; k++) {
    const [a, b, c] = [points[k - 1], points[k], points[k + 1]];
    const r = Math.min(radius, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    const inX = b.x - Math.sign(b.x - a.x) * r, inY = b.y - Math.sign(b.y - a.y) * r;
    const outX = b.x + Math.sign(c.x - b.x) * r, outY = b.y + Math.sign(c.y - b.y) * r;
    d += ` L ${inX} ${inY} Q ${b.x} ${b.y} ${outX} ${outY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;

  const lengths = points.slice(1).map((p, k) => Math.hypot(p.x - points[k].x, p.y - points[k].y));
  let half = lengths.reduce((s, l) => s + l, 0) / 2;
  let mid = points[0];
  for (let k = 0; k < lengths.length; k++) {
    if (half <= lengths[k]) {
      const t = lengths[k] ? half / lengths[k] : 0;
      mid = { x: points[k].x + (points[k + 1].x - points[k].x) * t, y: points[k].y + (points[k + 1].y - points[k].y) * t };
      break;
    }
    half -= lengths[k];
  }
  return { path: d, mid };
}
