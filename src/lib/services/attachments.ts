// Images brought into the app (dropped, pasted, picked) are copied into <vault>/attachments, so the
// vault stays self-contained; nodes and notes refer to them vault-relative ("attachments/x.png").

import { convertFileSrc } from '@tauri-apps/api/core';
import { VaultRepository, isAttachmentPath, isImageFileName } from '@mosaicflow/vault-core';
import { vaultStore } from '$lib/stores/vault.svelte';
import { tauriFs } from './tauriFs';

function vault(): VaultRepository {
  const root = vaultStore.currentVaultPath;
  if (!root) throw new Error('Open a vault first');
  return new VaultRepository(tauriFs, root.replaceAll('\\', '/'));
}

export { isImageFileName };

export async function importImageBytes(bytes: Uint8Array, name: string) {
  return vault().saveImage(bytes, name);
}

/** Copies an image file (e.g. dropped from the file manager) into the vault. */
export async function importImageFile(path: string) {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const name = path.split(/[\\/]/).pop() ?? 'image';
  return importImageBytes(await readFile(path), name);
}

/** Display URL for a vault-relative attachment path; null for anything outside attachments/. */
export function attachmentUrl(path: string): string | null {
  const root = vaultStore.currentVaultPath;
  if (!root || !isAttachmentPath(path)) return null;
  return convertFileSrc(`${root.replaceAll('\\', '/')}/${path}`);
}
