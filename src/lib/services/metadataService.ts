/**
 * MosaicFlow Metadata Service (V2)
 * 
 * TypeScript wrapper for Rust metadata commands.
 * Provides UUID-based tracking for vaults and canvases with history management.
 * 
 * Data Flow:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    APP DATA                                  │
 * │  ~/.mosaicflow/data/                                        │
 * │  ├── data.json      ← Current state (last opened)          │
 * │  └── history.json   ← Recently opened items                 │
 * └─────────────────────────────────────────────────────────────┘
 *                              ↕ UUID references
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    VAULT                                     │
 * │  └── canvases/                                               │
 * │      └── MyCanvas/                                           │
 * │          ├── .mosaic/                                        │
 * │          │   ├── meta.json   ← Canvas UUID + metadata       │
 * │          │   └── state.json  ← Viewport, selection state    │
 * │          └── workspace.json  ← Nodes, edges                 │
 * └─────────────────────────────────────────────────────────────┘
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** App-level state tracking */
export interface AppState {
  last_vault_id: string | null;
  last_canvas_id: string | null;
  updated_at: string;
  version: string;
}

/** History of opened items */
export interface AppHistory {
  vaults: VaultHistoryEntry[];
  canvases: CanvasHistoryEntry[];
  max_items: number;
}

/** Entry in vault history */
export interface VaultHistoryEntry {
  id: string;
  name: string;
  path: string;
  last_opened: string;
  open_count: number;
  added_at: string;
}

/** Entry in canvas history */
export interface CanvasHistoryEntry {
  id: string;
  vault_id: string;
  name: string;
  path: string;
  last_opened: string;
  open_count: number;
  added_at: string;
}

/** Vault information (V2) */
export interface VaultInfoV2 {
  id: string;
  path: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  canvas_count: number;
}

/** Canvas information (V2) */
export interface CanvasInfoV2 {
  id: string;
  vault_id: string;
  name: string;
  description: string;
  path: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

/** Canvas UI state */
export interface CanvasState {
  viewport: ViewportState;
  selected_nodes: string[];
  selected_edges: string[];
  canvas_mode: string;
  updated_at: string;
}

/** Viewport state */
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================================
// DEV MODE HELPERS
// ============================================================================

const isDev = typeof window !== 'undefined' && !('__TAURI__' in window);

function generateDevUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// In-memory mock storage for dev mode
const mockStorage = {
  appState: {
    last_vault_id: null,
    last_canvas_id: null,
    updated_at: new Date().toISOString(),
    version: '1.0.0'
  } as AppState,
  history: {
    vaults: [],
    canvases: [],
    max_items: 50
  } as AppHistory,
  vaults: new Map<string, VaultInfoV2>(),
  canvases: new Map<string, CanvasInfoV2>(),
  canvasStates: new Map<string, CanvasState>()
};

// ============================================================================
// APP STATE MANAGEMENT
// ============================================================================

/** Load app state from data/data.json */
export async function loadAppState(): Promise<AppState> {
  if (isDev) {
    console.log('[DEV] Loading app state');
    return { ...mockStorage.appState };
  }
  
  return invoke<AppState>('load_app_state');
}

/** Save app state to data/data.json */
export async function saveAppState(state: AppState): Promise<void> {
  if (isDev) {
    console.log('[DEV] Saving app state:', state);
    mockStorage.appState = { ...state };
    return;
  }
  
  return invoke('save_app_state', { state });
}

/** Update last opened vault/canvas */
export async function updateLastOpened(
  vaultId?: string | null,
  canvasId?: string | null
): Promise<void> {
  if (isDev) {
    console.log('[DEV] Updating last opened:', { vaultId, canvasId });
    if (vaultId !== undefined) {
      mockStorage.appState.last_vault_id = vaultId;
    }
    if (canvasId !== undefined) {
      mockStorage.appState.last_canvas_id = canvasId;
    }
    mockStorage.appState.updated_at = new Date().toISOString();
    return;
  }
  
  return invoke('update_last_opened', {
    vault_id: vaultId ?? null,
    canvas_id: canvasId ?? null
  });
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

/** Load history from data/history.json */
export async function loadHistory(): Promise<AppHistory> {
  if (isDev) {
    console.log('[DEV] Loading history');
    return { ...mockStorage.history };
  }
  
  return invoke<AppHistory>('load_history');
}

/** Get recent vaults */
export async function getRecentVaults(limit?: number): Promise<VaultHistoryEntry[]> {
  if (isDev) {
    console.log('[DEV] Getting recent vaults, limit:', limit);
    return mockStorage.history.vaults.slice(0, limit ?? 10);
  }
  
  return invoke<VaultHistoryEntry[]>('get_recent_vaults', { limit: limit ?? null });
}

/** Get recent canvases (optionally filtered by vault) */
export async function getRecentCanvases(
  vaultId?: string,
  limit?: number
): Promise<CanvasHistoryEntry[]> {
  if (isDev) {
    console.log('[DEV] Getting recent canvases:', { vaultId, limit });
    let canvases = mockStorage.history.canvases;
    if (vaultId) {
      canvases = canvases.filter(c => c.vault_id === vaultId);
    }
    return canvases.slice(0, limit ?? 10);
  }
  
  return invoke<CanvasHistoryEntry[]>('get_recent_canvases', {
    vault_id: vaultId ?? null,
    limit: limit ?? null
  });
}

/** Remove vault from history */
export async function removeVaultFromHistory(vaultId: string): Promise<void> {
  if (isDev) {
    console.log('[DEV] Removing vault from history:', vaultId);
    mockStorage.history.vaults = mockStorage.history.vaults.filter(v => v.id !== vaultId);
    mockStorage.history.canvases = mockStorage.history.canvases.filter(c => c.vault_id !== vaultId);
    return;
  }
  
  return invoke('remove_vault_from_history', { vault_id: vaultId });
}

/** Remove canvas from history */
export async function removeCanvasFromHistory(canvasId: string): Promise<void> {
  if (isDev) {
    console.log('[DEV] Removing canvas from history:', canvasId);
    mockStorage.history.canvases = mockStorage.history.canvases.filter(c => c.id !== canvasId);
    return;
  }
  
  return invoke('remove_canvas_from_history', { canvas_id: canvasId });
}

// ============================================================================
// VAULT MANAGEMENT (V2)
// ============================================================================

/** Create a new vault with UUID */
export async function createVaultV2(
  path: string,
  name: string,
  description?: string
): Promise<VaultInfoV2> {
  if (isDev) {
    const id = generateDevUuid();
    const now = new Date().toISOString();
    const vault: VaultInfoV2 = {
      id,
      path,
      name,
      description: description ?? '',
      created_at: now,
      updated_at: now,
      canvas_count: 1
    };
    
    mockStorage.vaults.set(id, vault);
    mockStorage.history.vaults.unshift({
      id,
      name,
      path,
      last_opened: now,
      open_count: 1,
      added_at: now
    });
    
    // Create default canvas
    const canvasId = generateDevUuid();
    const canvas: CanvasInfoV2 = {
      id: canvasId,
      vault_id: id,
      name: 'Untitled',
      description: '',
      path: `${path}/canvases/Untitled`,
      created_at: now,
      updated_at: now,
      tags: []
    };
    
    mockStorage.canvases.set(canvasId, canvas);
    mockStorage.appState.last_vault_id = id;
    mockStorage.appState.last_canvas_id = canvasId;
    
    console.log('[DEV] Created vault:', vault);
    return vault;
  }
  
  return invoke<VaultInfoV2>('create_vault_v2', {
    path,
    name,
    description: description ?? null
  });
}

/** Open an existing vault */
export async function openVaultV2(path: string): Promise<VaultInfoV2> {
  if (isDev) {
    // Find vault by path
    const vault = Array.from(mockStorage.vaults.values()).find(v => v.path === path);
    if (vault) {
      const historyEntry = mockStorage.history.vaults.find(v => v.id === vault.id);
      if (historyEntry) {
        historyEntry.last_opened = new Date().toISOString();
        historyEntry.open_count++;
      }
      mockStorage.appState.last_vault_id = vault.id;
      console.log('[DEV] Opened vault:', vault);
      return vault;
    }
    
    // Create mock vault for dev
    return createVaultV2(path, 'Dev Vault');
  }
  
  return invoke<VaultInfoV2>('open_vault_v2', { path });
}

/** Rename a vault */
export async function renameVaultV2(
  vaultPath: string,
  newName: string
): Promise<VaultInfoV2> {
  if (isDev) {
    const vault = Array.from(mockStorage.vaults.values()).find(v => v.path === vaultPath);
    if (vault) {
      vault.name = newName;
      vault.updated_at = new Date().toISOString();
      
      const historyEntry = mockStorage.history.vaults.find(v => v.id === vault.id);
      if (historyEntry) {
        historyEntry.name = newName;
      }
      
      console.log('[DEV] Renamed vault:', vault);
      return vault;
    }
    throw new Error('Vault not found');
  }
  
  return invoke<VaultInfoV2>('rename_vault_v2', {
    vault_path: vaultPath,
    new_name: newName
  });
}

// ============================================================================
// CANVAS MANAGEMENT (V2)
// ============================================================================

/** Create a new canvas */
export async function createCanvasV2(
  vaultPath: string,
  vaultId: string,
  name: string,
  description?: string
): Promise<CanvasInfoV2> {
  if (isDev) {
    const id = generateDevUuid();
    const now = new Date().toISOString();
    const canvas: CanvasInfoV2 = {
      id,
      vault_id: vaultId,
      name,
      description: description ?? '',
      path: `${vaultPath}/canvases/${name}`,
      created_at: now,
      updated_at: now,
      tags: []
    };
    
    mockStorage.canvases.set(id, canvas);
    mockStorage.history.canvases.unshift({
      id,
      vault_id: vaultId,
      name,
      path: canvas.path,
      last_opened: now,
      open_count: 1,
      added_at: now
    });
    mockStorage.appState.last_canvas_id = id;
    
    console.log('[DEV] Created canvas:', canvas);
    return canvas;
  }
  
  return invoke<CanvasInfoV2>('create_canvas_v2', {
    vault_path: vaultPath,
    vault_id: vaultId,
    name,
    description: description ?? null
  });
}

/** Open a canvas */
export async function openCanvasV2(canvasPath: string): Promise<CanvasInfoV2> {
  if (isDev) {
    const canvas = Array.from(mockStorage.canvases.values()).find(c => c.path === canvasPath);
    if (canvas) {
      const historyEntry = mockStorage.history.canvases.find(c => c.id === canvas.id);
      if (historyEntry) {
        historyEntry.last_opened = new Date().toISOString();
        historyEntry.open_count++;
      }
      mockStorage.appState.last_canvas_id = canvas.id;
      console.log('[DEV] Opened canvas:', canvas);
      return canvas;
    }
    throw new Error('Canvas not found');
  }
  
  return invoke<CanvasInfoV2>('open_canvas_v2', { canvas_path: canvasPath });
}

/** List all canvases in a vault */
export async function listCanvasesV2(vaultPath: string): Promise<CanvasInfoV2[]> {
  if (isDev) {
    const vault = Array.from(mockStorage.vaults.values()).find(v => v.path === vaultPath);
    if (vault) {
      const canvases = Array.from(mockStorage.canvases.values())
        .filter(c => c.vault_id === vault.id);
      console.log('[DEV] Listed canvases:', canvases);
      return canvases;
    }
    return [];
  }
  
  return invoke<CanvasInfoV2[]>('list_canvases_v2', { vault_path: vaultPath });
}

/** Rename a canvas */
export async function renameCanvasV2(
  canvasPath: string,
  newName: string
): Promise<CanvasInfoV2> {
  if (isDev) {
    const canvas = Array.from(mockStorage.canvases.values()).find(c => c.path === canvasPath);
    if (canvas) {
      canvas.name = newName;
      canvas.updated_at = new Date().toISOString();
      
      const historyEntry = mockStorage.history.canvases.find(c => c.id === canvas.id);
      if (historyEntry) {
        historyEntry.name = newName;
      }
      
      console.log('[DEV] Renamed canvas:', canvas);
      return canvas;
    }
    throw new Error('Canvas not found');
  }
  
  return invoke<CanvasInfoV2>('rename_canvas_v2', {
    canvas_path: canvasPath,
    new_name: newName
  });
}

/** Delete a canvas */
export async function deleteCanvasV2(canvasPath: string): Promise<void> {
  if (isDev) {
    const canvas = Array.from(mockStorage.canvases.values()).find(c => c.path === canvasPath);
    if (canvas) {
      mockStorage.canvases.delete(canvas.id);
      mockStorage.history.canvases = mockStorage.history.canvases.filter(c => c.id !== canvas.id);
      console.log('[DEV] Deleted canvas:', canvasPath);
    }
    return;
  }
  
  return invoke('delete_canvas_v2', { canvas_path: canvasPath });
}

// ============================================================================
// CANVAS STATE MANAGEMENT
// ============================================================================

/** Save canvas UI state (viewport, selection, etc.) */
export async function saveCanvasState(
  canvasPath: string,
  state: Omit<CanvasState, 'updated_at'>
): Promise<void> {
  const fullState: CanvasState = {
    ...state,
    updated_at: new Date().toISOString()
  };
  
  if (isDev) {
    console.log('[DEV] Saving canvas state:', { canvasPath, state: fullState });
    mockStorage.canvasStates.set(canvasPath, fullState);
    return;
  }
  
  return invoke('save_canvas_state', {
    canvas_path: canvasPath,
    state: fullState
  });
}

/** Load canvas UI state */
export async function loadCanvasState(canvasPath: string): Promise<CanvasState> {
  if (isDev) {
    console.log('[DEV] Loading canvas state:', canvasPath);
    return mockStorage.canvasStates.get(canvasPath) ?? {
      viewport: { x: 0, y: 0, zoom: 1 },
      selected_nodes: [],
      selected_edges: [],
      canvas_mode: 'select',
      updated_at: new Date().toISOString()
    };
  }
  
  return invoke<CanvasState>('load_canvas_state', { canvas_path: canvasPath });
}

// ============================================================================
// LOOKUP COMMANDS
// ============================================================================

/** Find a vault by its UUID */
export async function findVaultById(vaultId: string): Promise<VaultHistoryEntry | null> {
  if (isDev) {
    console.log('[DEV] Finding vault by ID:', vaultId);
    return mockStorage.history.vaults.find(v => v.id === vaultId) ?? null;
  }
  
  return invoke<VaultHistoryEntry | null>('find_vault_by_id', { vault_id: vaultId });
}

/** Find a canvas by its UUID */
export async function findCanvasById(canvasId: string): Promise<CanvasHistoryEntry | null> {
  if (isDev) {
    console.log('[DEV] Finding canvas by ID:', canvasId);
    return mockStorage.history.canvases.find(c => c.id === canvasId) ?? null;
  }
  
  return invoke<CanvasHistoryEntry | null>('find_canvas_by_id', { canvas_id: canvasId });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Initialize app on startup - load last state and restore session */
export async function initializeApp(): Promise<{
  appState: AppState;
  lastVault: VaultHistoryEntry | null;
  lastCanvas: CanvasHistoryEntry | null;
}> {
  const appState = await loadAppState();
  
  let lastVault: VaultHistoryEntry | null = null;
  let lastCanvas: CanvasHistoryEntry | null = null;
  
  if (appState.last_vault_id) {
    lastVault = await findVaultById(appState.last_vault_id);
  }
  
  if (appState.last_canvas_id) {
    lastCanvas = await findCanvasById(appState.last_canvas_id);
  }
  
  return { appState, lastVault, lastCanvas };
}
