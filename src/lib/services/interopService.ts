// Import other formats into new canvases, and export to Obsidian JSON Canvas.

import { toast } from 'svelte-sonner';
import {
  VaultRepository,
  exportJsonCanvas,
  importJsonCanvas,
  importMarkdownFiles,
  importMermaid,
  importMosaicJson,
  isJsonCanvas,
  isMosaicJson,
  sanitizeFolderName,
  type ImportResult,
  type MarkdownFile,
  type StoredNode,
} from '@mosaicflow/vault-core';
import { vaultStore } from '$lib/stores/vault.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import { tauriFsAdapter } from './tauriFsAdapter';
import { packageDialogs } from '$lib/stores/packages.svelte';

const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_MARKDOWN_FILES = 300;

export const IMPORT_FILTERS = [
  { name: 'All supported', extensions: ['mosaic', 'zip', 'canvas', 'json', 'mmd', 'mermaid', 'md'] },
  { name: 'MosaicFlow package', extensions: ['mosaic', 'zip'] },
  { name: 'Obsidian canvas', extensions: ['canvas'] },
  { name: 'MosaicFlow JSON', extensions: ['json'] },
  { name: 'Mermaid flowchart', extensions: ['mmd', 'mermaid', 'md'] },
];

function baseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop()!.replace(/\.[^.]+$/, '');
}

async function readText(path: string): Promise<string> {
  const { readTextFile, stat } = await import('@tauri-apps/plugin-fs');
  const info = await stat(path);
  if (info.size > MAX_TEXT_BYTES) throw new Error(`File is too large to import (${Math.round(info.size / 1024 / 1024)} MB)`);
  return readTextFile(path);
}

/** Writes an import result into a new canvas (name made unique) and returns its name. */
async function writeImported(name: string, result: ImportResult, description: string): Promise<string> {
  const vault = vaultStore.currentVault;
  if (!vault) throw new Error('No vault is open');
  if (result.nodes.length === 0) throw new Error('Nothing to import');
  const repoVault = new VaultRepository(tauriFsAdapter, vault.path.replace(/\\/g, '/'));
  const existing = new Set((await repoVault.listCanvases()).flatMap((c) => [c.name.toLowerCase(), c.folder.toLowerCase()]));
  let unique = name.trim() || 'Imported canvas';
  for (let i = 2; existing.has(unique.toLowerCase()) || existing.has(sanitizeFolderName(unique).toLowerCase()); i++) unique = `${name} (${i})`;

  const { repo } = await repoVault.createCanvas({ name: unique, description, tags: ['imported'] });
  for (const n of result.nodes) await repo.writeNode(n);
  for (const e of result.edges) await repo.writeEdge(e);
  return unique;
}

async function finish(name: string, warnings: string[]) {
  await vaultStore.refreshCanvases();
  if (warnings.length) {
    console.warn('Import warnings:', warnings);
    toast.warning(`Imported "${name}" with ${warnings.length} warning(s)`, { description: warnings.slice(0, 3).join('\n') });
  } else {
    toast.success(`Imported "${name}"`);
  }
  const canvas = vaultStore.canvases.find((c) => c.name === name);
  if (canvas) await vaultStore.openCanvas(canvas);
}

/** Imports one file of any supported format. Returns the new canvas name (or null). Packages open a preview instead. */
export async function importPath(path: string): Promise<string | null> {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const name = baseName(path);

  if (ext === 'mosaic' || ext === 'zip') {
    await packageDialogs.openImport(path);
    return null;
  }

  const text = await readText(path);
  let result: ImportResult;
  let description: string;
  if (ext === 'canvas' || ext === 'json') {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new Error('The file is not valid JSON');
    }
    if (isJsonCanvas(doc)) {
      result = importJsonCanvas(doc as Parameters<typeof importJsonCanvas>[0]);
      description = `Imported from Obsidian canvas ${name}.canvas`;
    } else if (isMosaicJson(doc)) {
      result = importMosaicJson(doc as Parameters<typeof importMosaicJson>[0]);
      description = `Imported from ${name}.json`;
    } else {
      throw new Error('Unrecognised JSON: expected an Obsidian canvas or a MosaicFlow JSON export');
    }
  } else if (ext === 'mmd' || ext === 'mermaid') {
    result = importMermaid(text);
    description = `Imported from Mermaid ${name}.${ext}`;
  } else if (ext === 'md') {
    // A markdown file with a mermaid block imports the diagram; otherwise it becomes one note.
    const block = /```mermaid\s*\n([\s\S]*?)```/.exec(text);
    result = block ? importMermaid(block[1]) : importMarkdownFiles([{ path: `${name}.md`, content: text }]);
    description = `Imported from ${name}.md`;
  } else {
    throw new Error(`Unsupported file type: .${ext}`);
  }

  const created = await writeImported(name, result, description);
  await finish(created, result.warnings);
  return created;
}

export async function importFileDialog(): Promise<void> {
  if (!vaultStore.currentVault) return;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const picked = await open({ title: 'Import into vault', multiple: false, directory: false, filters: IMPORT_FILTERS });
    if (typeof picked === 'string') await importPath(picked);
  } catch (error) {
    console.error('Import failed:', error);
    toast.error('Import failed', { description: error instanceof Error ? error.message : String(error) });
  }
}

async function collectMarkdown(root: string, rel = '', out: MarkdownFile[] = []): Promise<MarkdownFile[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs');
  for (const entry of await readDir(rel ? `${root}/${rel}` : root)) {
    if (out.length >= MAX_MARKDOWN_FILES + 1) break;
    // Skip tool folders (.obsidian, .trash, .git) and symlinks.
    if (entry.name.startsWith('.') || entry.isSymlink) continue;
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory) await collectMarkdown(root, path, out);
    else if (entry.name.toLowerCase().endsWith('.md')) {
      try {
        out.push({ path, content: await readText(`${root}/${path}`) });
      } catch (error) {
        console.warn(`Skipping ${path}:`, error);
      }
    }
  }
  return out;
}

export async function importMarkdownFolderPath(folder: string): Promise<string> {
  const files = await collectMarkdown(folder);
  if (files.length === 0) throw new Error('No markdown (.md) files found in that folder');
  const result = importMarkdownFiles(files, { maxNotes: MAX_MARKDOWN_FILES });
  const name = await writeImported(baseName(folder), result, `Imported ${Math.min(files.length, MAX_MARKDOWN_FILES)} notes from ${baseName(folder)}`);
  await finish(name, result.warnings);
  return name;
}

export async function importMarkdownFolderDialog(): Promise<void> {
  if (!vaultStore.currentVault) return;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const picked = await open({ title: 'Import a folder of markdown notes', directory: true, multiple: false });
    if (typeof picked === 'string') await importMarkdownFolderPath(picked);
  } catch (error) {
    console.error('Markdown import failed:', error);
    toast.error('Import failed', { description: error instanceof Error ? error.message : String(error) });
  }
}

/** Imports dropped files/folders (folders are treated as markdown note folders). */
export async function importDropped(paths: string[]): Promise<void> {
  const { stat } = await import('@tauri-apps/plugin-fs');
  for (const path of paths) {
    try {
      const info = await stat(path);
      if (info.isDirectory) await importMarkdownFolderPath(path);
      else await importPath(path);
    } catch (error) {
      console.error(`Import of ${path} failed:`, error);
      toast.error(`Could not import ${baseName(path)}`, { description: error instanceof Error ? error.message : String(error) });
    }
  }
}

// ---------------------------------------------------------------------------
// Export to Obsidian JSON Canvas
// ---------------------------------------------------------------------------

export function currentCanvasAsJsonCanvas() {
  const nodes: StoredNode[] = workspace.nodes.map((n) => ({
    id: n.id, type: n.type as string, position: n.position, width: n.width ?? n.measured?.width, height: n.height ?? n.measured?.height,
    parentId: n.parentId, data: n.data as Record<string, unknown>,
  }));
  const edges = workspace.edges.map((e) => ({
    id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
    label: e.label, data: e.data as Record<string, unknown> | undefined,
  }));
  const bodyText = (n: StoredNode) => {
    const field = nodeRegistry.getBodyMapping(n.type).field;
    const title = String(n.data.title ?? '');
    const body = typeof n.data[field] === 'string' ? String(n.data[field]) : typeof n.data.code === 'string' ? `\`\`\`${n.data.language ?? ''}\n${n.data.code}\n\`\`\`` : '';
    return !title || body.trim() === title || body.trim().startsWith('#') ? body : `## ${title}\n\n${body}`.trim();
  };
  return exportJsonCanvas(nodes, edges, bodyText);
}

export async function exportJsonCanvasDialog(): Promise<boolean> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      title: 'Export as Obsidian canvas',
      defaultPath: `${sanitizeFolderName(workspace.name)}.canvas`,
      filters: [{ name: 'Obsidian canvas', extensions: ['canvas'] }],
    });
    if (!filePath) return false;
    await writeTextFile(filePath, JSON.stringify(currentCanvasAsJsonCanvas(), null, 2));
    toast.success('Exported as Obsidian canvas', { description: filePath });
    return true;
  } catch (error) {
    console.error('JSON Canvas export failed:', error);
    toast.error('Export failed');
    return false;
  }
}
