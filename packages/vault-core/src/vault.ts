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

/** <canvas>/canvas.json (format v3). */
export interface CanvasFile {
  formatVersion: number;
  id: string;
  vaultId: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  settings?: Record<string, unknown>;
}

export const CANVAS_FORMAT_VERSION = 3;
export const CANVAS_FILE = 'canvas.json';
/** v2 metadata; the app migrates v2 canvases to v3 when it opens the vault. */
const LEGACY_META_FILE = '.mosaic/meta.json';
const CANVAS_DIRS = ['nodes', 'edges'];

function fromCanvasFile(f: CanvasFile): CanvasMeta {
  return {
    id: f.id,
    vault_id: f.vaultId,
    name: f.name,
    description: f.description ?? '',
    tags: f.tags ?? [],
    created_at: f.createdAt,
    updated_at: f.updatedAt,
    version: String(f.formatVersion),
  };
}

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
      const meta = await this.readMeta(path);
      if (meta) entries.push({ ...meta, tags: meta.tags ?? [], description: meta.description ?? '', folder: dir.name, path });
    }
    return entries.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  }

  /** Canvas metadata from canvas.json (v3) or .mosaic/meta.json (v2); null when not a canvas. */
  private async readMeta(path: string): Promise<CanvasMeta | null> {
    try {
      if (await this.fs.exists(`${path}/${CANVAS_FILE}`)) {
        const file = JSON.parse(await this.fs.readText(`${path}/${CANVAS_FILE}`)) as CanvasFile;
        if (file.formatVersion >= CANVAS_FORMAT_VERSION) return fromCanvasFile(file);
      }
      if (await this.fs.exists(`${path}/${LEGACY_META_FILE}`)) {
        return JSON.parse(await this.fs.readText(`${path}/${LEGACY_META_FILE}`)) as CanvasMeta;
      }
    } catch {
      // Unreadable metadata: not a canvas we can safely open.
    }
    return null;
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
    const file: CanvasFile = {
      formatVersion: CANVAS_FORMAT_VERSION,
      id: globalThis.crypto.randomUUID(),
      vaultId: vault.id,
      name,
      description: spec.description ?? '',
      tags: spec.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    for (const dir of CANVAS_DIRS) await this.fs.mkdir(`${path}/${dir}`);
    await this.fs.writeText(`${path}/${CANVAS_FILE}`, JSON.stringify(file, null, 2));

    const entry: CanvasEntry = { ...fromCanvasFile(file), folder, path };
    return { entry, repo: new CanvasRepository(this.fs, path, await this.bodyMappingResolver()) };
  }

  /** Bumps the updated time so the canvas list shows recent edits first. */
  async touchCanvas(entry: CanvasEntry): Promise<void> {
    const now = new Date().toISOString();
    const v3 = `${entry.path}/${CANVAS_FILE}`;
    if (await this.fs.exists(v3)) {
      const file = JSON.parse(await this.fs.readText(v3)) as CanvasFile;
      if (file.formatVersion >= CANVAS_FORMAT_VERSION) {
        file.updatedAt = now;
        await this.fs.writeText(v3, JSON.stringify(file, null, 2));
        return;
      }
    }
    const legacy = `${entry.path}/${LEGACY_META_FILE}`;
    const meta = JSON.parse(await this.fs.readText(legacy)) as CanvasMeta;
    meta.updated_at = now;
    await this.fs.writeText(legacy, JSON.stringify(meta, null, 2));
  }

  async readCanvasFile(entry: CanvasEntry): Promise<CanvasFile | null> {
    const path = `${entry.path}/${CANVAS_FILE}`;
    if (!(await this.fs.exists(path))) return null;
    const file = JSON.parse(await this.fs.readText(path)) as CanvasFile;
    return file.formatVersion >= CANVAS_FORMAT_VERSION ? file : null;
  }

  /**
   * Renames a canvas or changes its description, tags or settings (merged, null removes a key).
   * The folder keeps its name so a page open in the app is not pulled from under it.
   */
  async updateCanvas(
    ref: string,
    patch: { name?: string; description?: string; tags?: string[]; settings?: Record<string, unknown> }
  ): Promise<CanvasEntry> {
    const entry = await this.findCanvas(ref);
    const file = await this.readCanvasFile(entry);
    if (!file) throw new Error(`"${entry.name}" uses an old format; open the vault in MosaicFlow once to upgrade it`);
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error('Canvas name is required');
      const all = await this.listCanvases();
      if (all.some((c) => c.id !== entry.id && c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`A canvas named "${name}" already exists`);
      }
      file.name = name;
    }
    if (patch.description !== undefined) file.description = patch.description;
    if (patch.tags !== undefined) file.tags = [...new Set(patch.tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean))];
    if (patch.settings) {
      const settings: Record<string, unknown> = { ...file.settings };
      for (const [key, value] of Object.entries(patch.settings)) {
        if (value === null) delete settings[key];
        else settings[key] = value;
      }
      file.settings = settings;
    }
    file.updatedAt = new Date().toISOString();
    await this.fs.writeText(`${entry.path}/${CANVAS_FILE}`, JSON.stringify(file, null, 2));
    return { ...entry, ...fromCanvasFile(file) };
  }

  /** Deletes a canvas folder with all its nodes and edges, and its per-device view state. */
  async deleteCanvas(ref: string): Promise<CanvasEntry> {
    const entry = await this.findCanvas(ref);
    await this.fs.remove(entry.path);
    const state = `${this.root}/.mosaicflow/state/${entry.id}.json`;
    if (await this.fs.exists(state)) await this.fs.remove(state);
    return entry;
  }
}
