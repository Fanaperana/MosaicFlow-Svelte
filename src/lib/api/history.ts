/**
 * History API
 * 
 * History tracking operations.
 */

import { safeInvoke } from './bridge';
import type { AppHistory, VaultHistoryEntry, CanvasHistoryEntry } from './types';
import { devStorage } from './dev-storage';

export async function load(): Promise<AppHistory> {
  return safeInvoke('load_history', {}, () =>
    devStorage.loadHistory()
  );
}

export async function trackVaultOpen(
  id: string,
  name: string,
  path: string
): Promise<void> {
  return safeInvoke('track_vault_open', { id, name, path }, () =>
    devStorage.trackVaultOpen(id, name, path)
  );
}

export async function trackCanvasOpen(
  id: string,
  vaultId: string,
  name: string,
  path: string
): Promise<void> {
  return safeInvoke('track_canvas_open', {
    id,
    vault_id: vaultId,
    name,
    path
  }, () => devStorage.trackCanvasOpen(id, vaultId, name, path));
}

export async function removeVault(vaultId: string): Promise<void> {
  return safeInvoke('remove_vault_from_history', { vault_id: vaultId }, () =>
    devStorage.removeVaultFromHistory(vaultId)
  );
}

export async function removeCanvas(canvasId: string): Promise<void> {
  return safeInvoke('remove_canvas_from_history', { canvas_id: canvasId }, () =>
    devStorage.removeCanvasFromHistory(canvasId)
  );
}

export async function getRecentVaults(limit?: number): Promise<VaultHistoryEntry[]> {
  return safeInvoke('get_recent_vaults', { limit: limit ?? null }, () =>
    devStorage.getRecentVaults(limit)
  );
}

export async function getRecentCanvases(
  vaultId?: string,
  limit?: number
): Promise<CanvasHistoryEntry[]> {
  return safeInvoke('get_recent_canvases', {
    vault_id: vaultId ?? null,
    limit: limit ?? null
  }, () => devStorage.getRecentCanvases(vaultId, limit));
}

export async function findVaultById(vaultId: string): Promise<VaultHistoryEntry | null> {
  return safeInvoke('find_vault_by_id', { vault_id: vaultId }, () =>
    devStorage.findVaultById(vaultId)
  );
}

export async function findCanvasById(canvasId: string): Promise<CanvasHistoryEntry | null> {
  return safeInvoke('find_canvas_by_id', { canvas_id: canvasId }, () =>
    devStorage.findCanvasById(canvasId)
  );
}
