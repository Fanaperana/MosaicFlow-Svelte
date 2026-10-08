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
  /**
   * Optional: every node and edge file of a canvas in one round-trip (ids are file/folder names).
   * Files whose stamp matches `known["nodes/<id>" | "edges/<id>"]` come back with content null.
   */
  readCanvasFiles?(root: string, known?: Record<string, string>): Promise<CanvasFiles>;
}

export interface RawCanvasFile {
  id: string;
  /** Modification stamp; absent when the adapter cannot provide one. */
  stamp?: string;
  content: string | null;
}

export interface CanvasFiles {
  nodes: RawCanvasFile[];
  edges: RawCanvasFile[];
}

export const CANVAS_CACHE_VERSION = 1;

/** Parsed files of one canvas keyed by id, so unchanged files are not re-read or re-parsed. */
export interface CanvasCache {
  version: number;
  nodes: Record<string, { stamp: string; node: StoredNode }>;
  edges: Record<string, { stamp: string; edge: StoredEdge }>;
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
 *   <canvas>/edges/<id>.json          one JSON file per edge (v2: edges/<id>/joined.json, still read)
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
    return `${this.edgesDir}/${id}.json`;
  }

  /** v2 location of an edge, read when the v3 file does not exist. */
  legacyEdgePath(id: string): string {
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
    const { nodes, edges } = await this.readAllCached(null);
    return { nodes, edges };
  }

  /**
   * Like readAll, but reuses parsed entries from `cache` for files whose stamp is unchanged.
   * `cache` in the result is null when the adapter has no stamped bulk read.
   */
  async readAllCached(cache: CanvasCache | null): Promise<{
    nodes: StoredNode[];
    edges: StoredEdge[];
    cache: CanvasCache | null;
    changed: boolean;
  }> {
    if (!this.fs.readCanvasFiles) {
      const [nodes, edges] = await Promise.all([this.readAllNodes(), this.readAllEdges()]);
      return { nodes, edges, cache: null, changed: true };
    }
    const prev = cache?.version === CANVAS_CACHE_VERSION ? cache : null;
    const known: Record<string, string> = {};
    for (const [id, e] of Object.entries(prev?.nodes ?? {})) known[`nodes/${id}`] = e.stamp;
    for (const [id, e] of Object.entries(prev?.edges ?? {})) known[`edges/${id}`] = e.stamp;

    const files = await this.fs.readCanvasFiles(this.root, known);
    const next: CanvasCache = { version: CANVAS_CACHE_VERSION, nodes: {}, edges: {} };
    let stamped = true;
    let parsed = 0;

    const collect = <T>(
      kind: 'node' | 'edge',
      list: RawCanvasFile[],
      previous: Record<string, { stamp: string } & Record<string, unknown>> | undefined,
      parse: (id: string, content: string) => T,
      store: (id: string, stamp: string, value: T) => void
    ): T[] =>
      list.flatMap(({ id, stamp, content }) => {
        if (!SAFE_ID.test(id)) return [];
        if (content === null) {
          const hit = previous?.[id];
          if (!hit) return [];
          const value = hit[kind] as T;
          store(id, hit.stamp, value);
          return [value];
        }
        try {
          const value = parse(id, content);
          parsed++;
          if (stamp) store(id, stamp, value);
          else stamped = false;
          return [value];
        } catch (error) {
          console.error(`[vault-core] Skipping unreadable ${kind} ${id}:`, error);
          return [];
        }
      });

    const nodes = collect('node', files.nodes, prev?.nodes, (id, c) => this.parseNode(id, c), (id, stamp, node) => {
      next.nodes[id] = { stamp, node };
    });
    const edges = collect('edge', files.edges, prev?.edges, (id, c) => this.parseEdge(id, c), (id, stamp, edge) => {
      next.edges[id] = { stamp, edge };
    });
    const removed =
      Object.keys(prev?.nodes ?? {}).length !== Object.keys(next.nodes).length ||
      Object.keys(prev?.edges ?? {}).length !== Object.keys(next.edges).length;
    return { nodes, edges, cache: stamped ? next : null, changed: !prev || parsed > 0 || removed };
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
    const ids = new Set<string>();
    for (const e of await this.fs.list(this.edgesDir)) {
      const id = e.isDirectory ? e.name : e.name.endsWith('.json') ? e.name.slice(0, -5) : '';
      if (SAFE_ID.test(id)) ids.add(id);
    }
    return [...ids];
  }

  async readEdge(id: string): Promise<StoredEdge | null> {
    for (const path of [this.edgePath(id), this.legacyEdgePath(id)]) {
      if (await this.fs.exists(path)) return this.parseEdge(id, await this.fs.readText(path));
    }
    return null;
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
    await this.fs.mkdir(this.edgesDir);
    const rest: Partial<StoredEdge> = { ...edge };
    delete rest.id;
    await this.fs.writeText(path, JSON.stringify(rest));
    await this.removeLegacyEdge(edge.id);
  }

  async deleteEdge(id: string): Promise<void> {
    const path = this.edgePath(id);
    if (await this.fs.exists(path)) await this.fs.remove(path);
    await this.removeLegacyEdge(id);
  }

  private async removeLegacyEdge(id: string): Promise<void> {
    const dir = `${this.edgesDir}/${id}`;
    if (await this.fs.exists(dir)) await this.fs.remove(dir);
  }
}
