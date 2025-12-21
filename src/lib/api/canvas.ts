/**
 * Canvas API
 * 
 * All canvas-related backend operations.
 */

import { safeInvoke } from './bridge';
import type { CanvasInfo, CanvasUIState } from './types';
import { devStorage } from './dev-storage';

export async function create(
  vaultPath: string,
  vaultId: string,
  name: string,
  description?: string
): Promise<CanvasInfo> {
  return safeInvoke('create_canvas', {
    vaultPath,
    vaultId,
    name,
    description
  }, () => devStorage.createCanvas(vaultPath, vaultId, name, description));
}

export async function open(canvasPath: string): Promise<CanvasInfo> {
  return safeInvoke('open_canvas', { canvasPath }, () =>
    devStorage.openCanvas(canvasPath)
  );
}

export async function list(vaultPath: string): Promise<CanvasInfo[]> {
  return safeInvoke('list_canvases', { vaultPath }, () =>
    devStorage.listCanvases(vaultPath)
  );
}

export async function rename(canvasPath: string, newName: string): Promise<CanvasInfo> {
  return safeInvoke('rename_canvas', {
    canvasPath,
    newName
  }, () => devStorage.renameCanvas(canvasPath, newName));
}

export async function remove(canvasPath: string): Promise<void> {
  return safeInvoke('delete_canvas', { canvasPath }, () =>
    devStorage.deleteCanvas(canvasPath)
  );
}

export async function updateTags(canvasPath: string, tags: string[]): Promise<CanvasInfo> {
  return safeInvoke('update_canvas_tags', {
    canvasPath,
    tags
  });
}

export async function updateDescription(
  canvasPath: string,
  description: string
): Promise<CanvasInfo> {
  return safeInvoke('update_canvas_description', {
    canvasPath,
    description
  });
}

export async function loadState(canvasPath: string): Promise<CanvasUIState> {
  return safeInvoke('load_canvas_state', { canvasPath }, () =>
    devStorage.loadCanvasState(canvasPath)
  );
}

export async function saveState(canvasPath: string, state: Omit<CanvasUIState, 'updated_at'>): Promise<void> {
  const fullState: CanvasUIState = {
    ...state,
    updated_at: new Date().toISOString()
  };
  return safeInvoke('save_canvas_state', {
    canvasPath,
    state: fullState
  }, () => devStorage.saveCanvasState(canvasPath, fullState));
}
