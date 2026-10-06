// Shared helpers for the example seed scripts: create a canvas folder and build styled nodes/edges
// using only the on-disk vault format (the same path the MCP server takes).

import { promises as fs } from 'node:fs';
import {
  VaultRepository,
  buildEdge,
  paletteCard,
  paletteColor,
  paletteGroup,
  type EdgeLook,
  type FsAdapter,
  type StoredEdge,
  type StoredNode,
} from '../src/index';

export type { EdgeLook, PaletteName } from '../src/index';

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
  const vault = new VaultRepository(nodeFs, vaultPath.replaceAll('\\', '/'));
  const { entry, repo } = await vault.createCanvas(spec);
  for (const n of nodes) await repo.writeNode(n);
  for (const e of edges) await repo.writeEdge(e);
  console.log(`Created "${spec.name}" with ${nodes.length} nodes and ${edges.length} edges at ${entry.path}`);
}

export const card = paletteCard;
export const groupStyle = paletteGroup;
export const color = paletteColor;
export const edge = (id: string, source: string, target: string, label: string, sourceHandle: string, targetHandle: string, look: EdgeLook) =>
  buildEdge(id, source, target, label, sourceHandle, targetHandle, look);

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
