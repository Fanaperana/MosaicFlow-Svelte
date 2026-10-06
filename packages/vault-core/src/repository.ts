import { markdownToNode, nodeToMarkdown, type BodyMappingResolver } from './node-codec';
import type { StoredEdge, StoredNode } from './types';

/** Minimal filesystem the repository needs; implemented with Tauri fs in the app and node:fs in tools. */
export interface FsAdapter {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Recursive mkdir. */
  mkdir(path: string): Promise<void>;
  /** Recursive remove. */
  remove(path: string): Promise<void>;
  list(path: string): Promise<{ name: string; isDirectory: boolean }[]>;
}

const SAFE_ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

/** Rejects ids that could escape the canvas folder when used as file names. */
export function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id) || id.includes('..')) {
    throw new Error(`Invalid id "${id}": only letters, digits, '_', '-' and '.' are allowed`);
  }
}

/**
 * Reads and writes one canvas folder:
 *
 *   <canvas>/nodes/<id>.md            one markdown file per node
 *   <canvas>/edges/<id>/joined.json   one JSON file per edge
 */
export class CanvasRepository {
  constructor(
    private readonly fs: FsAdapter,
    readonly root: string,
    private readonly resolveMapping: BodyMappingResolver
  ) {}

  get nodesDir(): string {
    return `${this.root}/nodes`;
  }

  get edgesDir(): string {
    return `${this.root}/edges`;
  }

  nodePath(id: string): string {
    assertSafeId(id);
    return `${this.nodesDir}/${id}.md`;
  }

  edgePath(id: string): string {
    assertSafeId(id);
    return `${this.edgesDir}/${id}/joined.json`;
  }

  // ---------------------------------------------------------------------------
  // Nodes
  // ---------------------------------------------------------------------------

  async listNodeIds(): Promise<string[]> {
    if (!(await this.fs.exists(this.nodesDir))) return [];
    const entries = await this.fs.list(this.nodesDir);
    return entries
      .filter((e) => !e.isDirectory && e.name.endsWith('.md'))
      .map((e) => e.name.slice(0, -3))
      .filter((id) => SAFE_ID.test(id));
  }

  async readNode(id: string): Promise<StoredNode | null> {
    const path = this.nodePath(id);
    if (!(await this.fs.exists(path))) return null;
    const node = markdownToNode(await this.fs.readText(path), this.resolveMapping);
    // The file name is authoritative so a copied file cannot shadow another node.
    return { ...node, id };
  }

  async readAllNodes(): Promise<StoredNode[]> {
    const nodes: StoredNode[] = [];
    for (const id of await this.listNodeIds()) {
      try {
        const node = await this.readNode(id);
        if (node) nodes.push(node);
      } catch (error) {
        console.error(`[vault-core] Skipping unreadable node file ${id}.md:`, error);
      }
    }
    return nodes;
  }

  async writeNode(node: StoredNode): Promise<void> {
    const path = this.nodePath(node.id);
    await this.fs.mkdir(this.nodesDir);
    await this.fs.writeText(path, nodeToMarkdown(node, this.resolveMapping(node.type)));
  }

  /** Removes the node file and any legacy `nodes/<id>/` folder. */
  async deleteNode(id: string): Promise<void> {
    const path = this.nodePath(id);
    if (await this.fs.exists(path)) await this.fs.remove(path);
    const legacyDir = `${this.nodesDir}/${id}`;
    if (await this.fs.exists(legacyDir)) await this.fs.remove(legacyDir);
  }

  // ---------------------------------------------------------------------------
  // Edges
  // ---------------------------------------------------------------------------

  async listEdgeIds(): Promise<string[]> {
    if (!(await this.fs.exists(this.edgesDir))) return [];
    const entries = await this.fs.list(this.edgesDir);
    return entries.filter((e) => e.isDirectory && SAFE_ID.test(e.name)).map((e) => e.name);
  }

  async readEdge(id: string): Promise<StoredEdge | null> {
    const path = this.edgePath(id);
    if (!(await this.fs.exists(path))) return null;
    const raw = JSON.parse(await this.fs.readText(path)) as Omit<StoredEdge, 'id'>;
    return { ...raw, id };
  }

  async readAllEdges(): Promise<StoredEdge[]> {
    const edges: StoredEdge[] = [];
    for (const id of await this.listEdgeIds()) {
      try {
        const edge = await this.readEdge(id);
        if (edge) edges.push(edge);
      } catch (error) {
        console.error(`[vault-core] Skipping unreadable edge ${id}:`, error);
      }
    }
    return edges;
  }

  async writeEdge(edge: StoredEdge): Promise<void> {
    const path = this.edgePath(edge.id);
    await this.fs.mkdir(`${this.edgesDir}/${edge.id}`);
    const rest: Partial<StoredEdge> = { ...edge };
    delete rest.id;
    await this.fs.writeText(path, JSON.stringify(rest));
  }

  async deleteEdge(id: string): Promise<void> {
    assertSafeId(id);
    const dir = `${this.edgesDir}/${id}`;
    if (await this.fs.exists(dir)) await this.fs.remove(dir);
  }
}
