// Canvas operations exposed as MCP tools. Plain async methods so they can be tested without a transport.

import {
  DESIGN_GUIDE,
  KnowledgeIndex,
  absoluteRects,
  autoLayout,
  gridLayout,
  wrapLayout,
  importMermaid,
  boundsOf,
  buildEdge,
  bestSides,
  estimateTextSize,
  facingSides,
  handlePoint,
  handleSide,
  rectsOverlap,
  routeCost,
  routeScore,
  findFreePosition,
  isPaletteName,
  nodeText,
  paletteCard,
  paletteColor,
  paletteGroup,
  type CanvasRepository,
  type EdgeLook,
  type NodeTypeSchema,
  type Rect,
  type Side,
  type SideChoice,
  type SideUsage,
  type StoredEdge,
  type StoredNode,
  type VaultRepository,
} from '@mosaicflow/vault-core';

const GROUP_PAD = { side: 30, top: 60, bottom: 30 };
const FALLBACK_SIZE = { width: 300, height: 200 };
/** Routes longer than this (px) are suggested as net labels by check_layout. */
const LONG_EDGE = 2400;
const SAFE_ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

// What markdown fields (note.content, callout.content, notes, ...) render in the app.
const MARKDOWN_GUIDE = {
  basics: 'Headings, **bold**, *italic*, ~~strike~~, `inline code`, > quotes, lists, - [ ] task lists, --- dividers, [links](https://...) and ![images](url).',
  tables: 'GFM tables: | a | b | then | --- | --- |; :---: centres a column, ---: right-aligns it.',
  code: '```lang fenced blocks are syntax-highlighted (rust, ts, python, sql, bash, ...).',
  math: 'LaTeX via KaTeX: $E = mc^2$ inline (no space after the opening $), $$ ... $$ on their own lines or a ```math block for display equations.',
  diagrams: '```mermaid blocks render as diagrams: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, timeline, gitGraph.',
  links: '[[Node title]], [[Canvas#Node title]], [[Canvas]] or [[node-id]] link nodes and pages; #tags are collected vault-wide.',
  tips: 'Notes render in view mode by default; long notes need a taller node (see design.rules). Diagrams need ~300px of height each.',
};

export interface EdgeStyleInput {
  color?: string;
  palette?: string;
  /** 'auto' (or omitted) picks the shape from the geometry; anything else is kept through re-layouts. */
  path?: EdgeLook['path'] | 'auto';
  stroke?: EdgeLook['stroke'];
  animated?: boolean;
  start?: EdgeLook['start'];
  end?: EdgeLook['end'];
  width?: number;
  /** 'label' shows a named tag at each end instead of a line (KiCad-style net label). */
  display?: 'line' | 'label';
  labelEnd?: 'sharp' | 'rounded' | 'none';
}

export interface CreateNodeInput {
  canvas: string;
  type: string;
  title: string;
  data?: Record<string, unknown>;
  id?: string;
  palette?: string;
  parentId?: string;
  near?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface UpdateNodeInput {
  canvas: string;
  id: string;
  title?: string;
  data?: Record<string, unknown>;
  palette?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  parentId?: string | null;
}

export interface ConnectInput {
  canvas: string;
  source: string;
  target: string;
  label?: string;
  id?: string;
  sourceSide?: Side;
  targetSide?: Side;
  style?: EdgeStyleInput;
}

export interface BuildKnowledgeInput {
  canvas: string;
  description?: string;
  tags?: string[];
  groups?: { key: string; title: string; palette?: string }[];
  nodes: { key: string; type: string; title: string; data?: Record<string, unknown>; palette?: string; group?: string; size?: { width: number; height: number }; labels?: string[] }[];
  edges?: { from: string; to: string; label?: string; style?: EdgeStyleInput }[];
  layout?: 'LR' | 'TB' | 'none';
  story?: boolean;
}

export interface NetStyleInput {
  end?: 'sharp' | 'rounded' | 'none';
  endSide?: 'outer' | 'inner' | 'both';
  color?: string;
  palette?: string;
  textColor?: string;
  bgColor?: string;
  fontSize?: number;
}

/** A named tag on a node side; every label with the same name on a canvas is one net (many-to-many). */
interface NetLabel {
  id: string;
  name: string;
  side?: Side;
  end?: 'sharp' | 'rounded' | 'none';
  endSide?: 'outer' | 'inner' | 'both';
  color?: string;
  textColor?: string;
  bgColor?: string;
  fontSize?: number;
}

const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];
const STYLE_KEYS = ['end', 'endSide', 'color', 'textColor', 'bgColor', 'fontSize'] as const;

function netLabelsOf(n: StoredNode): NetLabel[] {
  return Array.isArray(n.data.netLabels) ? (n.data.netLabels as NetLabel[]) : [];
}

/** Accepts labels as names or {name, side?, ...style}; drops blanks and duplicates on one side. */
function normalizeNetLabels(value: unknown): NetLabel[] {
  if (!Array.isArray(value)) return [];
  const out: NetLabel[] = [];
  for (const raw of value) {
    const item = (typeof raw === 'string' ? { name: raw } : raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 64) : '';
    if (!name) continue;
    const label: NetLabel = { id: typeof item.id === 'string' && item.id ? item.id : globalThis.crypto.randomUUID(), name };
    if (SIDES.includes(item.side as Side)) label.side = item.side as Side;
    if (item.end === 'sharp' || item.end === 'rounded' || item.end === 'none') label.end = item.end;
    if (item.endSide === 'outer' || item.endSide === 'inner' || item.endSide === 'both') label.endSide = item.endSide;
    for (const key of ['color', 'textColor', 'bgColor'] as const) if (typeof item[key] === 'string') label[key] = item[key] as string;
    if (typeof item.fontSize === 'number' && item.fontSize >= 8 && item.fontSize <= 24) label.fontSize = item.fontSize;
    if (!out.some((l) => l.name === name && l.side === label.side)) out.push(label);
  }
  return out;
}

/** Members of every net on a canvas: node labels plus both ends of edges shown as labels. */
function netsOf(nodes: StoredNode[], edges: StoredEdge[]): Map<string, string[]> {
  const nets = new Map<string, string[]>();
  const add = (name: string, id: string) => {
    const list = nets.get(name) ?? [];
    if (!list.includes(id)) list.push(id);
    nets.set(name, list);
  };
  for (const n of nodes) for (const l of netLabelsOf(n)) add(l.name, n.id);
  for (const e of edges) {
    if ((e.data as Record<string, unknown> | undefined)?.display !== 'label') continue;
    const name = (typeof e.label === 'string' && e.label.trim()) || 'NET';
    add(name, e.source);
    add(name, e.target);
  }
  return nets;
}

/** Nets as implicit links for layout: members of a net are chained so they end up near each other. */
function netLinks(nodes: StoredNode[]): { source: string; target: string }[] {
  const links: { source: string; target: string }[] = [];
  for (const ids of netsOf(nodes, []).values()) for (let i = 1; i < ids.length; i++) links.push({ source: ids[i - 1], target: ids[i] });
  return links;
}

/** The side of `id` facing the other members of its net (right when it is alone). */
function facingSide(nodes: StoredNode[], id: string, others: string[]): Side {
  const rects = absoluteRects(nodes, FALLBACK_SIZE);
  const me = rects.get(id);
  const peers = others.filter((o) => o !== id).map((o) => rects.get(o)).filter((r): r is Rect => !!r);
  if (!me || !peers.length) return 'right';
  const cx = peers.reduce((s, r) => s + r.x + r.width / 2, 0) / peers.length - (me.x + me.width / 2);
  const cy = peers.reduce((s, r) => s + r.y + r.height / 2, 0) / peers.length - (me.y + me.height / 2);
  return Math.abs(cx) >= Math.abs(cy) ? (cx >= 0 ? 'right' : 'left') : cy >= 0 ? 'bottom' : 'top';
}

/** Gives labels without a side the side facing their net, and shares the net's style with new members. */
function settleNetLabels(nodes: StoredNode[], node: StoredNode) {
  const labels = normalizeNetLabels(node.data.netLabels);
  if (!labels.length) {
    delete node.data.netLabels;
    return;
  }
  const nets = netsOf(nodes.filter((n) => n.id !== node.id), []);
  node.data.netLabels = labels.map((l) => {
    const peer = nodes.flatMap((n) => (n.id === node.id ? [] : netLabelsOf(n))).find((p) => p.name === l.name);
    const shared = peer ? Object.fromEntries(STYLE_KEYS.filter((k) => peer[k] !== undefined && l[k] === undefined).map((k) => [k, peer[k]])) : {};
    return { end: 'sharp', ...shared, ...l, side: l.side ?? facingSide(nodes, node.id, nets.get(l.name) ?? []) };
  });
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function uniqueId(base: string, taken: Set<string>): string {
  const root = slugify(base) || 'node';
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

/** Moves siblings that `id` now overlaps (and those they then overlap) below it; returns the moved nodes. */
function pushOverlappedSiblings(nodes: StoredNode[], id: string, gap = 40): StoredNode[] {
  const size = (n: StoredNode) => ({ w: n.width ?? FALLBACK_SIZE.width, h: n.height ?? FALLBACK_SIZE.height });
  const moved = new Set<StoredNode>();
  const queue = [nodes.find((n) => n.id === id)].filter((n): n is StoredNode => !!n);
  for (let guard = 0; queue.length && guard < 1000; guard++) {
    const a = queue.shift()!;
    const bottom = a.position.y + size(a).h;
    for (const b of nodes) {
      if (b === a || b.parentId !== a.parentId || b.position.y < a.position.y) continue;
      const sideBySide = a.position.x < b.position.x + size(b).w && b.position.x < a.position.x + size(a).w;
      if (!sideBySide || b.position.y >= bottom) continue;
      b.position = { x: b.position.x, y: bottom + gap };
      moved.add(b);
      queue.push(b);
    }
  }
  return [...moved];
}

function edgeLook(style: EdgeStyleInput = {}, fallbackColor = '#94a3b8'): EdgeLook {
  const color = style.color ?? (style.palette && isPaletteName(style.palette) ? paletteColor(style.palette) : fallbackColor);
  return { color, path: style.path === 'auto' ? undefined : style.path, stroke: style.stroke, animated: style.animated, start: style.start, end: style.end, width: style.width };
}

type EdgePath = NonNullable<EdgeLook['path']>;

/** Sets an edge's shape; `fixed` marks a shape the caller chose so re-layouts keep it. */
function setEdgePath(e: StoredEdge, path: EdgePath, fixed: boolean) {
  e.type = path === 'bezier' ? 'default' : path;
  const data: Record<string, unknown> = { ...(e.data ?? {}), pathType: path };
  if (fixed) data.fixedPath = true;
  else delete data.fixedPath;
  e.data = data;
}

// Default sizes ignore the text, so long notes and code would be clipped and then grow over their neighbours in the app.
function fitContent(base: { width: number; height: number }, data: Record<string, unknown> = {}) {
  let height = base.height;
  if (typeof data.content === 'string' && data.content) {
    const diagrams = data.content.match(/```mermaid/g)?.length ?? 0;
    height = Math.max(height, estimateTextSize(data.content, base.width).height + diagrams * 260);
  }
  if (typeof data.code === 'string' && data.code) height = Math.max(height, data.code.split('\n').length * 18 + 70);
  return { width: base.width, height: Math.min(height, 1600) };
}

/**
 * Returns a function that picks handle sides for an edge: the pair with the shortest route around the other
 * nodes, preferring sides that other edges of the same nodes don't use yet. Groups are not obstacles.
 */
function sidePicker(nodes: StoredNode[], edges: StoredEdge[]) {
  const rects = absoluteRects(nodes, FALLBACK_SIZE);
  const containers = new Set(nodes.filter((n) => n.type === 'group' || nodes.some((c) => c.parentId === n.id)).map((n) => n.id));
  const usage = (id: string, skipEdge?: string): SideUsage => {
    const used: SideUsage = {};
    for (const e of edges) {
      if (e.id === skipEdge) continue;
      const side = e.source === id ? handleSide(e.sourceHandle) : e.target === id ? handleSide(e.targetHandle) : undefined;
      if (side) used[side] = (used[side] ?? 0) + 1;
    }
    return used;
  };
  const obstaclesFor = (source: string, target: string) =>
    nodes.filter((n) => !containers.has(n.id) && n.id !== source && n.id !== target).map((n) => rects.get(n.id)!);
  const pick = (source: string, target: string, edgeId?: string): SideChoice => {
    const a = rects.get(source)!;
    const b = rects.get(target)!;
    return bestSides(a, b, obstaclesFor(source, target), { source: usage(source, edgeId), target: usage(target, edgeId) }) ?? { ...facingSides(a, b), length: 0, bends: 0 };
  };
  return Object.assign(pick, { rects, obstaclesFor });
}

/**
 * Edge shape from the geometry: straight when the handles face each other on one line, a step for a drop
 * into a row below or above, a bezier for a short hop, and a rounded step for longer routes with turns.
 */
function pathFor(a: { x: number; y: number; width: number; height: number }, b: typeof a, sides: SideChoice): EdgePath {
  const p = handlePoint(a, sides.source);
  const q = handlePoint(b, sides.target);
  const horizontal = (sides.source === 'right' && sides.target === 'left') || (sides.source === 'left' && sides.target === 'right');
  const vertical = (sides.source === 'bottom' && sides.target === 'top') || (sides.source === 'top' && sides.target === 'bottom');
  if ((horizontal && Math.abs(p.y - q.y) < 24) || (vertical && Math.abs(p.x - q.x) < 24)) return 'straight';
  if (vertical) return 'step';
  if (sides.bends <= 2 && sides.length > 0 && sides.length < 360) return 'bezier';
  return 'smoothstep';
}

/** Re-picks sides (unless pinned) and shapes (unless chosen by the caller) of the matching edges; returns the changed ones. */
function rerouteEdges(nodes: StoredNode[], edges: StoredEdge[], which: (e: StoredEdge) => boolean) {
  const changed: StoredEdge[] = [];
  const rects = absoluteRects(nodes, FALLBACK_SIZE);
  // Usage is read live, so each edge sees the sides already taken by the previous ones.
  const pick = sidePicker(nodes, edges);
  for (const e of edges) {
    if (!which(e) || e.data?.fixedSides || !rects.has(e.source) || !rects.has(e.target)) continue;
    const sides = pick(e.source, e.target, e.id);
    const sourceHandle = `${sides.source}-source`;
    const targetHandle = `${sides.target}-target`;
    let dirty = e.sourceHandle !== sourceHandle || e.targetHandle !== targetHandle;
    e.sourceHandle = sourceHandle;
    e.targetHandle = targetHandle;
    if (!e.data?.fixedPath) {
      const path = pathFor(rects.get(e.source)!, rects.get(e.target)!, sides);
      if (e.data?.pathType !== path) dirty = true;
      setEdgePath(e, path, false);
    }
    if (dirty) changed.push(e);
  }
  return changed;
}

/** The automatic shape for an edge with its current sides. */
function autoPath(nodes: StoredNode[], edges: StoredEdge[], e: StoredEdge): EdgePath {
  const pick = sidePicker(nodes, edges);
  const a = pick.rects.get(e.source);
  const b = pick.rects.get(e.target);
  const source = handleSide(e.sourceHandle);
  const target = handleSide(e.targetHandle);
  if (!a || !b || !source || !target) return 'smoothstep';
  const cost = routeCost(a, source, b, target, pick.obstaclesFor(e.source, e.target)) ?? { length: 0, bends: 99 };
  return pathFor(a, b, { source, target, ...cost });
}

function applyEdgeStyle(e: StoredEdge, s: EdgeStyleInput, nodes: StoredNode[], edges: StoredEdge[]) {
  const data = { ...(e.data ?? {}) };
  if (s.color || s.palette) {
    const color = edgeLook(s, String(data.color ?? '#94a3b8')).color;
    data.color = color;
    data.labelColor = color;
  }
  if (s.stroke) data.strokeStyle = s.stroke;
  if (s.width) data.strokeWidth = s.width;
  if (s.start) data.markerStart = s.start;
  if (s.end) data.markerEnd = s.end;
  if (s.animated !== undefined) data.animated = s.animated;
  if (s.display) data.display = s.display;
  if (s.labelEnd) data.labelEnd = s.labelEnd;
  e.data = data;
  e.animated = !!data.animated;
  if (s.path === 'auto') setEdgePath(e, autoPath(nodes, edges, e), false);
  else if (s.path) setEdgePath(e, s.path, true);
}

export class MosaicOps {
  constructor(private readonly vault: VaultRepository) {}

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  async nodeTypes(): Promise<NodeTypeSchema[]> {
    return (await this.vault.readNodeTypes())?.nodeTypes ?? [];
  }

  async guide() {
    const doc = await this.vault.readNodeTypes();
    return {
      workflow: [
        'Call list_canvases, then read_canvas (detail "summary") before editing an existing canvas.',
        'To create a whole map at once, use build_knowledge (groups + nodes + edges + layout in one call). Use the single-node tools below for small edits.',
        'Create nodes with create_node; omit position to auto-place without overlap (use "near" to place beside a related node, "parentId" to put it inside a group).',
        'Size nodes so content is never clipped (see design.rules); start from the type defaultSize.',
        'Group related nodes with create_group and give each category one palette name.',
        'Connect with connect and leave the sides out: the server routes around other nodes and picks the best handle sides (read_canvas shows them as from/to).',
        'Relate nodes that sit far apart, or many-to-many, with net labels instead of long edges: label_nodes tags each node with the same name (like KiCad net labels); read_canvas lists them under "nets", layouts keep their members close, and the app links them on hover. build_knowledge nodes take labels: ["name"] too.',
        'Finish with set_story_order so the Story view walks the canvas in a sensible order, then check_layout (fix: true) so nothing overlaps and every edge takes a clean route; auto_layout if the canvas got messy.',
        'Link related notes with [[Node title]] in text and tag them with #tag; get_links shows outgoing links and backlinks.',
        'Rename a node with update_node (title); its id never changes, so links and edges keep working. Rename, retag, describe or lock a canvas with update_canvas.',
        'Changes are written to the vault and appear live in the MosaicFlow app.',
      ],
      markdown: MARKDOWN_GUIDE,
      design: doc?.design ?? DESIGN_GUIDE,
      paletteNames: Object.keys(DESIGN_GUIDE.palette),
      nodeTypes: (doc?.nodeTypes ?? []).map((t) => ({
        type: t.type,
        label: t.label,
        category: t.category,
        purpose: t.knowledge?.purpose ?? t.description,
        bodyField: t.knowledge?.bodyField ?? 'notes',
        fields: t.knowledge?.fields ?? {},
        defaultSize: t.defaultSize,
        capabilities: t.capabilities,
      })),
      ...(doc ? {} : { warning: 'node-types.json not found: open this vault once in MosaicFlow to export node type schemas.' }),
    };
  }

  async listCanvases() {
    return (await this.vault.listCanvases()).map((c) => ({
      id: c.id, name: c.name, description: c.description, tags: c.tags, updatedAt: c.updated_at,
    }));
  }

  async createCanvas(spec: { name: string; description?: string; tags?: string[] }) {
    const { entry } = await this.vault.createCanvas(spec);
    return { id: entry.id, name: entry.name };
  }

  async updateCanvas(spec: { canvas: string; name?: string; description?: string; tags?: string[]; locked?: boolean }) {
    const entry = await this.vault.updateCanvas(spec.canvas, {
      name: spec.name,
      description: spec.description,
      tags: spec.tags,
      ...(spec.locked === undefined ? {} : { settings: { locked: spec.locked } }),
    });
    const file = await this.vault.readCanvasFile(entry);
    return { id: entry.id, name: entry.name, description: entry.description, tags: entry.tags, locked: !!file?.settings?.locked };
  }

  async deleteCanvas(ref: string, confirm: string) {
    const entry = await this.vault.findCanvas(ref);
    if (confirm.trim() !== entry.name) throw new Error(`To delete, pass confirm: "${entry.name}" (the exact canvas name)`);
    const deleted = await this.vault.deleteCanvas(entry.id);
    return { deleted: { id: deleted.id, name: deleted.name } };
  }

  async readCanvas(ref: string, detail: 'summary' | 'full' = 'summary') {
    const { entry, repo } = await this.vault.openCanvas(ref);
    const nodes = await repo.readAllNodes();
    const edges = await repo.readAllEdges();
    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    const file = await this.vault.readCanvasFile(entry);
    const nets = netsOf(nodes, edges);
    return {
      canvas: { id: entry.id, name: entry.name, description: entry.description, tags: entry.tags, locked: !!file?.settings?.locked },
      coordinates: 'x/y/width/height are absolute canvas coordinates; "position" is relative to "parent" when set. Edges leave the source from "from" side and enter the target on the "to" side.',
      ...(nets.size ? { nets: Object.fromEntries(nets), netsNote: 'Nodes sharing a net label name are related, like an edge without a line.' } : {}),
      nodes: nodes.map((n) => {
        const r = rects.get(n.id)!;
        const labels = netLabelsOf(n);
        const base = {
          id: n.id,
          type: n.type,
          title: String(n.data.title ?? ''),
          ...(n.parentId ? { parent: n.parentId, position: n.position } : {}),
          x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
          ...(typeof n.data.order === 'number' ? { order: n.data.order } : {}),
          ...(labels.length ? { labels: labels.map((l) => ({ name: l.name, side: l.side })) } : {}),
        };
        if (detail === 'full') return { ...base, data: n.data };
        const text = nodeText(n.data).replace(String(n.data.title ?? ''), '').replace(/\s+/g, ' ').trim();
        return { ...base, preview: text.length > 160 ? `${text.slice(0, 160)}…` : text };
      }),
      edges: edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        ...(e.label ? { label: e.label } : {}),
        from: handleSide(e.sourceHandle), to: handleSide(e.targetHandle),
        ...(detail === 'full' ? { type: e.type, data: e.data } : {}),
      })),
    };
  }

  /**
   * Finds what makes a canvas hard to read: overlapping nodes, children sticking out of their group, and
   * edges whose sides make a longer or blocked route than the best available. With fix, repairs them.
   */
  async checkLayout(canvas: string, fix = false) {
    const { entry, repo, nodes } = await this.open(canvas);
    const edges = await repo.readAllEdges();
    const pick = sidePicker(nodes, edges);
    const rects = pick.rects;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const isAncestor = (a: string, b: string) => {
      for (let p = byId.get(b)?.parentId, i = 0; p && i < 50; p = byId.get(p)?.parentId, i++) if (p === a) return true;
      return false;
    };
    const contains = (outer: Rect, inner: Rect) =>
      inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

    const overlaps: { a: string; b: string }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const [a, b] = [nodes[i], nodes[j]];
        if (isAncestor(a.id, b.id) || isAncestor(b.id, a.id)) continue;
        if (rectsOverlap(rects.get(a.id)!, rects.get(b.id)!)) overlaps.push({ a: a.id, b: b.id });
      }
    }
    const outside = nodes
      .filter((n) => n.parentId && rects.has(n.parentId) && !contains(rects.get(n.parentId)!, rects.get(n.id)!))
      .map((n) => ({ node: n.id, group: n.parentId! }));

    const edgeIssues: { edge: string; from?: Side; to?: Side; suggested: { from: Side; to: Side }; reason: string }[] = [];
    const longEdges: { edge: string; length: number }[] = [];
    for (const e of edges) {
      if (e.data?.fixedSides || !rects.has(e.source) || !rects.has(e.target)) continue;
      const from = handleSide(e.sourceHandle);
      const to = handleSide(e.targetHandle);
      const best = pick(e.source, e.target, e.id);
      if (e.data?.display !== 'label' && best.length > LONG_EDGE) longEdges.push({ edge: e.id, length: best.length });
      const suggested = { from: best.source, to: best.target };
      if (!from || !to) {
        edgeIssues.push({ edge: e.id, suggested, reason: 'missing handle sides' });
        continue;
      }
      if (from === best.source && to === best.target) continue;
      const current = routeCost(rects.get(e.source)!, from, rects.get(e.target)!, to, pick.obstaclesFor(e.source, e.target));
      if (!current) edgeIssues.push({ edge: e.id, from, to, suggested, reason: 'no clear route between these sides' });
      else if (routeScore(current) > routeScore(best) * 1.25 + 80) {
        edgeIssues.push({ edge: e.id, from, to, suggested, reason: `route ${current.length}px with ${current.bends} bends; suggested ${best.length}px with ${best.bends}` });
      }
    }

    let fixed = 0;
    if (fix) {
      for (const { a, b } of overlaps) {
        const [na, nb] = [byId.get(a)!, byId.get(b)!];
        if (na.parentId !== nb.parentId) continue;
        const upper = na.position.y <= nb.position.y ? na : nb;
        for (const moved of pushOverlappedSiblings(nodes, upper.id)) {
          await repo.writeNode(moved);
          fixed++;
        }
      }
      for (const { group } of outside) await this.growToFit(repo, nodes, group);
      fixed += outside.length;
      const flagged = new Set(edgeIssues.map((i) => i.edge));
      for (const e of rerouteEdges(nodes, edges, (x) => flagged.has(x.id))) {
        await repo.writeEdge(e);
        fixed++;
      }
      await this.vault.touchCanvas(entry);
    }

    const cap = <T>(list: T[]) => list.slice(0, 40);
    return {
      ok: overlaps.length + outside.length + edgeIssues.length === 0,
      overlaps: cap(overlaps),
      outsideGroup: cap(outside),
      edges: cap(edgeIssues),
      ...(longEdges.length
        ? { longEdges: cap(longEdges), longEdgeHint: 'These cross much of the canvas; consider style_edges with display "label" (net labels) for them.' }
        : {}),
      ...(fix ? { fixed } : overlaps.length + outside.length + edgeIssues.length ? { hint: 'Call check_layout with fix: true to repair these.' } : {}),
    };
  }

  async search(query: string, opts: { canvas?: string; limit?: number; match?: 'all' | 'any' } = {}) {
    const index = await this.buildIndex();
    const canvasId = opts.canvas ? (await this.vault.findCanvas(opts.canvas)).id : undefined;
    return index.search(query, { canvasId, limit: opts.limit ?? 20, match: opts.match }).map((h) => ({
      canvas: h.node.canvasName, nodeId: h.node.id, type: h.node.type, title: h.node.title, tags: h.node.tags, snippet: h.snippet, score: h.score,
    }));
  }

  /** Full content of specific nodes (any canvases) with their resolved links and backlinks, for answering questions. */
  async readNodes(refs: { canvas: string; nodeId: string }[]) {
    const index = await this.buildIndex();
    const canvases = await this.vault.listCanvases();
    const ref = (n: { canvasName: string; id: string; title: string }) => ({ canvas: n.canvasName, nodeId: n.id, title: n.title });
    return refs.map(({ canvas, nodeId }) => {
      const lower = canvas.trim().toLowerCase();
      const entry = canvases.find((c) => c.id === canvas || c.name.toLowerCase() === lower || c.folder.toLowerCase() === lower);
      const node = entry && index.nodes.find((n) => n.canvasId === entry.id && n.id === nodeId);
      if (!entry || !node) return { canvas, nodeId, error: 'not found' };
      return {
        canvas: node.canvasName,
        nodeId: node.id,
        type: node.type,
        title: node.title,
        tags: node.tags,
        text: node.text,
        links: index.outgoing(entry.id, node.id).flatMap(({ node: target }) => (target ? [ref(target)] : [])),
        backlinks: index.backlinks(entry.id, node.id).map(ref),
      };
    });
  }

  private async buildIndex(): Promise<KnowledgeIndex> {
    const canvases = [];
    for (const c of await this.vault.listCanvases()) {
      const { repo } = await this.vault.openCanvas(c.id);
      canvases.push({ id: c.id, name: c.name, nodes: await repo.readAllNodes() });
    }
    return new KnowledgeIndex(canvases);
  }

  async links(canvas: string, nodeId: string) {
    const entry = await this.vault.findCanvas(canvas);
    const index = await this.buildIndex();
    if (!index.nodes.some((n) => n.canvasId === entry.id && n.id === nodeId)) throw new Error(`Node "${nodeId}" not found`);
    const ref = (n: { canvasName: string; id: string; title: string }) => ({ canvas: n.canvasName, nodeId: n.id, title: n.title });
    return {
      syntax: 'Link nodes by writing [[Node title]] (or [[Canvas name#Node title]], [[Title|label]]) in any text field; tag with #tag or data.tags.',
      outgoing: index.outgoing(entry.id, nodeId).map(({ link, node }) => ({ text: link.raw, resolved: node ? ref(node) : null })),
      backlinks: index.backlinks(entry.id, nodeId).map(ref),
    };
  }

  async tags(canvas?: string) {
    const index = await this.buildIndex();
    const canvasId = canvas ? (await this.vault.findCanvas(canvas)).id : undefined;
    return index.tagCounts(canvasId);
  }

  // ---------------------------------------------------------------------------
  // Nodes
  // ---------------------------------------------------------------------------

  private async open(ref: string) {
    const { entry, repo } = await this.vault.openCanvas(ref);
    return { entry, repo, nodes: await repo.readAllNodes() };
  }

  private async typeSchema(type: string): Promise<NodeTypeSchema | undefined> {
    const types = await this.nodeTypes();
    if (types.length === 0) return undefined;
    const schema = types.find((t) => t.type === type);
    if (!schema) throw new Error(`Unknown node type "${type}". Available: ${types.map((t) => t.type).join(', ')}`);
    return schema;
  }

  private async isContainer(type: string) {
    return type === 'group' || !!(await this.nodeTypes()).find((t) => t.type === type)?.capabilities?.container;
  }

  /**
   * Enlarges a container (and its ancestors) so all children fit with padding; never shrinks.
   * Children above or left of the padding are shifted in and the container moves the other way, so nothing moves on screen.
   */
  private async growToFit(repo: CanvasRepository, nodes: StoredNode[], parentId: string | undefined) {
    for (let id = parentId, depth = 0; id && depth < 20; depth++) {
      const parent = nodes.find((n) => n.id === id);
      if (!parent) return;
      const children = nodes.filter((n) => n.parentId === id);
      const bounds = boundsOf(children.map((c) => ({ ...c.position, width: c.width ?? FALLBACK_SIZE.width, height: c.height ?? FALLBACK_SIZE.height })));
      if (!bounds) return;
      const dx = Math.max(0, GROUP_PAD.side - bounds.x);
      const dy = Math.max(0, GROUP_PAD.top - bounds.y);
      if (dx || dy) {
        for (const c of children) {
          c.position = { x: c.position.x + dx, y: c.position.y + dy };
          await repo.writeNode(c);
        }
        parent.position = { x: parent.position.x - dx, y: parent.position.y - dy };
      }
      const width = Math.max((parent.width ?? 0) + dx, bounds.x + dx + bounds.width + GROUP_PAD.side);
      const height = Math.max((parent.height ?? 0) + dy, bounds.y + dy + bounds.height + GROUP_PAD.bottom);
      if (dx || dy || width !== parent.width || height !== parent.height) {
        parent.width = width;
        parent.height = height;
        await repo.writeNode(parent);
        for (const moved of pushOverlappedSiblings(nodes, parent.id)) await repo.writeNode(moved);
      }
      id = parent.parentId;
    }
  }

  async createNode(input: CreateNodeInput) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const schema = await this.typeSchema(input.type);
    const taken = new Set(nodes.map((n) => n.id));
    // Placing beside a node that sits in a group puts the new node in that group too.
    if (input.parentId === undefined && input.near && !input.position) {
      input = { ...input, parentId: nodes.find((n) => n.id === input.near)?.parentId };
    }

    const id = input.id ?? uniqueId(input.title || input.type, taken);
    if (!SAFE_ID.test(id)) throw new Error(`Invalid id "${id}"`);
    if (taken.has(id)) throw new Error(`A node with id "${id}" already exists`);

    if (input.parentId) {
      const parent = nodes.find((n) => n.id === input.parentId);
      if (!parent) throw new Error(`Parent "${input.parentId}" not found`);
      if (!(await this.isContainer(parent.type))) throw new Error(`"${input.parentId}" (${parent.type}) cannot contain nodes`);
    }
    if (input.palette && !isPaletteName(input.palette)) {
      throw new Error(`Unknown palette "${input.palette}". Use one of: ${Object.keys(DESIGN_GUIDE.palette).join(', ')}`);
    }

    const size = input.size ?? fitContent(schema?.defaultSize ?? FALLBACK_SIZE, input.data);
    const container = await this.isContainer(input.type);
    const style = input.palette && isPaletteName(input.palette)
      ? (container ? paletteGroup(input.palette) : paletteCard(input.palette, { text: input.palette === 'amber' }))
      : {};
    const data: Record<string, unknown> = {
      ...(schema?.defaultData ?? {}),
      ...style,
      ...(input.data ?? {}),
      title: input.title,
      ...(container ? { label: input.data?.label ?? input.title } : {}),
    };

    let position = input.position;
    if (!position) {
      const siblings = nodes.filter((n) => n.parentId === input.parentId);
      const occupied: Rect[] = siblings.map((n) => ({ ...n.position, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height }));
      let near: Rect | undefined;
      if (input.near) {
        const rects = absoluteRects(nodes, FALLBACK_SIZE);
        const nearRect = rects.get(input.near);
        if (!nearRect) throw new Error(`"near" node "${input.near}" not found`);
        const origin = input.parentId ? rects.get(input.parentId)! : { x: 0, y: 0 };
        near = { ...nearRect, x: nearRect.x - origin.x, y: nearRect.y - origin.y };
      }
      position = input.parentId && occupied.length === 0
        ? { x: GROUP_PAD.side, y: GROUP_PAD.top }
        : findFreePosition(occupied, size, {
            near,
            gap: input.parentId ? 30 : 60,
            ...(input.parentId ? { min: { x: GROUP_PAD.side, y: GROUP_PAD.top } } : {}),
          });
    }

    const node: StoredNode = {
      id,
      type: input.type,
      position,
      width: size.width,
      height: size.height,
      zIndex: container ? -1 : 1,
      ...(input.parentId ? { parentId: input.parentId } : {}),
      data,
    };
    if (data.netLabels !== undefined) settleNetLabels([...nodes, node], node);
    await repo.writeNode(node);
    nodes.push(node);
    await this.growToFit(repo, nodes, input.parentId);
    await this.vault.touchCanvas(entry);
    const rect = absoluteRects(nodes, FALLBACK_SIZE).get(id)!;
    return { id, ...rect };
  }

  async updateNode(input: UpdateNodeInput) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const node = nodes.find((n) => n.id === input.id);
    if (!node) throw new Error(`Node "${input.id}" not found`);
    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    const oldParent = node.parentId;

    if (input.palette) {
      if (!isPaletteName(input.palette)) throw new Error(`Unknown palette "${input.palette}"`);
      Object.assign(node.data, (await this.isContainer(node.type)) ? paletteGroup(input.palette) : paletteCard(input.palette, { text: input.palette === 'amber' }));
    }
    for (const [key, value] of Object.entries(input.data ?? {})) {
      if (value === null) delete node.data[key];
      else node.data[key] = value;
    }
    if (input.title !== undefined) node.data.title = input.title;
    if (input.size) {
      node.width = input.size.width;
      node.height = input.size.height;
    }

    if (input.parentId !== undefined && input.parentId !== (node.parentId ?? null)) {
      const abs = rects.get(node.id)!;
      if (input.parentId === null) {
        delete node.parentId;
        delete node.extent;
        node.position = { x: abs.x, y: abs.y };
      } else {
        const parent = nodes.find((n) => n.id === input.parentId);
        if (!parent) throw new Error(`Parent "${input.parentId}" not found`);
        if (!(await this.isContainer(parent.type))) throw new Error(`"${input.parentId}" cannot contain nodes`);
        if (parent.id === node.id || this.isDescendant(nodes, parent.id, node.id)) throw new Error('A node cannot be placed inside itself');
        const origin = rects.get(parent.id)!;
        node.parentId = parent.id;
        node.position = { x: abs.x - origin.x, y: abs.y - origin.y };
      }
    }
    if (input.position) node.position = input.position;
    if (input.data && 'netLabels' in input.data) settleNetLabels(nodes, node);

    await repo.writeNode(node);
    if (input.size || input.position || input.parentId !== undefined) {
      for (const moved of pushOverlappedSiblings(nodes, node.id)) await repo.writeNode(moved);
    }
    await this.growToFit(repo, nodes, node.parentId);
    if (oldParent !== node.parentId) await this.growToFit(repo, nodes, oldParent);
    if (input.size || input.position || input.parentId !== undefined) {
      const edges = await repo.readAllEdges();
      for (const e of rerouteEdges(nodes, edges, (e) => e.source === node.id || e.target === node.id)) await repo.writeEdge(e);
    }
    await this.vault.touchCanvas(entry);
    return { id: node.id, ...absoluteRects(nodes, FALLBACK_SIZE).get(node.id)! };
  }

  private isDescendant(nodes: StoredNode[], id: string, ancestor: string): boolean {
    let current = nodes.find((n) => n.id === id);
    for (let i = 0; current?.parentId && i < nodes.length; i++) {
      if (current.parentId === ancestor) return true;
      current = nodes.find((n) => n.id === current!.parentId);
    }
    return false;
  }

  async deleteNode(canvas: string, id: string) {
    const { entry, repo, nodes } = await this.open(canvas);
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Node "${id}" not found`);
    const rects = absoluteRects(nodes, FALLBACK_SIZE);

    // Children of a deleted container stay where they are on the canvas.
    const children = nodes.filter((n) => n.parentId === id);
    for (const child of children) {
      const abs = rects.get(child.id)!;
      const origin = node.parentId ? rects.get(node.parentId)! : { x: 0, y: 0 };
      child.position = { x: abs.x - origin.x, y: abs.y - origin.y };
      if (node.parentId) child.parentId = node.parentId;
      else delete child.parentId;
      delete child.extent;
      await repo.writeNode(child);
    }

    const edges = (await repo.readAllEdges()).filter((e) => e.source === id || e.target === id);
    for (const e of edges) await repo.deleteEdge(e.id);
    await repo.deleteNode(id);
    await this.vault.touchCanvas(entry);
    return { deleted: id, removedEdges: edges.map((e) => e.id), detachedChildren: children.map((c) => c.id) };
  }

  // ---------------------------------------------------------------------------
  // Edges
  // ---------------------------------------------------------------------------

  async connect(input: ConnectInput) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const source = nodes.find((n) => n.id === input.source);
    const target = nodes.find((n) => n.id === input.target);
    if (!source) throw new Error(`Source node "${input.source}" not found`);
    if (!target) throw new Error(`Target node "${input.target}" not found`);
    if (source.id === target.id) throw new Error('Cannot connect a node to itself');

    const types = await this.nodeTypes();
    for (const n of [source, target]) {
      if (types.find((t) => t.type === n.type)?.capabilities?.connectable === false) {
        throw new Error(`"${n.id}" (${n.type}) has no connection handles`);
      }
    }

    const edges = await repo.readAllEdges();
    if (edges.some((e) => e.source === source.id && e.target === target.id)) {
      throw new Error(`"${source.id}" is already connected to "${target.id}"; use update_edge to change it`);
    }

    const sides = sidePicker(nodes, edges)(source.id, target.id);
    const taken = new Set(edges.map((e) => e.id));
    const id = input.id ?? uniqueId(`e-${source.id}-${target.id}`, taken);
    if (!SAFE_ID.test(id) || taken.has(id)) throw new Error(`Invalid or duplicate edge id "${id}"`);

    const targetBorder = typeof target.data.borderColor === 'string' ? target.data.borderColor : undefined;
    const edge = buildEdge(
      id, source.id, target.id, input.label ?? '',
      `${input.sourceSide ?? sides.source}-source`,
      `${input.targetSide ?? sides.target}-target`,
      edgeLook(input.style, targetBorder)
    );
    // Sides the caller chose stay put when nodes move or the page is re-laid out; so does a chosen shape.
    if (input.sourceSide || input.targetSide) edge.data = { ...edge.data, fixedSides: true };
    if (input.style?.display) edge.data = { ...edge.data, display: input.style.display };
    if (input.style?.labelEnd) edge.data = { ...edge.data, labelEnd: input.style.labelEnd };
    const chosen = { source: handleSide(edge.sourceHandle)!, target: handleSide(edge.targetHandle)! };
    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    const explicit = input.style?.path && input.style.path !== 'auto' ? input.style.path : undefined;
    setEdgePath(edge, explicit ?? pathFor(rects.get(source.id)!, rects.get(target.id)!, { ...sides, ...chosen }), !!explicit);
    await repo.writeEdge(edge);
    await this.vault.touchCanvas(entry);
    return { id, sourceSide: chosen.source, targetSide: chosen.target, path: edge.data!.pathType, routeLength: sides.length, bends: sides.bends };
  }

  async updateEdge(input: { canvas: string; id: string; label?: string; style?: EdgeStyleInput; sourceSide?: Side; targetSide?: Side }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const edges = await repo.readAllEdges();
    const edge = edges.find((e) => e.id === input.id);
    if (!edge) throw new Error(`Edge "${input.id}" not found`);
    if (input.label !== undefined) edge.label = input.label;
    if (input.sourceSide) edge.sourceHandle = `${input.sourceSide}-source`;
    if (input.targetSide) edge.targetHandle = `${input.targetSide}-target`;
    if (input.sourceSide || input.targetSide) edge.data = { ...(edge.data ?? {}), fixedSides: true };
    applyEdgeStyle(edge, input.style ?? {}, nodes, edges);
    // New sides change the best automatic shape too.
    if ((input.sourceSide || input.targetSide) && !edge.data?.fixedPath) setEdgePath(edge, autoPath(nodes, edges, edge), false);
    await repo.writeEdge(edge);
    await this.vault.touchCanvas(entry);
    return { id: edge.id, path: edge.data?.pathType, from: handleSide(edge.sourceHandle), to: handleSide(edge.targetHandle) };
  }

  /** Applies one style to many edges: all of a canvas, or those matching ids, a node they touch or a label. */
  async styleEdges(input: { canvas: string; edgeIds?: string[]; node?: string; label?: string; style: EdgeStyleInput }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const edges = await repo.readAllEdges();
    const label = input.label?.trim().toLowerCase();
    const matches = edges.filter((e) =>
      (!input.edgeIds || input.edgeIds.includes(e.id)) &&
      (!input.node || e.source === input.node || e.target === input.node) &&
      (!label || String(e.label ?? '').trim().toLowerCase() === label)
    );
    for (const e of matches) {
      applyEdgeStyle(e, input.style, nodes, edges);
      await repo.writeEdge(e);
    }
    await this.vault.touchCanvas(entry);
    const paths: Record<string, number> = {};
    for (const e of matches) paths[String(e.data?.pathType)] = (paths[String(e.data?.pathType)] ?? 0) + 1;
    return { styled: matches.length, paths };
  }

  private async faceNetLabels(canvas: string, targets: Map<string, Set<string>>) {
    const { entry, repo, nodes } = await this.open(canvas);
    const nets = netsOf(nodes, []);
    for (const [id, names] of targets) {
      const n = nodes.find((x) => x.id === id);
      if (!n) continue;
      n.data.netLabels = netLabelsOf(n).map((l) => (names.has(l.name) ? { ...l, side: facingSide(nodes, id, nets.get(l.name) ?? []) } : l));
      await repo.writeNode(n);
    }
    await this.vault.touchCanvas(entry);
  }

  /**
   * Net labels: tag nodes with a shared name so they read as connected without drawing a line (many-to-many).
   * Adds the label to `nodes` (side facing the rest of the net unless given), or removes it with remove: true
   * (from `nodes`, or from the whole canvas when nodes is omitted). `style` restyles every label of the net.
   */
  async labelNodes(input: { canvas: string; name: string; nodes?: (string | { id: string; side?: Side })[]; remove?: boolean; style?: NetStyleInput }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const edges = await repo.readAllEdges();
    const name = input.name.trim().slice(0, 64);
    if (!name) throw new Error('Label name is empty');
    const targets = (input.nodes ?? []).map((t) => (typeof t === 'string' ? { id: t } : t));
    for (const t of targets) if (!nodes.some((n) => n.id === t.id)) throw new Error(`Node "${t.id}" not found`);
    const changed = new Set<StoredNode>();

    if (input.remove) {
      const only = targets.length ? new Set(targets.map((t) => t.id)) : null;
      for (const n of nodes) {
        const before = netLabelsOf(n);
        const after = before.filter((l) => l.name !== name || (only && !only.has(n.id)));
        if (after.length === before.length) continue;
        if (after.length) n.data.netLabels = after;
        else delete n.data.netLabels;
        changed.add(n);
      }
    } else {
      if (!targets.length) throw new Error('Give the nodes to label');
      const members = [...new Set([...(netsOf(nodes, edges).get(name) ?? []), ...targets.map((t) => t.id)])];
      for (const t of targets) {
        const n = nodes.find((x) => x.id === t.id)!;
        const labels = netLabelsOf(n);
        const side = t.side ?? facingSide(nodes, n.id, members);
        if (labels.some((l) => l.name === name && l.side === side)) continue;
        n.data.netLabels = [...labels, { id: globalThis.crypto.randomUUID(), name, side }];
        settleNetLabels(nodes, n);
        changed.add(n);
      }
    }

    if (input.style && !input.remove) {
      const { palette, ...rest } = input.style;
      if (palette && !isPaletteName(palette)) throw new Error(`Unknown palette "${palette}"`);
      const style: Omit<NetStyleInput, 'palette'> = { ...rest, ...(palette && isPaletteName(palette) && !rest.color ? { color: paletteColor(palette) } : {}) };
      for (const n of nodes) {
        if (!netLabelsOf(n).some((l) => l.name === name)) continue;
        n.data.netLabels = netLabelsOf(n).map((l) => (l.name === name ? { ...l, ...style } : l));
        changed.add(n);
      }
      for (const e of edges) {
        const data = (e.data ?? {}) as Record<string, unknown>;
        if (data.display !== 'label' || ((typeof e.label === 'string' && e.label.trim()) || 'NET') !== name) continue;
        e.data = {
          ...data,
          ...(style.end ? { labelEnd: style.end } : {}),
          ...(style.endSide ? { labelEndSide: style.endSide } : {}),
          ...(style.color ? { color: style.color } : {}),
          ...(style.textColor ? { labelColor: style.textColor } : {}),
          ...(style.bgColor ? { labelBgColor: style.bgColor } : {}),
          ...(style.fontSize ? { labelFontSize: style.fontSize } : {}),
        };
        await repo.writeEdge(e);
      }
    }

    for (const n of changed) await repo.writeNode(n);
    if (changed.size) await this.vault.touchCanvas(entry);
    return {
      net: name,
      members: nodes.flatMap((n) => netLabelsOf(n).filter((l) => l.name === name).map((l) => ({ id: n.id, side: l.side }))),
      changedNodes: changed.size,
    };
  }

  async deleteEdge(canvas: string, id: string) {
    const { entry, repo } = await this.vault.openCanvas(canvas);
    if (!(await repo.readEdge(id))) throw new Error(`Edge "${id}" not found`);
    await repo.deleteEdge(id);
    await this.vault.touchCanvas(entry);
    return { deleted: id };
  }

  // ---------------------------------------------------------------------------
  // Structure
  // ---------------------------------------------------------------------------

  async createGroup(input: { canvas: string; title: string; nodeIds: string[]; palette?: string; id?: string }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    if (input.nodeIds.length === 0) throw new Error('nodeIds is empty');
    const members = input.nodeIds.map((id) => {
      const n = nodes.find((x) => x.id === id);
      if (!n) throw new Error(`Node "${id}" not found`);
      return n;
    });
    const parentId = members[0].parentId;
    if (members.some((m) => m.parentId !== parentId)) throw new Error('All nodes must share the same parent to be grouped');
    if (input.palette && !isPaletteName(input.palette)) throw new Error(`Unknown palette "${input.palette}"`);

    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    const bounds = boundsOf(members.map((m) => rects.get(m.id)!))!;
    const groupAbs = { x: bounds.x - GROUP_PAD.side, y: bounds.y - GROUP_PAD.top };
    const origin = parentId ? rects.get(parentId)! : { x: 0, y: 0 };
    const schema = await this.typeSchema('group').catch(() => undefined);
    const id = input.id ?? uniqueId(input.title, new Set(nodes.map((n) => n.id)));
    if (!SAFE_ID.test(id) || nodes.some((n) => n.id === id)) throw new Error(`Invalid or duplicate group id "${id}"`);

    const group: StoredNode = {
      id,
      type: 'group',
      position: { x: groupAbs.x - origin.x, y: groupAbs.y - origin.y },
      width: bounds.width + GROUP_PAD.side * 2,
      height: bounds.height + GROUP_PAD.top + GROUP_PAD.bottom,
      zIndex: -1,
      ...(parentId ? { parentId } : {}),
      data: {
        ...(schema?.defaultData ?? {}),
        ...(input.palette && isPaletteName(input.palette) ? paletteGroup(input.palette) : {}),
        title: input.title,
        label: input.title,
      },
    };
    await repo.writeNode(group);
    for (const m of members) {
      const abs = rects.get(m.id)!;
      m.parentId = id;
      m.position = { x: abs.x - groupAbs.x, y: abs.y - groupAbs.y };
      await repo.writeNode(m);
    }
    await this.vault.touchCanvas(entry);
    return { id, x: groupAbs.x, y: groupAbs.y, width: group.width, height: group.height };
  }

  /**
   * Moves and resizes many nodes in one step (positions relative to their parent), so intermediate states don't
   * push neighbours around. Groups then grow to fit, edges get new sides and shapes, and the layout is checked.
   */
  async arrangeNodes(input: { canvas: string; nodes: { id: string; x: number; y: number; width?: number; height?: number }[] }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const moved = new Set<string>();
    for (const item of input.nodes) {
      const node = byId.get(item.id);
      if (!node) throw new Error(`Node "${item.id}" not found`);
      node.position = { x: item.x, y: item.y };
      if (item.width) node.width = item.width;
      if (item.height) node.height = item.height;
      moved.add(node.id);
    }
    const depthOf = (n: StoredNode) => {
      let depth = 0;
      for (let p = n.parentId; p && depth < 50; p = byId.get(p)?.parentId) depth++;
      return depth;
    };
    const parents = [...new Set(nodes.filter((n) => moved.has(n.id) && n.parentId).map((n) => n.parentId!))]
      .map((id) => byId.get(id)!)
      .sort((a, b) => depthOf(b) - depthOf(a));
    for (const n of nodes) if (moved.has(n.id)) await repo.writeNode(n);
    for (const p of parents) await this.growToFit(repo, nodes, p.id);

    const edges = await repo.readAllEdges();
    const touches = (id: string) => {
      for (let n = byId.get(id), i = 0; n && i < 50; n = n.parentId ? byId.get(n.parentId) : undefined, i++) if (moved.has(n.id)) return true;
      return false;
    };
    for (const e of rerouteEdges(nodes, edges, (e) => touches(e.source) || touches(e.target))) await repo.writeEdge(e);
    await this.vault.touchCanvas(entry);
    return { arranged: moved.size, layout: await this.checkLayout(input.canvas) };
  }

  async setStoryOrder(canvas: string, nodeIds: string[]) {
    const { entry, repo, nodes } = await this.open(canvas);
    const missing = nodeIds.filter((id) => !nodes.some((n) => n.id === id));
    if (missing.length) throw new Error(`Unknown node ids: ${missing.join(', ')}`);
    let changed = 0;
    for (const n of nodes) {
      const step = nodeIds.indexOf(n.id);
      const next = step >= 0 ? step + 1 : undefined;
      if (n.data.order === next) continue;
      if (next === undefined) delete n.data.order;
      else n.data.order = next;
      await repo.writeNode(n);
      changed++;
    }
    await this.vault.touchCanvas(entry);
    return { ordered: nodeIds.length, changed };
  }

  /**
   * Builds a whole knowledge map in one call: creates the canvas if needed, then groups, nodes and
   * edges (referenced by caller-chosen keys), lays them out and sets the story order.
   */
  async buildKnowledge(input: BuildKnowledgeInput) {
    const groups = input.groups ?? [];
    const edges = input.edges ?? [];
    const keys = new Set<string>();
    for (const k of [...groups.map((g) => g.key), ...input.nodes.map((n) => n.key)]) {
      if (keys.has(k)) throw new Error(`Duplicate key "${k}"`);
      keys.add(k);
    }
    const groupKeys = new Set(groups.map((g) => g.key));
    for (const n of input.nodes) {
      if (n.group && !groupKeys.has(n.group)) throw new Error(`Node "${n.key}" uses unknown group "${n.group}"`);
    }
    for (const e of edges) {
      for (const k of [e.from, e.to]) if (!keys.has(k)) throw new Error(`Edge ${e.from} -> ${e.to} uses unknown key "${k}"`);
    }

    const existing = (await this.vault.listCanvases()).find(
      (c) => c.id === input.canvas || c.name.toLowerCase() === input.canvas.trim().toLowerCase()
    );
    const canvas = existing?.name ?? (await this.createCanvas({ name: input.canvas, description: input.description, tags: input.tags })).name;

    const ids = new Map<string, string>();
    for (const g of groups) {
      const created = await this.createNode({ canvas, type: 'group', title: g.title, palette: g.palette });
      ids.set(g.key, created.id);
    }
    for (const n of input.nodes) {
      const labels = n.labels?.length ? { netLabels: [...normalizeNetLabels(n.data?.netLabels), ...n.labels] } : {};
      const created = await this.createNode({
        canvas,
        type: n.type,
        title: n.title,
        data: { ...n.data, ...labels },
        palette: n.palette,
        size: n.size,
        ...(n.group ? { parentId: ids.get(n.group) } : {}),
      });
      ids.set(n.key, created.id);
    }

    const edgeIds: string[] = [];
    const warnings: string[] = [];
    for (const e of edges) {
      try {
        const created = await this.connect({ canvas, source: ids.get(e.from)!, target: ids.get(e.to)!, label: e.label, style: e.style });
        edgeIds.push(created.id);
      } catch (error) {
        warnings.push(`${e.from} -> ${e.to}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (input.layout !== 'none') {
      if (!existing) {
        // New page: arrange groups and nodes around their connections. Existing pages keep their layout.
        const order: string[] = [];
        for (const n of input.nodes) {
          const id = ids.get(n.group ?? n.key)!;
          if (!order.includes(id)) order.push(id);
        }
        for (const g of groups) if (!order.includes(ids.get(g.key)!)) order.push(ids.get(g.key)!);
        await this.arrangePage(canvas, order, input.layout ?? 'TB');
      } else {
        for (const g of groups) {
          if (input.nodes.filter((n) => n.group === g.key).length >= 2) {
            await this.autoLayout({ canvas, parentId: ids.get(g.key), direction: input.layout ?? 'LR' });
          }
        }
      }
    }
    // Labels given by name face the rest of their net once everything is placed.
    const faced = new Map(input.nodes.filter((n) => n.labels?.length).map((n) => [ids.get(n.key)!, new Set(n.labels!.map((l) => l.trim()))]));
    if (faced.size) await this.faceNetLabels(canvas, faced);
    if (input.story !== false && input.nodes.length > 0) {
      await this.setStoryOrder(canvas, input.nodes.map((n) => ids.get(n.key)!));
    }

    return {
      canvas,
      created: existing ? 'added to existing canvas' : 'new canvas',
      ids: Object.fromEntries(ids),
      edges: edgeIds.length,
      ...(warnings.length ? { warnings } : {}),
    };
  }

  /**
   * Lays out a whole page so edges stay short and readable:
   * 1. inside groups: a flow layout when members link to each other, otherwise rows;
   * 2. top-level blocks (groups and loose nodes) layered along their connections, unconnected blocks in a side column;
   * 3. members of link-free groups re-ordered to line up with what they connect to (fewer crossings);
   * 4. every edge gets the sides with the cleanest route and a shape from its geometry (unless the caller chose them).
   */
  private async arrangePage(canvas: string, order: string[], direction: 'LR' | 'TB') {
    const { entry, repo, nodes } = await this.open(canvas);
    const edges = await repo.readAllEdges();
    // Net labels relate nodes like edges do, so they are placed near each other.
    const related = [...edges.map((e) => ({ source: e.source, target: e.target })), ...netLinks(nodes)];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const dims = (n: StoredNode) => ({ width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height });
    const topOf = (id: string): string | undefined => {
      let n = byId.get(id);
      for (let i = 0; n?.parentId && i < nodes.length; i++) n = byId.get(n.parentId);
      return n?.id;
    };
    const kidsOf = (gid: string) => nodes.filter((n) => n.parentId === gid);
    const containers = order.filter((id) => kidsOf(id).length > 0);
    const innerEdges = (kids: StoredNode[]) => {
      const set = new Set(kids.map((k) => k.id));
      return related.filter((e) => set.has(e.source) && set.has(e.target));
    };

    const layoutGroup = (gid: string, kids: StoredNode[]) => {
      const inner = innerEdges(kids);
      const items = kids.map((k) => ({ id: k.id, ...dims(k) }));
      const origin = { x: GROUP_PAD.side, y: GROUP_PAD.top };
      const pos = inner.length
        ? autoLayout(items, inner, { direction: 'LR', origin, nodeGap: 40, layerGap: 110 })
        : gridLayout(items, { origin, nodeGap: 40, gridColumns: Math.min(kids.length, direction === 'TB' ? 5 : 2) });
      for (const k of kids) k.position = pos.get(k.id)!;
      const b = boundsOf(kids.map((k) => ({ ...k.position, ...dims(k) })))!;
      const g = byId.get(gid)!;
      g.width = b.x + b.width + GROUP_PAD.side;
      g.height = b.y + b.height + GROUP_PAD.bottom;
    };

    const placeBlocks = () => {
      const links = related
        .map((e) => ({ source: topOf(e.source)!, target: topOf(e.target)! }))
        .filter((e) => e.source && e.target && e.source !== e.target && order.includes(e.source) && order.includes(e.target));
      const linked = order.filter((id) => links.some((l) => l.source === id || l.target === id));
      const loose = order.filter((id) => !linked.includes(id));
      const items = (list: string[]) => list.map((id) => ({ id, ...dims(byId.get(id)!) }));
      const pos = linked.length >= 2
        ? autoLayout(items(linked), links, { direction, nodeGap: 120, layerGap: 180 })
        : wrapLayout(items(order), { nodeGap: 160 });
      if (linked.length >= 2 && loose.length) {
        // Unconnected blocks stack in a column beside the flow instead of under it.
        const right = Math.max(...linked.map((id) => pos.get(id)!.x + dims(byId.get(id)!).width)) + 180;
        let y = 0;
        for (const id of loose) {
          pos.set(id, { x: right, y });
          y += dims(byId.get(id)!).height + 120;
        }
      }
      for (const id of order) if (pos.has(id)) byId.get(id)!.position = pos.get(id)!;
    };

    for (const gid of containers) layoutGroup(gid, kidsOf(gid));
    placeBlocks();
    for (let pass = 0; pass < 2; pass++) {
      const rects = absoluteRects(nodes, FALLBACK_SIZE);
      const centre = (id: string) => {
        const r = rects.get(id)!;
        return direction === 'TB' ? r.x + r.width / 2 : r.y + r.height / 2;
      };
      for (const gid of containers) {
        const kids = kidsOf(gid);
        if (innerEdges(kids).length) continue;
        const key = (k: StoredNode) => {
          const partners = related
            .flatMap((e) => (e.source === k.id ? [e.target] : e.target === k.id ? [e.source] : []))
            .filter((o) => topOf(o) !== gid && rects.has(o));
          return partners.length ? partners.reduce((s, o) => s + centre(o), 0) / partners.length : Infinity;
        };
        const sorted = kids.map((k, i) => ({ k, i, key: key(k) })).sort((a, b) => a.key - b.key || a.i - b.i).map((s) => s.k);
        layoutGroup(gid, sorted);
      }
      placeBlocks();
    }

    for (const gid of containers) await this.growToFit(repo, nodes, gid);
    for (const n of nodes) await repo.writeNode(n);
    rerouteEdges(nodes, edges, () => true);
    for (const e of edges) await repo.writeEdge(e);
    await this.vault.touchCanvas(entry);
  }

  /** Creates a canvas from a Mermaid flowchart (nodes become notes, subgraphs become groups). */
  async importMermaid(input: { name: string; mermaid: string; description?: string }) {
    const result = importMermaid(input.mermaid);
    const { entry, repo } = await this.vault.createCanvas({ name: input.name, description: input.description ?? 'Imported from Mermaid', tags: ['mermaid'] });
    for (const n of result.nodes) await repo.writeNode(n);
    for (const e of result.edges) await repo.writeEdge(e);
    return { canvas: entry.name, nodes: result.nodes.length, edges: result.edges.length, warnings: result.warnings };
  }

  /**
   * Re-arranges nodes with a layered layout following the edges (or a grid). Only nodes that share
   * the same parent are moved; by default the top-level nodes of the canvas.
   */
  async autoLayout(input: { canvas: string; parentId?: string; nodeIds?: string[]; direction?: 'LR' | 'TB'; mode?: 'layered' | 'wrap' }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const edges = await repo.readAllEdges();
    let targets = input.nodeIds
      ? input.nodeIds.map((id) => {
          const n = nodes.find((x) => x.id === id);
          if (!n) throw new Error(`Node "${id}" not found`);
          return n;
        })
      : nodes.filter((n) => n.parentId === input.parentId);
    if (targets.length < 2) throw new Error('Need at least two nodes to lay out');
    const parentId = targets[0].parentId;
    targets = targets.filter((n) => n.parentId === parentId);

    // Edges to/from descendants count for their top-most ancestor in this set.
    const ids = new Set(targets.map((n) => n.id));
    const owner = (id: string): string | undefined => {
      let cur = nodes.find((n) => n.id === id);
      for (let i = 0; cur && i < nodes.length; i++) {
        if (ids.has(cur.id)) return cur.id;
        const parent: string | undefined = cur.parentId;
        cur = parent ? nodes.find((n) => n.id === parent) : undefined;
      }
      return undefined;
    };
    const layoutEdges = [...edges, ...netLinks(nodes)]
      .map((e) => ({ source: owner(e.source), target: owner(e.target) }))
      .filter((e): e is { source: string; target: string } => !!e.source && !!e.target && e.source !== e.target);

    const before = boundsOf(targets.map((n) => ({ ...n.position, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height })))!;
    const origin = parentId ? { x: Math.max(before.x, GROUP_PAD.side), y: Math.max(before.y, GROUP_PAD.top) } : { x: before.x, y: before.y };
    const positions = input.mode === 'wrap'
      ? wrapLayout(
          targets.map((n) => ({ id: n.id, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height })),
          { origin, nodeGap: parentId ? 40 : 160 }
        )
      : autoLayout(
          targets.map((n) => ({ id: n.id, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height })),
          layoutEdges,
          { direction: input.direction ?? 'LR', origin, nodeGap: parentId ? 40 : 60 }
        );
    for (const n of targets) {
      n.position = positions.get(n.id)!;
      await repo.writeNode(n);
    }
    await this.growToFit(repo, nodes, parentId);

    // Re-pick handles for edges touching the moved nodes, now that they sit somewhere else.
    const rerouted = rerouteEdges(nodes, edges, (e) => !!owner(e.source) || !!owner(e.target));
    for (const e of rerouted) await repo.writeEdge(e);
    await this.vault.touchCanvas(entry);
    return { moved: targets.length, reroutedEdges: rerouted.length };
  }
}
