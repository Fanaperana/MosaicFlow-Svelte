// `.mosaic` packages: a zip of one or more canvas folders, laid out exactly as they sit in a vault.
//
//   mimetype         "application/vnd.mosaicflow+zip" (first entry, stored) so tools can sniff it
//   manifest.json    PackageManifest
//   <Canvas>/...     .mosaic/meta.json, workspace.json, nodes/*.md, edges/*/joined.json, images/...
//
// A hand-made zip of a canvas folder (no manifest) is accepted too.

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';

export const PACKAGE_EXTENSION = 'mosaic';
export const PACKAGE_MIMETYPE = 'application/vnd.mosaicflow+zip';
export const PACKAGE_FORMAT = 'mosaicflow-package';
export const PACKAGE_FORMAT_VERSION = 1;

export interface PackageManifest {
  format: typeof PACKAGE_FORMAT;
  formatVersion: number;
  /** canvas: one page, pages: a selection, vault: every page of a vault. */
  kind: 'canvas' | 'pages' | 'vault';
  app: string;
  createdAt: string;
  /** Vault the pages were exported from. */
  vault?: { name: string };
  canvases: { name: string; folder: string }[];
  /** sha256 (hex) of every packaged file, keyed by its path inside the zip. */
  files?: Record<string, string>;
}

export interface PackCanvasInput {
  name: string;
  /** Files relative to the canvas folder, using '/' separators. */
  files: Record<string, Uint8Array>;
  app?: string;
}

export interface PackOptions {
  kind?: PackageManifest['kind'];
  vaultName?: string;
  app?: string;
}

export interface UnpackLimits {
  maxEntries: number;
  maxTotalBytes: number;
  /** Max uncompressed/compressed ratio for entries over 1 MB. */
  maxRatio: number;
}

export interface UnpackedCanvas {
  /** Name from meta.json, else the folder name. */
  name: string;
  /** Files relative to the canvas folder. */
  files: Map<string, Uint8Array>;
}

export interface UnpackResult {
  manifest: PackageManifest | null;
  canvases: UnpackedCanvas[];
  warnings: string[];
}

export const DEFAULT_UNPACK_LIMITS: UnpackLimits = {
  maxEntries: 20_000,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxRatio: 200,
};

const IGNORED = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i;

/** Folder name used inside the package (and on import); mirrors the backend's sanitize_name. */
export function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N} _-]/gu, '_').trim();
  return cleaned || 'Canvas';
}

/** Normalises a zip entry path and rejects anything that could escape the target folder. */
export function safeEntryPath(raw: string): string {
  const path = raw.replace(/\\/g, '/');
  if (path.includes('\0') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    throw new Error(`Unsafe path in package: ${raw}`);
  }
  const segments = path.split('/').filter((s, i, all) => !(s === '' && i === all.length - 1));
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error(`Unsafe path in package: ${raw}`);
  }
  return segments.join('/');
}

async function sha256Hex(data: Uint8Array): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function packCanvas(input: PackCanvasInput): Promise<Uint8Array> {
  return packPages([input], { kind: 'canvas', app: input.app });
}

/** Packs every canvas of a vault (kind "vault"); importing it adds all of them. */
export async function packVault(canvases: PackCanvasInput[], app?: string, vaultName?: string): Promise<Uint8Array> {
  if (canvases.length === 0) throw new Error('The vault has no canvases to export');
  return packPages(canvases, { kind: 'vault', app, vaultName });
}

/** Packs any set of canvases; kind defaults to "canvas" for one page and "pages" otherwise. */
export async function packPages(inputs: PackCanvasInput[], options: PackOptions = {}): Promise<Uint8Array> {
  if (inputs.length === 0) throw new Error('Nothing to export');
  const kind = options.kind ?? (inputs.length === 1 ? 'canvas' : 'pages');
  const entries: Record<string, Uint8Array> = {};
  const listed: PackageManifest['canvases'] = [];
  const usedFolders = new Set<string>();
  for (const input of inputs) {
    let folder = sanitizeFolderName(input.name);
    for (let i = 2; usedFolders.has(folder.toLowerCase()); i++) folder = `${sanitizeFolderName(input.name)} ${i}`;
    usedFolders.add(folder.toLowerCase());
    listed.push({ name: input.name, folder });
    for (const [rel, data] of Object.entries(input.files)) {
      entries[`${folder}/${safeEntryPath(rel)}`] = data;
    }
  }

  const hashes: Record<string, string> = {};
  for (const [path, data] of Object.entries(entries)) {
    const hash = await sha256Hex(data);
    if (hash) hashes[path] = hash;
  }

  const manifest: PackageManifest = {
    format: PACKAGE_FORMAT,
    formatVersion: PACKAGE_FORMAT_VERSION,
    kind,
    app: options.app ?? 'MosaicFlow',
    createdAt: new Date().toISOString(),
    ...(options.vaultName ? { vault: { name: options.vaultName } } : {}),
    canvases: listed,
    ...(Object.keys(hashes).length ? { files: hashes } : {}),
  };

  // Insertion order is zip order: mimetype must be first and uncompressed.
  const zippable: Zippable = {
    mimetype: [strToU8(PACKAGE_MIMETYPE), { level: 0 }],
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  };
  for (const [path, data] of Object.entries(entries)) zippable[path] = data;
  return zipSync(zippable, { level: 6 });
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Canvas root for a path that marks a canvas folder, e.g. "A/.mosaic/meta.json" -> "A". */
function canvasRootOf(path: string): string | null {
  const match = /^(?:(.*)\/)?(?:\.mosaic\/meta\.json|nodes\/[^/]+\.md)$/.exec(path);
  return match ? (match[1] ?? '') : null;
}

export async function unpackPackage(bytes: Uint8Array, limits: UnpackLimits = DEFAULT_UNPACK_LIMITS): Promise<UnpackResult> {
  if (!isZip(bytes)) throw new Error('Not a MosaicFlow package (expected a zip file)');

  let count = 0;
  let total = 0;
  const raw = unzipSync(bytes, {
    filter(file) {
      if (++count > limits.maxEntries) throw new Error(`Package has more than ${limits.maxEntries} files`);
      total += file.originalSize;
      if (total > limits.maxTotalBytes) throw new Error('Package is too large to import');
      if (file.originalSize > 1024 * 1024 && file.size > 0 && file.originalSize / file.size > limits.maxRatio) {
        throw new Error(`Suspicious compression ratio for ${file.name}`);
      }
      return !file.name.endsWith('/') && !IGNORED.test(file.name);
    },
  });

  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(raw)) files.set(safeEntryPath(name), data);

  const warnings: string[] = [];
  let manifest: PackageManifest | null = null;
  const manifestBytes = files.get('manifest.json');
  if (manifestBytes) {
    try {
      const parsed = JSON.parse(strFromU8(manifestBytes));
      if (parsed?.format === PACKAGE_FORMAT) manifest = parsed;
    } catch {
      warnings.push('manifest.json is not valid JSON; importing the files as found');
    }
  }
  if (manifest && manifest.formatVersion > PACKAGE_FORMAT_VERSION) {
    throw new Error(`This package was made by a newer MosaicFlow (format v${manifest.formatVersion}); please update the app`);
  }

  if (manifest?.files) {
    for (const [path, expected] of Object.entries(manifest.files)) {
      const data = files.get(path);
      if (!data) {
        warnings.push(`Missing file: ${path}`);
        continue;
      }
      const actual = await sha256Hex(data);
      if (actual && actual !== expected) warnings.push(`File changed since export: ${path}`);
    }
  }

  // Outermost folders that look like canvases; nested matches belong to their parent canvas.
  const roots = [...new Set([...files.keys()].map(canvasRootOf).filter((r): r is string => r !== null))]
    .sort((a, b) => a.length - b.length)
    .filter((root, i, all) => !all.slice(0, i).some((p) => p === '' || root.startsWith(`${p}/`)));

  const canvases: UnpackedCanvas[] = roots.map((root) => {
    const prefix = root ? `${root}/` : '';
    const canvasFiles = new Map<string, Uint8Array>();
    for (const [path, data] of files) {
      if (path.startsWith(prefix) && !(root === '' && (path === 'mimetype' || path === 'manifest.json'))) {
        canvasFiles.set(path.slice(prefix.length), data);
      }
    }

    let name = '';
    const meta = canvasFiles.get('.mosaic/meta.json');
    if (meta) {
      try {
        name = String(JSON.parse(strFromU8(meta)).name ?? '');
      } catch {
        warnings.push(`${root || 'root'}: meta.json is not valid JSON`);
      }
    }
    name ||= manifest?.canvases.find((c) => c.folder === root)?.name ?? root.split('/').pop() ?? '';
    return { name: name.trim() || 'Imported canvas', files: canvasFiles };
  });

  return { manifest, canvases, warnings };
}

export interface LinkRewrite {
  /** Old page name -> new page name (pages renamed on import). */
  names: Map<string, string>;
  /** Old page id -> new page id (used by Page link blocks). */
  ids: Map<string, string>;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Repoints links inside node files after pages were renamed or got new ids:
 * `[[Old#Node]]` / `[[Old]]` wikilinks (body and text fields), embed `ref: Old#Node`,
 * and Page link `canvasId`/`page`. Returns the files that changed (path -> new content).
 */
export function rewritePackageLinks(files: Map<string, Uint8Array>, rewrite: LinkRewrite): Map<string, Uint8Array> {
  const changed = new Map<string, Uint8Array>();
  const renames = [...rewrite.names].filter(([from, to]) => from.toLowerCase() !== to.toLowerCase());
  const ids = new Map([...rewrite.ids].filter(([from, to]) => from && from !== to));
  if (renames.length === 0 && ids.size === 0) return changed;

  const patterns = renames.map(([from, to]) => ({
    link: new RegExp(`\\[\\[\\s*${escapeRegExp(from)}\\s*(?=[#|\\]])`, 'gi'),
    ref: new RegExp(`^\\s*${escapeRegExp(from)}\\s*(?=#|$)`, 'i'),
    from: from.toLowerCase(),
    to,
  }));
  const relink = (text: string) => patterns.reduce((t, p) => t.replace(p.link, `[[${p.to}`), text);
  const deep = (value: unknown): unknown => {
    if (typeof value === 'string') return relink(value);
    if (Array.isArray(value)) return value.map(deep);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deep(v)]));
    }
    return value;
  };

  for (const [path, bytes] of files) {
    if (!/^nodes\/[^/]+\.md$/.test(path)) continue;
    let parsed: ReturnType<typeof parseFrontmatter>;
    try {
      parsed = parseFrontmatter(strFromU8(bytes));
    } catch {
      continue;
    }
    const attributes = parsed.attributes as Record<string, unknown>;
    const data = (attributes.data as Record<string, unknown>) ?? {};
    const nextData = deep(data) as Record<string, unknown>;
    if (typeof nextData.ref === 'string') {
      for (const p of patterns) nextData.ref = (nextData.ref as string).replace(p.ref, p.to);
    }
    if (typeof nextData.page === 'string') {
      const hit = patterns.find((p) => p.from === (nextData.page as string).trim().toLowerCase());
      if (hit) nextData.page = hit.to;
    }
    if (typeof nextData.canvasId === 'string' && ids.has(nextData.canvasId)) {
      nextData.canvasId = ids.get(nextData.canvasId);
    }
    const body = relink(parsed.body);
    if (body === parsed.body && JSON.stringify(nextData) === JSON.stringify(data)) continue;
    changed.set(path, strToU8(stringifyFrontmatter({ ...attributes, data: nextData }, body)));
  }
  return changed;
}
