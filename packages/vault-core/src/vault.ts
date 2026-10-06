// Vault-level access: list/create canvases and open a CanvasRepository for one of them.

import { bodyMappingFor, type BodyMappingResolver } from './node-codec';
import { sanitizeFolderName } from './package';
import { CanvasRepository, type FsAdapter } from './repository';
import { NODE_TYPES_FILE } from './schema';
import type { NodeTypesDocument } from './types';

export interface CanvasMeta {
  id: string;
  vault_id: string;
  name: string;
  description: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  version: string;
}

export interface CanvasEntry extends CanvasMeta {
  folder: string;
  path: string;
}

export interface CanvasSpec {
  name: string;
  description?: string;
  tags?: string[];
}

const META_FILE = '.mosaic/meta.json';
const CANVAS_DIRS = ['.mosaic', 'nodes', 'edges', 'images', 'attachments'];

export class VaultRepository {
  private nodeTypes: NodeTypesDocument | null | undefined;

  constructor(
    private readonly fs: FsAdapter,
    readonly root: string
  ) {}

  get canvasesDir(): string {
    return `${this.root}/canvases`;
  }

  async readNodeTypes(): Promise<NodeTypesDocument | null> {
    if (this.nodeTypes !== undefined) return this.nodeTypes;
    const path = `${this.root}/${NODE_TYPES_FILE}`;
    this.nodeTypes = (await this.fs.exists(path)) ? JSON.parse(await this.fs.readText(path)) : null;
    return this.nodeTypes ?? null;
  }

  async bodyMappingResolver(): Promise<BodyMappingResolver> {
    const doc = await this.readNodeTypes();
    const knowledge = new Map(doc?.nodeTypes.map((t) => [t.type, t.knowledge]) ?? []);
    return (type) => bodyMappingFor(knowledge.get(type));
  }

  async listCanvases(): Promise<CanvasEntry[]> {
    if (!(await this.fs.exists(this.canvasesDir))) return [];
    const entries: CanvasEntry[] = [];
    for (const dir of await this.fs.list(this.canvasesDir)) {
      if (!dir.isDirectory) continue;
      const path = `${this.canvasesDir}/${dir.name}`;
      const metaPath = `${path}/${META_FILE}`;
      if (!(await this.fs.exists(metaPath))) continue;
      try {
        const meta = JSON.parse(await this.fs.readText(metaPath)) as CanvasMeta;
        entries.push({ ...meta, tags: meta.tags ?? [], description: meta.description ?? '', folder: dir.name, path });
      } catch {
        // Unreadable meta: not a canvas we can safely open.
      }
    }
    return entries.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  }

  /** Finds a canvas by id, exact name (case-insensitive) or folder name. */
  async findCanvas(ref: string): Promise<CanvasEntry> {
    const all = await this.listCanvases();
    const lower = ref.trim().toLowerCase();
    const hit =
      all.find((c) => c.id === ref) ??
      all.find((c) => c.name.toLowerCase() === lower) ??
      all.find((c) => c.folder.toLowerCase() === lower);
    if (!hit) {
      throw new Error(`Canvas not found: "${ref}". Available: ${all.map((c) => c.name).join(', ') || '(none)'}`);
    }
    return hit;
  }

  async openCanvas(ref: string): Promise<{ entry: CanvasEntry; repo: CanvasRepository }> {
    const entry = await this.findCanvas(ref);
    return { entry, repo: new CanvasRepository(this.fs, entry.path, await this.bodyMappingResolver()) };
  }

  async createCanvas(spec: CanvasSpec): Promise<{ entry: CanvasEntry; repo: CanvasRepository }> {
    const name = spec.name.trim();
    if (!name) throw new Error('Canvas name is required');
    const existing = await this.listCanvases();
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`A canvas named "${name}" already exists`);
    }
    const folder = sanitizeFolderName(name);
    const path = `${this.canvasesDir}/${folder}`;
    if (await this.fs.exists(path)) throw new Error(`Canvas folder already exists: ${folder}`);

    const vault = JSON.parse(await this.fs.readText(`${this.root}/vault.json`)) as { id: string };
    const now = new Date().toISOString();
    const meta: CanvasMeta = {
      id: globalThis.crypto.randomUUID(),
      vault_id: vault.id,
      name,
      description: spec.description ?? '',
      tags: spec.tags ?? [],
      created_at: now,
      updated_at: now,
      version: '2.0.0',
    };

    for (const dir of CANVAS_DIRS) await this.fs.mkdir(`${path}/${dir}`);
    await this.fs.writeText(`${path}/${META_FILE}`, JSON.stringify(meta, null, 2));
    await this.fs.writeText(
      `${path}/.mosaic/state.json`,
      JSON.stringify({ viewport: { x: 0, y: 0, zoom: 1 }, selected_nodes: [], selected_edges: [], canvas_mode: '', updated_at: '' }, null, 2)
    );
    // Empty manifest: nodes and edges live in their own files.
    await this.fs.writeText(`${path}/workspace.json`, JSON.stringify({ version: '2.0.0', nodes: [], edges: [], settings: {} }, null, 2));

    const entry: CanvasEntry = { ...meta, folder, path };
    return { entry, repo: new CanvasRepository(this.fs, path, await this.bodyMappingResolver()) };
  }

  /** Bumps updated_at so the canvas list shows recent edits first. */
  async touchCanvas(entry: CanvasEntry): Promise<void> {
    const metaPath = `${entry.path}/${META_FILE}`;
    const meta = JSON.parse(await this.fs.readText(metaPath)) as CanvasMeta;
    meta.updated_at = new Date().toISOString();
    await this.fs.writeText(metaPath, JSON.stringify(meta, null, 2));
  }
}
