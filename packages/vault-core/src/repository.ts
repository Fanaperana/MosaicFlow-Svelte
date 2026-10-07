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
  /** Optional: every node and edge file of a canvas in one round-trip (ids are file/folder names). */
  readCanvasFiles?(root: string): Promise<CanvasFiles>;
}

export interface CanvasFiles {
  nodes: { id: string; content: string }[];
  edges: { id: string; content: string }[];
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
    return this.parseNode(id, await this.fs.readText(path));
  }

  private parseNode(id: string, content: string): StoredNode {
    // The file name is authoritative so a copied file cannot shadow another node.
    return { ...markdownToNode(content, this.resolveMapping), id };
  }

  private parseEdge(id: string, content: string): StoredEdge {
    return { ...(JSON.parse(content) as Omit<StoredEdge, 'id'>), id };
  }

  /** Reads every node and edge, in one round-trip when the adapter supports it. */
  async readAll(): Promise<{ nodes: StoredNode[]; edges: StoredEdge[] }> {
    if (!this.fs.readCanvasFiles) {
      const [nodes, edges] = await Promise.all([this.readAllNodes(), this.readAllEdges()]);
      return { nodes, edges };
    }
    const files = await this.fs.readCanvasFiles(this.root);
    const parse = <T>(kind: string, list: { id: string; content: string }[], fn: (id: string, c: string) => T): T[] =>
      list.flatMap(({ id, content }) => {
        if (!SAFE_ID.test(id)) return [];
        try {
          return [fn(id, content)];
        } catch (error) {
          console.error(`[vault-core] Skipping unreadable ${kind} ${id}:`, error);
          return [];
        }
      });
    return {
      nodes: parse('node', files.nodes, (id, c) => this.parseNode(id, c)),
      edges: parse('edge', files.edges, (id, c) => this.parseEdge(id, c)),
    };
  }

  async readAllNodes(): Promise<StoredNode[]> {
    const results = await Promise.all(
      (await this.listNodeIds()).map(async (id) => {
        try {
          return this.parseNode(id, await this.fs.readText(this.nodePath(id)));
        } catch (error) {
          console.error(`[vault-core] Skipping unreadable node file ${id}.md:`, error);
          return null;
        }
      })
    );
    return results.filter((n): n is StoredNode => n !== null);
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
    return this.parseEdge(id, await this.fs.readText(path));
  }

  async readAllEdges(): Promise<StoredEdge[]> {
    const results = await Promise.all(
      (await this.listEdgeIds()).map(async (id) => {
        try {
          return await this.readEdge(id);
        } catch (error) {
          console.error(`[vault-core] Skipping unreadable edge ${id}:`, error);
          return null;
        }
      })
    );
    return results.filter((e): e is StoredEdge => e !== null);
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
