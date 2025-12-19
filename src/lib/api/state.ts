/**
 * State API
 * 
 * App-level state operations.
 */

import { safeInvoke } from './bridge';
import type { AppState } from './types';
import { devStorage } from './dev-storage';

export async function load(): Promise<AppState> {
  return safeInvoke('load_app_state', {}, () =>
    devStorage.loadAppState()
  );
}

export async function save(state: AppState): Promise<void> {
  return safeInvoke('save_app_state', { state }, () =>
    devStorage.saveAppState(state)
  );
}

export async function updateLastOpened(
  vaultId?: string | null,
  canvasId?: string | null
): Promise<void> {
  return safeInvoke('update_last_opened', {
    vault_id: vaultId ?? null,
    canvas_id: canvasId ?? null
  }, () => devStorage.updateLastOpened(vaultId, canvasId));
}
