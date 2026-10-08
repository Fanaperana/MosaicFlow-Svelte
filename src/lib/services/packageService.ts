// `.mosaic` packages (see @mosaicflow/vault-core/package).
//
// Export: one page, any selection of pages, or the whole vault.
// Import: preview first, then choose pages, how to handle name clashes, and the target vault.
// Links between imported pages are repointed when pages are renamed or get new ids.

import { toast } from 'svelte-sonner';
import { tick } from 'svelte';
import {
  CANVAS_FILE,
  CANVAS_FORMAT_VERSION,
  PACKAGE_EXTENSION,
  nodeTypesOfPage,
  packPages,
  rewritePackageLinks,
  sanitizeFolderName,
  unpackPackage,
  type CanvasFile,
  type PackageManifest,
  type PackPluginInput,
  type UnpackedCanvas,
  type UnpackedPlugin,
} from '@mosaicflow/vault-core';
import { vaultStore } from '$lib/stores/vault.svelte';
import { pluginStore, type UserPlugin } from '$lib/stores/plugins.svelte';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import { getPluginsDir } from '$lib/api/plugin';
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
  /** Plugins bundled in the file. */
  plugins: PackagePluginPreview[];
  /** Node types the pages use that no installed or bundled plugin provides. */
  missingTypes: string[];
  warnings: string[];
  /** Suggested name when importing as a new vault. */
  vaultName: string;
}

export interface PackagePluginPreview {
  folder: string;
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  nodeTypes: string[];
  /** Pages in the file that use it. */
  usedBy: string[];
  /** new: not installed; update: an older version is installed; same/newer: nothing to install. */
  status: 'new' | 'update' | 'same' | 'newer';
  installedVersion?: string;
  installedEnabled: boolean;
  /** Why it can't be installed (bad manifest, reserved id, missing module). */
  problem?: string;
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
const unpackedPluginCache = new Map<string, UnpackedPlugin[]>();

function fileBaseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop()!.replace(/\.[^.]+$/, '');
}

const SKIPPED_DIRS = new Set(['.git', 'node_modules']);

async function collectFiles(root: string, prefix = '', out: Record<string, Uint8Array> = {}) {
  const { readDir, readFile } = await import('@tauri-apps/plugin-fs');
  for (const entry of await readDir(`${root}/${prefix}`)) {
    if (entry.isSymlink || (entry.isDirectory && SKIPPED_DIRS.has(entry.name))) continue;
    const rel = `${prefix}${entry.name}`;
    if (entry.isDirectory) await collectFiles(root, `${rel}/`, out);
    else out[rel] = await readFile(`${root}/${rel}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plugins used by pages
// ---------------------------------------------------------------------------

function providedTypes(plugin: { manifest: { capabilities?: unknown } }): string[] {
  const caps = Array.isArray(plugin.manifest.capabilities) ? plugin.manifest.capabilities : [];
  return caps.flatMap((c: { type?: string; types?: unknown }) => (c?.type === 'nodeTypes' && Array.isArray(c.types) ? c.types.map(String) : []));
}

/** The installed user plugin that provides a node type (built-in types return undefined). */
export function installedPluginFor(type: string): UserPlugin | undefined {
  const owner = nodeRegistry.get(type)?.pluginId;
  if (owner) return pluginStore.plugins.find((p) => p.manifest.id === owner);
  return pluginStore.plugins.find((p) => providedTypes(p).includes(type));
}

export interface PluginUsage {
  /** Installed user plugins the types need, with the types each provides. */
  plugins: { plugin: UserPlugin; nodeTypes: string[] }[];
  /** Types that are neither built in nor provided by an installed plugin. */
  missing: string[];
}

export function pluginUsage(types: Iterable<string>): PluginUsage {
  const byId = new Map<string, { plugin: UserPlugin; nodeTypes: string[] }>();
  const missing: string[] = [];
  for (const type of types) {
    const plugin = installedPluginFor(type);
    if (plugin) {
      const entry = byId.get(plugin.manifest.id) ?? { plugin, nodeTypes: [] };
      entry.nodeTypes.push(type);
      byId.set(plugin.manifest.id, entry);
    } else if (!nodeRegistry.has(type)) {
      missing.push(type);
    }
  }
  return { plugins: [...byId.values()], missing };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const PLUGIN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function describeBundledPlugin(p: UnpackedPlugin, pages: UnpackedCanvas[]): PackagePluginPreview {
  const m = (p.manifest ?? {}) as Record<string, unknown>;
  const id = typeof m.id === 'string' ? m.id : (p.info?.id ?? p.folder);
  const version = typeof m.version === 'string' ? m.version : (p.info?.version ?? '0.0.0');
  const main = (m.frontend as { main?: unknown } | undefined)?.main;
  const nodeTypes = p.info?.nodeTypes?.length ? p.info.nodeTypes : providedTypes({ manifest: m });
  let problem: string | undefined;
  if (!p.manifest) problem = 'plugin.json is missing or invalid';
  else if (!PLUGIN_ID.test(id) || id.startsWith('core.')) problem = `"${id}" is not an allowed plugin id`;
  else if (m.core === true) problem = 'core plugins cannot be installed from a file';
  else if (typeof main !== 'string' || !p.files.has(main.replace(/^\.\//, ''))) problem = 'its code file is missing';

  const installed = pluginStore.plugins.find((x) => x.manifest.id === id);
  const cmp = installed ? compareVersions(version, installed.manifest.version) : 1;
  return {
    folder: p.folder,
    id,
    name: typeof m.name === 'string' ? m.name : (p.info?.name ?? id),
    version,
    author: typeof m.author === 'string' ? m.author : (p.info?.author ?? ''),
    description: typeof m.description === 'string' ? m.description : (p.info?.description ?? ''),
    nodeTypes,
    usedBy: pages.filter((c) => [...nodeTypesOfPage(c.files)].some((t) => nodeTypes.includes(t))).map((c) => c.name),
    status: !installed ? 'new' : cmp > 0 ? 'update' : cmp === 0 ? 'same' : 'newer',
    installedVersion: installed?.manifest.version,
    installedEnabled: !!installed?.enabled,
    problem,
  };
}

/**
 * Installs (or updates) the chosen bundled plugins into the plugins folder and enables them.
 * Plugins run with full app access, so this only runs for plugins the user ticked in the import dialog.
 */
export async function installPackagePlugins(preview: PackagePreview, ids: string[]): Promise<string[]> {
  const chosen = preview.plugins.filter((p) => ids.includes(p.id) && !p.problem);
  if (chosen.length === 0) return [];
  const bundled = unpackedPluginCache.get(preview.path) ?? (await unpackPackage(
    await (await import('@tauri-apps/plugin-fs')).readFile(preview.path)
  )).plugins;
  const { writeFile, mkdir, exists, rename, remove } = await import('@tauri-apps/plugin-fs');
  const root = (await getPluginsDir()).replace(/\\/g, '/');
  const installed: string[] = [];

  for (const plugin of chosen) {
    const source = bundled.find((b) => b.folder === plugin.folder);
    if (!source) continue;
    if (plugin.status === 'same' || plugin.status === 'newer') {
      installed.push(plugin.id);
      continue;
    }
    const current = pluginStore.plugins.find((p) => p.manifest.id === plugin.id);
    const target = current ? current.path.replace(/\\/g, '/') : `${root}/${sanitizeFolderName(plugin.id)}`;
    // Written next to the target first, then swapped in, so a failed write never leaves half a plugin.
    const staging = `${root}/.install-${crypto.randomUUID()}`;
    try {
      for (const [rel, data] of source.files) {
        const slash = rel.lastIndexOf('/');
        await mkdir(slash > 0 ? `${staging}/${rel.slice(0, slash)}` : staging, { recursive: true });
        await writeFile(`${staging}/${rel}`, data);
      }
      if (await exists(target)) await remove(target, { recursive: true });
      await rename(staging, target);
      installed.push(plugin.id);
    } catch (error) {
      await remove(staging, { recursive: true }).catch(() => {});
      throw new Error(`Could not install plugin "${plugin.name}": ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  await pluginStore.rescan();
  for (const id of installed) {
    const p = pluginStore.plugins.find((x) => x.manifest.id === id);
    if (p && !p.enabled) await pluginStore.setEnabled(id, true);
  }
  return installed;
}

function countEdges(files: Map<string, Uint8Array>): number {
  const ids = new Set<string>();
  for (const path of files.keys()) {
    const m = /^edges\/([^/]+)/.exec(path);
    if (m) ids.add(m[1].replace(/\.json$/, ''));
  }
  return ids.size;
}

interface PackageMeta {
  id?: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
  settings?: Record<string, unknown>;
}

function readJson(files: Map<string, Uint8Array>, path: string): Record<string, unknown> | null {
  const bytes = files.get(path);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Canvas metadata from a v3 (canvas.json) or v2 (.mosaic/meta.json + workspace.json) page. */
function readMeta(files: Map<string, Uint8Array>): PackageMeta {
  const v3 = readJson(files, CANVAS_FILE) as Partial<CanvasFile> | null;
  if (v3 && (v3.formatVersion ?? 0) >= CANVAS_FORMAT_VERSION) {
    return { id: v3.id, description: v3.description, tags: v3.tags, createdAt: v3.createdAt, settings: v3.settings };
  }
  const v2 = readJson(files, '.mosaic/meta.json') ?? {};
  const workspace = readJson(files, 'workspace.json') as { metadata?: { settings?: Record<string, unknown> } } | null;
  return {
    id: typeof v2.id === 'string' ? v2.id : undefined,
    description: typeof v2.description === 'string' ? v2.description : undefined,
    tags: Array.isArray(v2.tags) ? (v2.tags as string[]) : undefined,
    createdAt: typeof v2.created_at === 'string' ? v2.created_at : undefined,
    settings: workspace?.metadata?.settings,
  };
}

/** Rewrites a v2 page's files to the v3 layout. */
function toV3Layout(files: Map<string, Uint8Array>) {
  const workspace = readJson(files, 'workspace.json');
  for (const path of [...files.keys()]) {
    const legacyEdge = /^edges\/([^/]+)\/joined\.json$/.exec(path);
    if (legacyEdge) {
      const flat = `edges/${legacyEdge[1]}.json`;
      if (!files.has(flat)) files.set(flat, files.get(path)!);
      files.delete(path);
    } else if (path.startsWith('.mosaic/')) {
      files.delete(path);
    }
  }
  // v2 manifests only index files; v1 manifests (no metadata) still hold node data the app migrates.
  if (workspace?.metadata) files.delete('workspace.json');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Packs the given pages (all of them = a vault package) and writes the file. */
export async function exportPagesTo(
  filePath: string,
  canvases: CanvasInfo[],
  options: { includePlugins?: boolean } = {}
): Promise<{ plugins: string[]; missingTypes: string[] }> {
  const vault = vaultStore.currentVault;
  if (!vault) throw new Error('No vault is open');
  if (canvases.length === 0) throw new Error('Choose at least one page');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  await Promise.all([flushNodeSaves(), flushEdgeSaves()]);

  const inputs = [];
  for (const c of canvases) inputs.push({ name: c.name, files: await collectFiles(c.path) });
  const whole = canvases.length === vaultStore.canvases.length && canvases.length > 1;
  const kind = canvases.length === 1 ? 'canvas' : whole ? 'vault' : 'pages';

  const types = new Set(inputs.flatMap((i) => [...nodeTypesOfPage(i.files)]));
  const usage = pluginUsage(types);
  const plugins: PackPluginInput[] = [];
  if (options.includePlugins !== false) {
    for (const { plugin, nodeTypes } of usage.plugins) {
      const m = plugin.manifest;
      plugins.push({ id: m.id, name: m.name, version: m.version, author: m.author, description: m.description, nodeTypes, files: await collectFiles(plugin.path) });
    }
  }
  await writeFile(filePath, await packPages(inputs, { kind, vaultName: vault.name, plugins }));
  return { plugins: plugins.map((p) => p.name), missingTypes: usage.missing };
}

/** Asks where to save, then exports. Returns the file path and what was bundled, or null if cancelled. */
export async function exportPagesDialog(
  canvases: CanvasInfo[],
  options: { includePlugins?: boolean } = {}
): Promise<{ path: string; plugins: string[]; missingTypes: string[] } | null> {
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
  return { path: filePath, ...(await exportPagesTo(filePath, canvases, options)) };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Reads and validates a package without changing anything. */
export async function readPackagePreview(filePath: string): Promise<PackagePreview> {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const { manifest, canvases, plugins, warnings } = await unpackPackage(await readFile(filePath));
  if (canvases.length === 0) throw new Error('No page found in this file');
  unpackedCache.set(filePath, canvases);
  unpackedPluginCache.set(filePath, plugins);

  const bundled = plugins.map((p) => describeBundledPlugin(p, canvases));
  const bundledTypes = new Set(bundled.flatMap((p) => p.nodeTypes));
  const usedTypes = new Set(canvases.flatMap((c) => [...nodeTypesOfPage(c.files)]));
  const missingTypes = pluginUsage(usedTypes).missing.filter((t) => !bundledTypes.has(t));

  const taken = new Set(vaultStore.canvases.map((c) => c.name.toLowerCase()));
  return {
    path: filePath,
    fileName: fileBaseName(filePath),
    manifest,
    plugins: bundled,
    missingTypes,
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

    const meta = readMeta(files);
    toV3Layout(files);
    const canvasFile: CanvasFile = {
      formatVersion: CANVAS_FORMAT_VERSION,
      id,
      vaultId: vault.id,
      name,
      description: meta.description ?? '',
      tags: meta.tags ?? [],
      createdAt: meta.createdAt ?? now,
      updatedAt: now,
      ...(meta.settings ? { settings: meta.settings } : {}),
    };
    files.set(CANVAS_FILE, encoder.encode(JSON.stringify(canvasFile, null, 2)));

    try {
      for (const dir of ['nodes', 'edges']) {
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
  unpackedPluginCache.delete(preview.path);
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
