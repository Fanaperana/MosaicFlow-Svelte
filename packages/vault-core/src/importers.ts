// Importers turn other formats into MosaicFlow nodes/edges. They are pure functions (no IO) shared
// by the app and the MCP server; the caller writes the result into a new canvas.

import { absoluteRects } from './layout';
import { autoLayout, type LayoutEdge } from './autolayout';
import { buildEdge, facingSides, paletteCard, paletteColor, paletteGroup, type PaletteName, type Side } from './builders';
import { parseFrontmatter } from './frontmatter';
import { extractWikilinks } from './knowledge';
import type { StoredEdge, StoredNode } from './types';

export interface ImportResult {
  nodes: StoredNode[];
  edges: StoredEdge[];
  warnings: string[];
}

const GROUP_PAD = { side: 30, top: 60, bottom: 30 };
const SAFE = /[^A-Za-z0-9_.-]+/g;

export function safeNodeId(raw: string, taken: Set<string>, fallback = 'node'): string {
  const base = raw.replace(SAFE, '-').replace(/^[-.]+|-+$/g, '').slice(0, 60) || fallback;
  let id = /^[A-Za-z0-9_]/.test(base) ? base : `n-${base}`;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  taken.add(id);
  return id;
}

/** Height that fits markdown text at the given width without clipping (mono ~7.4px per char). */
export function estimateTextSize(text: string, width = 320): { width: number; height: number } {
  const perLine = Math.max(20, Math.floor((width - 40) / 7.4));
  const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return { width, height: Math.min(900, Math.max(100, Math.ceil((lines * 20 + 50) / 10) * 10)) };
}

function noteNode(id: string, title: string, content: string, palette: PaletteName = 'neutral', width = 320): StoredNode {
  const size = estimateTextSize(content, width);
  return { id, type: 'note', position: { x: 0, y: 0 }, ...size, zIndex: 1, data: { title, content, viewMode: 'view', ...paletteCard(palette) } };
}

/** Wraps member nodes (already positioned, top level) in a group sized to fit them. */
function wrapInGroup(group: StoredNode, members: StoredNode[]) {
  const rects = members.map((m) => ({ x: m.position.x, y: m.position.y, w: m.width ?? 300, h: m.height ?? 200 }));
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  group.position = { x: minX - GROUP_PAD.side, y: minY - GROUP_PAD.top };
  group.width = maxX - minX + GROUP_PAD.side * 2;
  group.height = maxY - minY + GROUP_PAD.top + GROUP_PAD.bottom;
  for (const m of members) {
    m.parentId = group.id;
    m.position = { x: m.position.x - group.position.x, y: m.position.y - group.position.y };
  }
}

function layoutAll(nodes: StoredNode[], edges: LayoutEdge[], direction: 'LR' | 'TB' = 'LR') {
  const positions = autoLayout(
    nodes.map((n) => ({ id: n.id, width: n.width ?? 300, height: n.height ?? 200 })),
    edges,
    { direction }
  );
  for (const n of nodes) n.position = positions.get(n.id) ?? n.position;
}

function connect(id: string, a: StoredNode, b: StoredNode, label: string, look: Parameters<typeof buildEdge>[6], direction: 'LR' | 'TB' = 'LR'): StoredEdge {
  const ra = { ...a.position, width: a.width ?? 300, height: a.height ?? 200 };
  const rb = { ...b.position, width: b.width ?? 300, height: b.height ?? 200 };
  // Edges pointing back against the flow loop around underneath (LR) or to the right (TB)
  // instead of running on top of the forward edge.
  const backwards = direction === 'LR' ? rb.x + rb.width <= ra.x : rb.y + rb.height <= ra.y;
  if (backwards) {
    const side = direction === 'LR' ? 'bottom' : 'right';
    return buildEdge(id, a.id, b.id, label, `${side}-source`, `${side}-target`, { ...look, path: 'smoothstep' });
  }
  const sides = facingSides(ra, rb);
  return buildEdge(id, a.id, b.id, label, `${sides.source}-source`, `${sides.target}-target`, look);
}

// =============================================================================
// Obsidian JSON Canvas (https://jsoncanvas.org) — import and export
// =============================================================================

interface JcNode {
  id: string;
  type: 'text' | 'file' | 'link' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  text?: string;
  file?: string;
  url?: string;
  label?: string;
}

interface JcEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: Side;
  toSide?: Side;
  fromEnd?: 'none' | 'arrow';
  toEnd?: 'none' | 'arrow';
  color?: string;
  label?: string;
}

const JC_PRESETS: Record<string, PaletteName> = { '1': 'rose', '2': 'amber', '3': 'amber', '4': 'emerald', '5': 'teal', '6': 'violet' };

function jcPalette(color?: string): PaletteName | undefined {
  return color ? JC_PRESETS[color] : undefined;
}

export function isJsonCanvas(value: unknown): boolean {
  const v = value as { nodes?: unknown; edges?: unknown };
  return !!v && Array.isArray(v.nodes) && (v.edges === undefined || Array.isArray(v.edges)) &&
    (v.nodes as JcNode[]).every((n) => typeof n?.id === 'string' && typeof n?.type === 'string' && typeof n?.x === 'number');
}

export function importJsonCanvas(doc: { nodes: JcNode[]; edges?: JcEdge[] }): ImportResult {
  const warnings: string[] = [];
  const taken = new Set<string>();
  const idMap = new Map<string, string>();
  const nodes: StoredNode[] = [];

  for (const n of doc.nodes) {
    const id = safeNodeId(n.id, taken);
    idMap.set(n.id, id);
    const palette = jcPalette(n.color);
    const custom = n.color?.startsWith('#') ? { borderColor: n.color } : {};
    const base = { id, position: { x: n.x, y: n.y }, width: n.width, height: n.height, zIndex: 1 };
    if (n.type === 'group') {
      nodes.push({ ...base, type: 'group', zIndex: -1, data: { title: n.label ?? 'Group', label: n.label ?? 'Group', ...(palette ? paletteGroup(palette) : {}), ...custom } });
    } else if (n.type === 'link') {
      nodes.push({ ...base, type: 'link', data: { title: n.url ?? 'Link', url: n.url ?? '', description: '', ...(palette ? paletteCard(palette) : {}), ...custom } });
    } else if (n.type === 'file') {
      const file = n.file ?? '';
      const name = file.split('/').pop()?.replace(/\.md$/i, '') ?? file;
      nodes.push({ ...base, type: 'note', data: { title: name, content: `[[${name}]]\n\n_From ${file}_`, viewMode: 'view', ...(palette ? paletteCard(palette) : {}), ...custom } });
    } else {
      const text = n.text ?? '';
      const heading = /^#+\s+(.+)$/m.exec(text)?.[1]?.trim();
      nodes.push({ ...base, type: 'note', data: { title: heading ?? text.split('\n')[0].slice(0, 60), content: text, viewMode: 'view', ...(palette ? paletteCard(palette) : {}), ...custom } });
    }
  }

  // JSON Canvas groups are spatial: a node belongs to the smallest group that contains it.
  const groups = nodes.filter((n) => n.type === 'group').sort((a, b) => a.width! * a.height! - b.width! * b.height!);
  const contains = (g: StoredNode, n: StoredNode) =>
    n.position.x >= g.position.x && n.position.y >= g.position.y &&
    n.position.x + (n.width ?? 0) <= g.position.x + g.width! && n.position.y + (n.height ?? 0) <= g.position.y + g.height!;
  for (const n of nodes) {
    const parent = groups.find((g) => g !== n && contains(g, n) && (n.type !== 'group' || g.width! * g.height! > n.width! * n.height!));
    if (parent) n.parentId = parent.id;
  }
  // Convert to parent-relative positions (parents first so their absolute positions are still known).
  const abs = new Map(nodes.map((n) => [n.id, { ...n.position }]));
  for (const n of nodes) {
    if (n.parentId) {
      const p = abs.get(n.parentId)!;
      n.position = { x: n.position.x - p.x, y: n.position.y - p.y };
    }
  }

  const edges: StoredEdge[] = [];
  const edgeIds = new Set<string>();
  for (const e of doc.edges ?? []) {
    const source = idMap.get(e.fromNode);
    const target = idMap.get(e.toNode);
    if (!source || !target || source === target) {
      warnings.push(`Skipped edge ${e.id}: missing or self-referencing node`);
      continue;
    }
    const palette = jcPalette(e.color);
    const color = e.color?.startsWith('#') ? e.color : palette ? paletteColor(palette) : '#94a3b8';
    const a = nodes.find((n) => n.id === source)!;
    const b = nodes.find((n) => n.id === target)!;
    const sides = facingSides(
      { ...abs.get(a.id)!, width: a.width ?? 300, height: a.height ?? 200 },
      { ...abs.get(b.id)!, width: b.width ?? 300, height: b.height ?? 200 }
    );
    edges.push(buildEdge(
      safeNodeId(e.id, edgeIds, 'edge'), source, target, e.label ?? '',
      `${e.fromSide ?? sides.source}-source`, `${e.toSide ?? sides.target}-target`,
      { color, start: e.fromEnd === 'arrow' ? 'arrow' : 'none', end: e.toEnd === 'none' ? 'none' : 'arrowclosed' }
    ));
  }
  return { nodes: orderParentsFirstSimple(nodes), edges, warnings };
}

function orderParentsFirstSimple(nodes: StoredNode[]): StoredNode[] {
  const depth = (n: StoredNode): number => {
    let d = 0;
    for (let p = n.parentId; p && d < nodes.length; d++) p = nodes.find((x) => x.id === p)?.parentId;
    return d;
  };
  return [...nodes].sort((a, b) => depth(a) - depth(b));
}

/** Converts a canvas to JSON Canvas so it opens in Obsidian (layout, groups, colours, edges). */
export function exportJsonCanvas(nodes: StoredNode[], edges: StoredEdge[], bodyText: (n: StoredNode) => string) {
  const rects = absoluteRects(nodes);
  const color = (n: StoredNode) => (typeof n.data.borderColor === 'string' ? n.data.borderColor : undefined);
  const jcNodes: JcNode[] = nodes.map((n) => {
    const r = rects.get(n.id)!;
    const base = { id: n.id, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), ...(color(n) ? { color: color(n) } : {}) };
    if (n.type === 'group') return { ...base, type: 'group', label: String(n.data.label ?? n.data.title ?? '') };
    if (n.type === 'link' && typeof n.data.url === 'string' && n.data.url) return { ...base, type: 'link', url: n.data.url };
    return { ...base, type: 'text', text: bodyText(n) };
  });
  const sideOf = (handle: string | null | undefined) => (handle?.split('-')[0] as Side | undefined);
  const jcEdges: JcEdge[] = edges.map((e) => ({
    id: e.id,
    fromNode: e.source,
    toNode: e.target,
    ...(sideOf(e.sourceHandle) ? { fromSide: sideOf(e.sourceHandle) } : {}),
    ...(sideOf(e.targetHandle) ? { toSide: sideOf(e.targetHandle) } : {}),
    ...(e.data?.markerStart && e.data.markerStart !== 'none' ? { fromEnd: 'arrow' as const } : {}),
    toEnd: e.data?.markerEnd === 'none' ? 'none' : 'arrow',
    ...(typeof e.data?.color === 'string' ? { color: e.data.color } : {}),
    ...(typeof e.label === 'string' && e.label ? { label: e.label } : {}),
  }));
  return { nodes: jcNodes, edges: jcEdges };
}

// =============================================================================
// MosaicFlow single-JSON export (round trip)
// =============================================================================

export function isMosaicJson(value: unknown): boolean {
  const v = value as { nodes?: unknown; metadata?: unknown };
  return !!v && typeof v.nodes === 'object' && !Array.isArray(v.nodes) && typeof v.metadata === 'object';
}

export function importMosaicJson(doc: { nodes: Record<string, StoredNode>; edges?: Record<string, StoredEdge> }): ImportResult {
  const warnings: string[] = [];
  const nodes: StoredNode[] = [];
  const valid = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
  for (const n of Object.values(doc.nodes)) {
    if (!valid.test(n.id) || typeof n.type !== 'string' || !n.position) {
      warnings.push(`Skipped invalid node ${String(n.id)}`);
      continue;
    }
    nodes.push({
      id: n.id, type: n.type, position: n.position, width: n.width, height: n.height, zIndex: n.zIndex,
      ...(n.parentId ? { parentId: n.parentId } : {}), ...(n.extent ? { extent: n.extent } : {}),
      data: { ...(n.data ?? {}) },
    });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges = Object.values(doc.edges ?? {}).filter((e) => valid.test(e.id) && ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label, type: e.type, animated: e.animated, data: e.data }));
  return { nodes: orderParentsFirstSimple(nodes), edges, warnings };
}

// =============================================================================
// Folder of markdown notes (Obsidian vault, Logseq pages, plain notes)
// =============================================================================

export interface MarkdownFile {
  /** Path relative to the imported folder, using '/'. */
  path: string;
  content: string;
}

export function importMarkdownFiles(files: MarkdownFile[], opts: { maxNotes?: number } = {}): ImportResult {
  const warnings: string[] = [];
  const max = opts.maxNotes ?? 300;
  if (files.length > max) warnings.push(`Imported the first ${max} of ${files.length} notes`);
  const taken = new Set<string>();
  const byName = new Map<string, StoredNode>();
  const folders = new Map<string, StoredNode[]>();
  const nodes: StoredNode[] = [];

  for (const f of files.slice(0, max)) {
    const { data: front, body } = safeFrontmatter(f.content);
    const name = f.path.split('/').pop()!.replace(/\.md$/i, '');
    const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
    const title = String(front.title ?? heading ?? name);
    // Notes show their body, so give heading-less notes their title as a heading.
    const content = heading ? body.trim() : `# ${title}\n\n${body.trim()}`;
    const node = noteNode(safeNodeId(name, taken), title, content);
    const tags = front.tags;
    if (Array.isArray(tags) || typeof tags === 'string') node.data.tags = Array.isArray(tags) ? tags.map(String) : String(tags).split(',').map((t) => t.trim());
    if (typeof front.aliases === 'string' || Array.isArray(front.aliases)) node.data.aliases = front.aliases;
    nodes.push(node);
    for (const key of [name, title]) byName.set(key.toLowerCase(), node);
    const folder = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
    folders.set(folder, [...(folders.get(folder) ?? []), node]);
  }

  // Wikilinks between notes become edges (the text keeps the [[link]] too).
  const edges: StoredEdge[] = [];
  const seen = new Set<string>();
  const edgeIds = new Set<string>();
  for (const n of nodes) {
    for (const link of extractWikilinks(String(n.data.content ?? ''))) {
      const target = byName.get(link.target.split('#')[0].toLowerCase());
      if (!target || target === n) continue;
      const key = `${n.id}>${target.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(buildEdge(safeNodeId(`e-${n.id}-${target.id}`, edgeIds, 'edge'), n.id, target.id, '', 'right-source', 'left-target', { color: '#94a3b8', end: 'arrow' }));
    }
  }

  layoutAll(nodes, edges, 'LR');

  // Sub-folders whose notes don't link outside the folder become groups.
  const palettes: PaletteName[] = ['violet', 'teal', 'blue', 'emerald', 'amber', 'rose'];
  const grouped = new Map<StoredNode, StoredNode[]>();
  for (const [folder, members] of folders) {
    if (!folder || members.length < 2 || folders.size < 2) continue;
    const linksOut = edges.some((e) => members.some((m) => m.id === e.source) !== members.some((m) => m.id === e.target));
    if (linksOut) continue;
    const name = folder.split('/').pop()!;
    grouped.set({
      id: safeNodeId(`folder-${name}`, taken), type: 'group', position: { x: 0, y: 0 }, zIndex: -1,
      data: { title: name, label: name, ...paletteGroup(palettes[grouped.size % palettes.length]) },
    }, members);
  }

  if (grouped.size > 0) {
    const inGroup = new Set([...grouped.values()].flat());
    const loose = nodes.filter((n) => !inGroup.has(n));
    // Lay out each block on its own, then arrange the blocks in a grid.
    const extent = (members: StoredNode[]) => {
      const minX = Math.min(...members.map((m) => m.position.x));
      const minY = Math.min(...members.map((m) => m.position.y));
      return {
        minX, minY,
        width: Math.max(...members.map((m) => m.position.x + m.width!)) - minX,
        height: Math.max(...members.map((m) => m.position.y + m.height!)) - minY,
      };
    };
    const blocks: { id: string; members: StoredNode[]; group?: StoredNode; width: number; height: number }[] = [];
    if (loose.length) {
      layoutAll(loose, edges, 'LR');
      const e = extent(loose);
      blocks.push({ id: '__loose', members: loose, width: e.width, height: e.height });
    }
    for (const [group, members] of grouped) {
      layoutAll(members, edges, 'LR');
      const e = extent(members);
      blocks.push({ id: group.id, members, group, width: e.width + GROUP_PAD.side * 2, height: e.height + GROUP_PAD.top + GROUP_PAD.bottom });
    }
    const placed = autoLayout(blocks, [], { nodeGap: 160 });
    for (const block of blocks) {
      const at = placed.get(block.id)!;
      const e = extent(block.members);
      const pad = block.group ? { x: GROUP_PAD.side, y: GROUP_PAD.top } : { x: 0, y: 0 };
      for (const m of block.members) m.position = { x: m.position.x - e.minX + at.x + pad.x, y: m.position.y - e.minY + at.y + pad.y };
      if (block.group) wrapInGroup(block.group, block.members);
    }
  }

  const groups = [...grouped.keys()];
  const rects = absoluteRects([...groups, ...nodes]);
  for (const e of edges) {
    const sides = facingSides(rects.get(e.source)!, rects.get(e.target)!);
    e.sourceHandle = `${sides.source}-source`;
    e.targetHandle = `${sides.target}-target`;
  }
  return { nodes: [...groups, ...nodes], edges, warnings };
}

function safeFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  try {
    const parsed = parseFrontmatter(text);
    return { data: parsed.attributes, body: parsed.body };
  } catch {
    return { data: {}, body: text };
  }
}

// =============================================================================
// Mermaid flowcharts
// =============================================================================

const SHAPES: [RegExp, string][] = [
  [/^\(\((.*)\)\)$/, 'circle'],
  [/^\(\[(.*)\]\)$/, 'stadium'],
  [/^\[\[(.*)\]\]$/, 'subroutine'],
  [/^\[\((.*)\)\]$/, 'database'],
  [/^\{\{(.*)\}\}$/, 'hexagon'],
  [/^\[(.*)\]$/, 'box'],
  [/^\((.*)\)$/, 'round'],
  [/^\{(.*)\}$/, 'decision'],
  [/^>(.*)\]$/, 'flag'],
];

const NODE_REF = /^([A-Za-z0-9_][\w-]*)\s*((?:\(\(|\(\[|\[\[|\[\(|\{\{|\[|\(|\{|>)[\s\S]*?(?:\)\)|\]\)|\]\]|\)\]|\}\}|\]|\)|\}))?\s*(?::::\w+)?$/;
const LINK = /\s*(<?-->|<?---|<?-\.->|<?-\.-|<?==>|<?===|--\s*[^-|>][^|>]*?\s*-->|-\.\s*[^.]+?\s*\.->|==\s*[^=>]+?\s*==>)\s*(?:\|([^|]*)\|)?\s*/;

function stripQuotes(s: string) {
  const t = s.trim();
  return (t.startsWith('"') && t.endsWith('"')) ? t.slice(1, -1) : t;
}

export function importMermaid(source: string): ImportResult {
  const warnings: string[] = [];
  const lines = source.replace(/\r/g, '').split('\n').map((l) => l.replace(/%%.*$/, '').trim()).filter(Boolean);
  const header = lines.find((l) => /^(flowchart|graph)\b/i.test(l));
  if (!header) throw new Error('Only Mermaid flowcharts are supported (start with "flowchart LR" or "graph TD")');
  const dir = /\b(LR|RL)\b/i.test(header) ? 'LR' : 'TB';

  const taken = new Set<string>();
  const ids = new Map<string, string>();
  const nodes = new Map<string, StoredNode>();
  const shapes = new Map<string, string>();
  const rawEdges: { from: string; to: string; label: string; kind: 'solid' | 'dotted' | 'thick'; arrow: boolean; both: boolean }[] = [];
  const subgraphs: { id: string; title: string; members: string[] }[] = [];
  const stack: { id: string; title: string; members: string[] }[] = [];
  const classes = new Map<string, string>();

  const ensure = (ref: string): string | null => {
    const m = NODE_REF.exec(ref.trim());
    if (!m) {
      warnings.push(`Could not parse node "${ref.trim()}"`);
      return null;
    }
    const key = m[1];
    let label: string | undefined;
    if (m[2]) {
      for (const [re, shape] of SHAPES) {
        const s = re.exec(m[2]);
        if (s) {
          label = stripQuotes(s[1]).replace(/<br\s*\/?>/gi, '\n');
          shapes.set(key, shape);
          break;
        }
      }
    }
    if (!ids.has(key)) {
      const id = safeNodeId(key, taken);
      ids.set(key, id);
      nodes.set(key, { id, type: 'note', position: { x: 0, y: 0 }, zIndex: 1, data: { title: key, content: key, viewMode: 'view' } });
    }
    const node = nodes.get(key)!;
    if (label !== undefined) {
      node.data.title = label.split('\n')[0];
      node.data.content = label;
    }
    stack.at(-1)?.members.includes(key) || stack.at(-1)?.members.push(key);
    return key;
  };

  for (const line of lines) {
    if (line === header || /^(classDef|style|linkStyle|click)\b/.test(line)) continue;
    const cls = /^class\s+([\w,\s]+?)\s+(\w+)$/.exec(line);
    if (cls) {
      cls[1].split(',').forEach((k) => classes.set(k.trim(), cls[2]));
      continue;
    }
    const sub = /^subgraph\s+(?:(\w+)\s*\[(.+)\]|(.+))$/.exec(line);
    if (sub) {
      const title = stripQuotes(sub[2] ?? sub[3] ?? 'Group');
      const entry = { id: sub[1] ?? title, title, members: [] as string[] };
      subgraphs.push(entry);
      stack.push(entry);
      continue;
    }
    if (line === 'end') {
      stack.pop();
      continue;
    }
    if (/^direction\s/.test(line)) continue;

    // A chain "A --> B -->|x| C" (also "A & B --> C").
    const parts: string[] = [];
    const links: { label: string; kind: 'solid' | 'dotted' | 'thick'; arrow: boolean; both: boolean }[] = [];
    let rest = line;
    for (let guard = 0; guard < 50; guard++) {
      const m = LINK.exec(rest);
      if (!m) break;
      parts.push(rest.slice(0, m.index));
      const op = m[1];
      const inline = /^(?:--|-\.|==)\s*(.+?)\s*(?:-->|\.->|==>)$/.exec(op);
      links.push({
        label: stripQuotes((m[2] ?? inline?.[1] ?? '').replace(/[\s.=-]+$/, '')),
        kind: op.includes('.') ? 'dotted' : op.includes('=') ? 'thick' : 'solid',
        arrow: op.endsWith('>'),
        both: op.startsWith('<'),
      });
      rest = rest.slice(m.index + m[0].length);
    }
    parts.push(rest);
    const groupsOfRefs = parts.map((p) => p.split('&').map((r) => r.trim()).filter(Boolean).map(ensure).filter((k): k is string => !!k));
    for (let i = 0; i < links.length; i++) {
      for (const from of groupsOfRefs[i]) for (const to of groupsOfRefs[i + 1] ?? []) rawEdges.push({ from, to, ...links[i] });
    }
  }

  const all = [...nodes.values()];
  if (all.length === 0) throw new Error('No nodes found in the Mermaid diagram');
  const palettes: PaletteName[] = ['violet', 'teal', 'blue', 'emerald', 'amber', 'rose'];
  const classPalette = new Map([...new Set(classes.values())].map((c, i) => [c, palettes[i % palettes.length]]));
  for (const [key, node] of nodes) {
    const shape = shapes.get(key);
    const palette: PaletteName = classes.has(key) ? classPalette.get(classes.get(key)!)! : shape === 'decision' ? 'amber' : shape === 'database' ? 'teal' : shape === 'circle' || shape === 'stadium' ? 'emerald' : 'neutral';
    Object.assign(node.data, paletteCard(palette, { radius: shape === 'round' || shape === 'stadium' || shape === 'circle' ? 24 : 10 }));
    Object.assign(node, estimateTextSize(String(node.data.content), 240));
    node.height = Math.max(80, node.height!);
  }

  const layoutEdges = rawEdges.map((e) => ({ source: ids.get(e.from)!, target: ids.get(e.to)! }));
  layoutAll(all, layoutEdges, dir);

  const edgeIds = new Set<string>();
  const edges = rawEdges.map((e) => {
    const a = nodes.get(e.from)!;
    const b = nodes.get(e.to)!;
    const look = {
      color: e.kind === 'thick' ? '#e5e7eb' : '#94a3b8',
      path: 'smoothstep' as const,
      stroke: e.kind === 'dotted' ? ('dashed' as const) : ('solid' as const),
      width: e.kind === 'thick' ? 3 : 2,
      end: e.arrow ? ('arrowclosed' as const) : ('none' as const),
      start: e.both ? ('arrowclosed' as const) : ('none' as const),
    };
    return connect(safeNodeId(`e-${a.id}-${b.id}`, edgeIds, 'edge'), a, b, e.label, look, dir);
  });

  // Subgraphs become groups around their members (outermost first so nesting works).
  const groups: StoredNode[] = [];
  subgraphs.forEach((sg, i) => {
    const members = sg.members.map((k) => nodes.get(k)!).filter((m) => m && !m.parentId);
    if (members.length === 0) return;
    const group: StoredNode = {
      id: safeNodeId(`group-${sg.id}`, taken), type: 'group', position: { x: 0, y: 0 }, zIndex: -1,
      data: { title: sg.title, label: sg.title, ...paletteGroup(palettes[i % palettes.length]) },
    };
    wrapInGroup(group, members);
    groups.push(group);
  });
  if (groups.length) {
    // Recompute forward handles now that some nodes are inside groups (back-edges keep their loop).
    const rects = absoluteRects([...groups, ...all]);
    for (const e of edges) {
      if (e.sourceHandle === e.targetHandle?.replace('-target', '-source')) continue;
      const sides = facingSides(rects.get(e.source)!, rects.get(e.target)!);
      e.sourceHandle = `${sides.source}-source`;
      e.targetHandle = `${sides.target}-target`;
    }
  }
  return { nodes: [...groups, ...all], edges, warnings };
}
