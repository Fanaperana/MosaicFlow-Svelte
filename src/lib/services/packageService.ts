// `.mosaic` packages (see @mosaicflow/vault-core/package).
//
// Export: one page, any selection of pages, or the whole vault.
// Import: preview first, then choose pages, how to handle name clashes, and the target vault.
// Links between imported pages are repointed when pages are renamed or get new ids.

import { toast } from 'svelte-sonner';
import { tick } from 'svelte';
import {
  PACKAGE_EXTENSION,
  packPages,
  rewritePackageLinks,
  sanitizeFolderName,
  unpackPackage,
  type PackageManifest,
  type UnpackedCanvas,
} from '@mosaicflow/vault-core';
import { vaultStore } from '$lib/stores/vault.svelte';
import { deleteCanvas, type CanvasInfo } from './vaultService';
import { flushPendingSaves as flushNodeSaves } from './nodeFileService';
import { flushPendingSaves as flushEdgeSaves } from './edgeFileService';

export const PACKAGE_FILTERS = [
  { name: 'MosaicFlow package', extensions: [PACKAGE_EXTENSION] },
  { name: 'Zip archive', extensions: ['zip'] },
];

export type ConflictPolicy = 'keep' | 'replace' | 'skip';

export interface PackagePagePreview {
  index: number;
  name: string;
  nodes: number;
  edges: number;
  /** A page with this name already exists in the open vault. */
  exists: boolean;
}

export interface PackagePreview {
  path: string;
  fileName: string;
  manifest: PackageManifest | null;
  pages: PackagePagePreview[];
  warnings: string[];
  /** Suggested name when importing as a new vault. */
  vaultName: string;
}

export interface ImportOptions {
  pages: number[];
  conflict: ConflictPolicy;
}

export interface ImportOutcome {
  imported: string[];
  replaced: string[];
  skipped: string[];
  warnings: string[];
}

const unpackedCache = new Map<string, UnpackedCanvas[]>();

function fileBaseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop()!.replace(/\.[^.]+$/, '');
}

async function collectFiles(root: string, prefix = '', out: Record<string, Uint8Array> = {}) {
  const { readDir, readFile } = await import('@tauri-apps/plugin-fs');
  for (const entry of await readDir(`${root}/${prefix}`)) {
    if (entry.isSymlink) continue;
    const rel = `${prefix}${entry.name}`;
    if (entry.isDirectory) await collectFiles(root, `${rel}/`, out);
    else out[rel] = await readFile(`${root}/${rel}`);
  }
  return out;
}

function countEdges(files: Map<string, Uint8Array>): number {
  const ids = new Set<string>();
  for (const path of files.keys()) {
    const m = /^edges\/([^/]+)/.exec(path);
    if (m) ids.add(m[1].replace(/\.json$/, ''));
  }
  return ids.size;
}

function readMeta(files: Map<string, Uint8Array>): Record<string, unknown> {
  const bytes = files.get('.mosaic/meta.json');
  if (!bytes) return {};
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Packs the given pages (all of them = a vault package) and writes the file. */
export async function exportPagesTo(filePath: string, canvases: CanvasInfo[]): Promise<void> {
  const vault = vaultStore.currentVault;
  if (!vault) throw new Error('No vault is open');
  if (canvases.length === 0) throw new Error('Choose at least one page');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  await Promise.all([flushNodeSaves(), flushEdgeSaves()]);

  const inputs = [];
  for (const c of canvases) inputs.push({ name: c.name, files: await collectFiles(c.path) });
  const whole = canvases.length === vaultStore.canvases.length && canvases.length > 1;
  const kind = canvases.length === 1 ? 'canvas' : whole ? 'vault' : 'pages';
  await writeFile(filePath, await packPages(inputs, { kind, vaultName: vault.name }));
}

/** Asks where to save, then exports. Returns the file path, or null if cancelled. */
export async function exportPagesDialog(canvases: CanvasInfo[]): Promise<string | null> {
  const vault = vaultStore.currentVault;
  if (!vault || canvases.length === 0) return null;
  const { save } = await import('@tauri-apps/plugin-dialog');
  const base = canvases.length === 1 ? canvases[0].name : vault.name;
  const filePath = await save({
    title: canvases.length === 1 ? 'Export page' : `Export ${canvases.length} pages`,
    defaultPath: `${sanitizeFolderName(base)}.${PACKAGE_EXTENSION}`,
    filters: PACKAGE_FILTERS.slice(0, 1),
  });
  if (!filePath) return null;
  await exportPagesTo(filePath, canvases);
  return filePath;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Reads and validates a package without changing anything. */
export async function readPackagePreview(filePath: string): Promise<PackagePreview> {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const { manifest, canvases, warnings } = await unpackPackage(await readFile(filePath));
  if (canvases.length === 0) throw new Error('No page found in this file');
  unpackedCache.set(filePath, canvases);

  const taken = new Set(vaultStore.canvases.map((c) => c.name.toLowerCase()));
  return {
    path: filePath,
    fileName: fileBaseName(filePath),
    manifest,
    warnings,
    vaultName: manifest?.vault?.name ?? fileBaseName(filePath),
    pages: canvases.map((c, index) => {
      const keys = [...c.files.keys()];
      return {
        index,
        name: c.name,
        nodes: keys.filter((k) => /^nodes\/[^/]+\.md$/.test(k)).length,
        edges: countEdges(c.files),
        exists: taken.has(c.name.toLowerCase()),
      };
    }),
  };
}

/** Imports the chosen pages of a previewed package into the open vault. */
export async function importPackagePages(preview: PackagePreview, options: ImportOptions): Promise<ImportOutcome> {
  const vault = vaultStore.currentVault;
  if (!vault) throw new Error('No vault is open');
  const all = unpackedCache.get(preview.path) ?? (await unpackPackage(
    await (await import('@tauri-apps/plugin-fs')).readFile(preview.path)
  )).canvases;
  const { writeFile, mkdir, exists, rename, remove } = await import('@tauri-apps/plugin-fs');
  await Promise.all([flushNodeSaves(), flushEdgeSaves()]);

  const outcome: ImportOutcome = { imported: [], replaced: [], skipped: [], warnings: [...preview.warnings] };
  const canvasesDir = `${vault.path}/canvases`;
  const takenNames = new Set(vaultStore.canvases.map((c) => c.name.toLowerCase()));
  const names = new Map<string, string>();
  const ids = new Map<string, string>();
  const planned: { canvas: UnpackedCanvas; name: string; id: string; folder: string; replaces?: CanvasInfo }[] = [];
  const reopen = vaultStore.currentCanvas;

  // Decide names/ids first so links can be rewritten across every imported page.
  for (const index of options.pages) {
    const canvas = all[index];
    if (!canvas) continue;
    const existing = vaultStore.canvases.find((c) => c.name.toLowerCase() === canvas.name.toLowerCase());
    const meta = readMeta(canvas.files);

    if (existing && options.conflict === 'skip') {
      outcome.skipped.push(canvas.name);
      // Links to a skipped page should point at the copy already in the vault.
      if (typeof meta.id === 'string') ids.set(meta.id, existing.id);
      continue;
    }
    if (existing && options.conflict === 'replace') {
      // Staged outside canvases/ (so it never shows up as a page) and swapped in once complete; keeps the id so links survive.
      names.set(canvas.name, existing.name);
      if (typeof meta.id === 'string') ids.set(meta.id, existing.id);
      planned.push({ canvas, name: existing.name, id: existing.id, folder: `${vault.path}/.import-${crypto.randomUUID()}`, replaces: existing });
      continue;
    }

    let name = canvas.name;
    let folder = `${canvasesDir}/${sanitizeFolderName(name)}`;
    for (let n = 2; takenNames.has(name.toLowerCase()) || (await exists(folder)); n++) {
      name = `${canvas.name} (${n})`;
      folder = `${canvasesDir}/${sanitizeFolderName(name)}`;
    }
    takenNames.add(name.toLowerCase());
    names.set(canvas.name, name);
    const id = crypto.randomUUID();
    if (typeof meta.id === 'string') ids.set(meta.id, id);
    planned.push({ canvas, name, id, folder });
  }

  const now = new Date().toISOString();
  const encoder = new TextEncoder();
  for (const { canvas, name, id, folder, replaces } of planned) {
    const files = new Map(canvas.files);
    for (const [path, data] of rewritePackageLinks(files, { names, ids })) files.set(path, data);

    const meta = {
      description: '',
      tags: [],
      created_at: now,
      version: '2.0.0',
      ...readMeta(files),
      id,
      vault_id: vault.id,
      name,
      updated_at: now,
    };
    files.set('.mosaic/meta.json', encoder.encode(JSON.stringify(meta, null, 2)));
    if (!files.has('workspace.json')) {
      files.set('workspace.json', encoder.encode(JSON.stringify({ version: '2.0.0', nodes: [], edges: [], settings: {} }, null, 2)));
    }

    try {
      for (const dir of ['.mosaic', 'nodes', 'edges', 'images', 'attachments']) {
        await mkdir(`${folder}/${dir}`, { recursive: true });
      }
      for (const [rel, data] of files) {
        const slash = rel.lastIndexOf('/');
        if (slash > 0) await mkdir(`${folder}/${rel.slice(0, slash)}`, { recursive: true });
        await writeFile(`${folder}/${rel}`, data);
      }
    } catch (error) {
      await remove(folder, { recursive: true }).catch(() => {});
      outcome.warnings.push(`Could not write "${name}": ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (replaces) {
      if (vaultStore.currentCanvas?.id === replaces.id) {
        vaultStore.closeCanvas();
        await tick();
      }
      if (!(await deleteCanvas(replaces.path))) {
        await remove(folder, { recursive: true }).catch(() => {});
        outcome.warnings.push(`Could not replace "${replaces.name}"; it was left unchanged`);
        continue;
      }
      await rename(folder, replaces.path);
      outcome.replaced.push(name);
    } else {
      outcome.imported.push(name);
    }
  }

  await vaultStore.refreshCanvases();
  if (reopen && !vaultStore.currentCanvas) {
    const again = vaultStore.canvases.find((c) => c.id === reopen.id);
    if (again) vaultStore.openCanvas(again);
  }
  unpackedCache.delete(preview.path);
  return outcome;
}

/** Creates a new vault in `parentPath` and imports the chosen pages into it. */
export async function importPackageAsNewVault(
  preview: PackagePreview,
  parentPath: string,
  vaultName: string,
  pages: number[]
): Promise<ImportOutcome> {
  const created = await vaultStore.createVault(parentPath, vaultName);
  if (!created) throw new Error(vaultStore.error ?? 'Could not create the vault');
  const starters = [...vaultStore.canvases];

  const outcome = await importPackagePages(preview, { pages, conflict: 'keep' });

  // Drop the empty starter page the new vault came with.
  const { readDir } = await import('@tauri-apps/plugin-fs');
  for (const starter of starters) {
    const nodes = await readDir(`${starter.path}/nodes`).catch(() => []);
    if (nodes.length === 0 && outcome.imported.length > 0) await deleteCanvas(starter.path);
  }
  await vaultStore.refreshCanvases();
  const first = vaultStore.canvases.find((c) => c.name === outcome.imported[0]);
  if (first) vaultStore.openCanvas(first);
  return outcome;
}

/** Plain-language summary for a toast. */
export function describeOutcome(outcome: ImportOutcome): string {
  const parts = [];
  if (outcome.imported.length) parts.push(`${outcome.imported.length} page${outcome.imported.length === 1 ? '' : 's'} imported`);
  if (outcome.replaced.length) parts.push(`${outcome.replaced.length} replaced`);
  if (outcome.skipped.length) parts.push(`${outcome.skipped.length} skipped`);
  return parts.join(', ') || 'Nothing imported';
}

export function reportImport(outcome: ImportOutcome) {
  if (outcome.warnings.length) {
    console.warn('Package import warnings:', outcome.warnings);
    toast.warning(describeOutcome(outcome), { description: outcome.warnings.slice(0, 3).join('\n') });
  } else {
    toast.success(describeOutcome(outcome), { description: outcome.imported.join(', ') });
  }
}
