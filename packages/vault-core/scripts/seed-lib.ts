// Shared helpers for the example seed scripts: create a canvas folder and build styled nodes/edges
// using only the on-disk vault format (the same path an MCP server takes).

import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  CanvasRepository,
  DESIGN_GUIDE,
  NODE_TYPES_FILE,
  bodyMappingFor,
  type FsAdapter,
  type NodeTypesDocument,
  type StoredEdge,
  type StoredNode,
} from '../src/index';

export const nodeFs: FsAdapter = {
  readText: (p) => fs.readFile(p, 'utf8'),
  writeText: (p, c) => fs.writeFile(p, c, 'utf8'),
  exists: (p) => fs.access(p).then(() => true, () => false),
  mkdir: async (p) => void (await fs.mkdir(p, { recursive: true })),
  remove: (p) => fs.rm(p, { recursive: true, force: true }),
  list: async (p) =>
    (await fs.readdir(p, { withFileTypes: true })).map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
};

export interface CanvasSpec {
  name: string;
  description: string;
  tags: string[];
}

/** Creates `<vault>/canvases/<name>` and writes the given graph into it. */
export async function writeCanvas(vaultPath: string, spec: CanvasSpec, nodes: StoredNode[], edges: StoredEdge[]) {
  const vault = JSON.parse(await fs.readFile(path.join(vaultPath, 'vault.json'), 'utf8'));
  const types: NodeTypesDocument = JSON.parse(await fs.readFile(path.join(vaultPath, NODE_TYPES_FILE), 'utf8'));
  const knowledge = new Map(types.nodeTypes.map((t) => [t.type, t.knowledge]));

  const canvasPath = path.join(vaultPath, 'canvases', spec.name);
  if (await nodeFs.exists(canvasPath)) throw new Error(`Canvas already exists: ${canvasPath}`);

  const now = new Date().toISOString();
  for (const dir of ['.mosaic', 'nodes', 'edges', 'images', 'attachments']) {
    await fs.mkdir(path.join(canvasPath, dir), { recursive: true });
  }
  await fs.writeFile(
    path.join(canvasPath, '.mosaic', 'meta.json'),
    JSON.stringify({
      id: randomUUID(),
      vault_id: vault.id,
      name: spec.name,
      description: spec.description,
      tags: spec.tags,
      created_at: now,
      updated_at: now,
      version: '2.0.0',
    }, null, 2)
  );
  await fs.writeFile(
    path.join(canvasPath, '.mosaic', 'state.json'),
    JSON.stringify({ viewport: { x: 0, y: 0, zoom: 1 }, selected_nodes: [], selected_edges: [], canvas_mode: '', updated_at: '' }, null, 2)
  );
  // Same empty manifest the backend writes for a brand-new canvas; nodes live in nodes/*.md.
  await fs.writeFile(path.join(canvasPath, 'workspace.json'), JSON.stringify({ version: '2.0.0', nodes: [], edges: [], settings: {} }, null, 2));

  const repo = new CanvasRepository(nodeFs, canvasPath.replaceAll('\\', '/'), (type) => bodyMappingFor(knowledge.get(type)));
  for (const n of nodes) await repo.writeNode(n);
  for (const e of edges) await repo.writeEdge(e);

  console.log(`Created "${spec.name}" with ${nodes.length} nodes and ${edges.length} edges at ${canvasPath}`);
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export type PaletteName = keyof typeof DESIGN_GUIDE.palette;

/** Card style from a design-guide palette entry. */
export function card(name: PaletteName, opts: { radius?: number; text?: boolean } = {}) {
  const p = DESIGN_GUIDE.palette[name];
  return {
    color: p.fill,
    borderColor: p.border,
    borderWidth: 1,
    borderRadius: opts.radius ?? 10,
    ...(opts.text ? { textColor: p.text } : {}),
  };
}

/** Group style: faint fill and heading in the palette colour. */
export function groupStyle(name: PaletteName) {
  const p = DESIGN_GUIDE.palette[name];
  const hex = p.border.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { borderColor: p.border, color: `rgba(${r}, ${g}, ${b}, 0.06)`, labelColor: p.text };
}

export const color = (name: PaletteName) => DESIGN_GUIDE.palette[name].border;

export function node(
  id: string,
  type: string,
  rect: [x: number, y: number, width: number, height: number],
  data: Record<string, unknown>,
  parentId?: string
): StoredNode {
  const [x, y, width, height] = rect;
  return { id, type, position: { x, y }, width, height, zIndex: type === 'group' ? -1 : 1, parentId, data: { color: '#1e1e1e', ...data } };
}

type Marker = 'none' | 'arrow' | 'arrowclosed';
export interface EdgeLook {
  color: string;
  path?: 'bezier' | 'straight' | 'step' | 'smoothstep';
  stroke?: 'solid' | 'dashed' | 'dotted';
  animated?: boolean;
  start?: Marker;
  end?: Marker;
  width?: number;
}

export function edge(id: string, source: string, target: string, label: string, sourceHandle: string, targetHandle: string, look: EdgeLook): StoredEdge {
  const pathType = look.path ?? 'bezier';
  return {
    id, source, target, sourceHandle, targetHandle, label,
    type: pathType === 'bezier' ? 'default' : pathType,
    animated: !!look.animated,
    data: {
      pathType,
      color: look.color,
      strokeWidth: look.width ?? 2,
      strokeStyle: look.stroke ?? 'solid',
      animated: !!look.animated,
      markerStart: look.start ?? 'none',
      markerEnd: look.end ?? 'arrowclosed',
      labelColor: look.color,
      labelBgColor: '#0d1117',
    },
  };
}

/** Sets data.order = 1..N following the given ids (the sidebar Story view). */
export function applyStory(nodes: StoredNode[], story: string[]): StoredNode[] {
  return nodes.map((n) => {
    const step = story.indexOf(n.id);
    return step >= 0 ? { ...n, data: { ...n.data, order: step + 1 } } : n;
  });
}

export function vaultArg(): string {
  const vaultPath = process.argv[2];
  if (!vaultPath) throw new Error('Pass the vault folder as the first argument');
  return vaultPath;
}
