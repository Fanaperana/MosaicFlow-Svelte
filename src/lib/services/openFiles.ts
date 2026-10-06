// Files the OS asked MosaicFlow to open (double-clicked .mosaic, "Open with", second launch).
// They are imported into the open vault; if none is open yet they wait until one is.

import { toast } from 'svelte-sonner';
import { vaultStore } from '$lib/stores/vault.svelte';
import { importPath } from './interopService';

const queue: string[] = [];
let busy = false;

async function drain() {
  const { invoke } = await import('@tauri-apps/api/core');
  queue.push(...(await invoke<string[]>('take_pending_open_files')));
  await processOpenFiles();
}

export async function initOpenFiles(): Promise<() => void> {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<string[]>('mosaicflow://open-files', () => drain());
    await drain();
    return unlisten;
  } catch (error) {
    console.warn('[open-files] unavailable:', error);
    return () => {};
  }
}

export async function processOpenFiles() {
  if (busy || queue.length === 0) return;
  if (!vaultStore.currentVault) {
    toast.info('Open a vault to import the file', { id: 'open-files', description: queue.map((p) => p.split(/[\\/]/).pop()).join(', ') });
    return;
  }
  busy = true;
  try {
    while (queue.length) {
      const path = queue.shift()!;
      try {
        await importPath(path);
      } catch (error) {
        toast.error(`Could not open ${path.split(/[\\/]/).pop()}`, { description: error instanceof Error ? error.message : String(error) });
      }
    }
  } finally {
    busy = false;
  }
}
