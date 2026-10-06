// Export/import canvases as `.mosaic` packages (see @mosaicflow/vault-core/package).

import { toast } from 'svelte-sonner';
import { PACKAGE_EXTENSION, packCanvas, sanitizeFolderName, unpackPackage } from '@mosaicflow/vault-core';
import { vaultStore } from '$lib/stores/vault.svelte';
import { flushPendingSaves as flushNodeSaves } from './nodeFileService';
import { flushPendingSaves as flushEdgeSaves } from './edgeFileService';

const PACKAGE_FILTERS = [
  { name: 'MosaicFlow package', extensions: [PACKAGE_EXTENSION] },
  { name: 'Zip archive', extensions: ['zip'] },
];

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

export async function exportCanvasPackage(): Promise<boolean> {
  const canvas = vaultStore.currentCanvas;
  if (!canvas) return false;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const filePath = await save({
      title: 'Export Canvas Package',
      defaultPath: `${sanitizeFolderName(canvas.name)}.${PACKAGE_EXTENSION}`,
      filters: PACKAGE_FILTERS.slice(0, 1),
    });
    if (!filePath) return false;

    await exportCanvasPackageTo(filePath);
    toast.success('Canvas package exported', { description: filePath });
    return true;
  } catch (error) {
    console.error('Error exporting canvas package:', error);
    toast.error('Failed to export canvas package');
    return false;
  }
}

export async function exportCanvasPackageTo(filePath: string): Promise<void> {
  const canvas = vaultStore.currentCanvas;
  if (!canvas) throw new Error('No canvas is open');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  await Promise.all([flushNodeSaves(), flushEdgeSaves()]);
  const files = await collectFiles(canvas.path);
  await writeFile(filePath, await packCanvas({ name: canvas.name, files }));
}

/** Asks for a `.mosaic` (or plain zip) file and imports every canvas in it into the open vault. */
export async function importCanvasPackage(): Promise<number> {
  if (!vaultStore.currentVault) return 0;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const picked = await open({ title: 'Import Canvas Package', multiple: false, directory: false, filters: PACKAGE_FILTERS });
    if (!picked || typeof picked !== 'string') return 0;

    const { names, warnings } = await importPackageFile(picked);
    const imported = names.length === 1 ? `"${names[0]}"` : `${names.length} canvases`;
    if (warnings.length) {
      console.warn('Package import warnings:', warnings);
      toast.warning(`Imported ${imported} with ${warnings.length} warning(s)`, { description: warnings.slice(0, 3).join('\n') });
    } else {
      toast.success(`Imported ${imported}`);
    }
    return names.length;
  } catch (error) {
    console.error('Error importing canvas package:', error);
    toast.error('Failed to import package', { description: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

export async function importPackageFile(filePath: string): Promise<{ names: string[]; warnings: string[] }> {
  const vault = vaultStore.currentVault;
  if (!vault) throw new Error('No vault is open');
  const { readFile, writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

  const { canvases, warnings } = await unpackPackage(await readFile(filePath));
  if (canvases.length === 0) throw new Error('No canvas found in this file');

  const canvasesDir = `${vault.path}/canvases`;
  const takenNames = new Set(vaultStore.canvases.map((c) => c.name.toLowerCase()));
  const now = new Date().toISOString();
  const names: string[] = [];
  const encoder = new TextEncoder();

  for (const canvas of canvases) {
    // Never overwrite: pick "Name", "Name (2)", ... until both the name and folder are free.
    let name = canvas.name;
    let folder = `${canvasesDir}/${sanitizeFolderName(name)}`;
    for (let n = 2; takenNames.has(name.toLowerCase()) || (await exists(folder)); n++) {
      name = `${canvas.name} (${n})`;
      folder = `${canvasesDir}/${sanitizeFolderName(name)}`;
    }
    takenNames.add(name.toLowerCase());

    const files = canvas.files;
    let meta: Record<string, unknown> = {};
    const metaBytes = files.get('.mosaic/meta.json');
    if (metaBytes) {
      try {
        meta = JSON.parse(new TextDecoder().decode(metaBytes));
      } catch {
        meta = {};
      }
    }
    meta = {
      description: '',
      tags: [],
      created_at: now,
      version: '2.0.0',
      ...meta,
      id: crypto.randomUUID(),
      vault_id: vault.id,
      name,
      updated_at: now,
    };
    files.set('.mosaic/meta.json', encoder.encode(JSON.stringify(meta, null, 2)));
    if (!files.has('workspace.json')) {
      files.set('workspace.json', encoder.encode(JSON.stringify({ version: '2.0.0', nodes: [], edges: [], settings: {} }, null, 2)));
    }

    for (const dir of ['.mosaic', 'nodes', 'edges', 'images', 'attachments']) {
      await mkdir(`${folder}/${dir}`, { recursive: true });
    }
    for (const [rel, data] of files) {
      const slash = rel.lastIndexOf('/');
      if (slash > 0) await mkdir(`${folder}/${rel.slice(0, slash)}`, { recursive: true });
      await writeFile(`${folder}/${rel}`, data);
    }
    names.push(name);
  }

  await vaultStore.refreshCanvases();
  return { names, warnings };
}

