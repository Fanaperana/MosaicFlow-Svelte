/**
 * Dev Storage
 * 
 * In-memory storage for development mode.
 * Mimics Rust backend behavior for testing without Tauri.
 */

import type {
  VaultInfo,
  CanvasInfo,
  CanvasUIState,
  AppState,
  AppHistory,
  VaultHistoryEntry,
  CanvasHistoryEntry,
  WorkspaceData,
  WorkspaceSettings
} from './types';

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

const defaultSettings: WorkspaceSettings = {
  grid_size: 20,
  snap_to_grid: true,
  show_minimap: true,
  auto_save: true,
  auto_save_interval: 1000,
  theme: 'dark',
  default_node_color: '#1e1e1e',
  default_edge_color: '#555555'
};

class DevStorage {
  private vaults = new Map<string, VaultInfo>();
  private canvases = new Map<string, CanvasInfo>();
  private canvasStates = new Map<string, CanvasUIState>();
  private workspaces = new Map<string, WorkspaceData>();
  private appState: AppState = {
    last_vault_id: null,
    last_canvas_id: null,
    updated_at: now(),
    version: '1.0.0'
  };
  private history: AppHistory = {
    vaults: [],
    canvases: [],
    max_items: 50
  };

  // Vault operations
  createVault(path: string, name: string, description?: string): VaultInfo {
    const id = generateUuid();
    const timestamp = now();
    
    const vault: VaultInfo = {
      id,
      path,
      name,
      description: description ?? '',
      created_at: timestamp,
      updated_at: timestamp,
      canvas_count: 1
    };
    
    this.vaults.set(path, vault);
    
    // Create default canvas
    this.createCanvas(path, id, 'Untitled');
    
    // Track in history
    this.trackVaultOpen(id, name, path);
    
    // Update state
    this.appState.last_vault_id = id;
    this.appState.updated_at = now();
    
    return vault;
  }

  openVault(path: string): VaultInfo {
    let vault = this.vaults.get(path);
    if (!vault) {
      // Create mock vault
      vault = this.createVault(path, 'Dev Vault');
    }
    
    this.trackVaultOpen(vault.id, vault.name, vault.path);
    this.appState.last_vault_id = vault.id;
    this.appState.updated_at = now();
    
    return vault;
  }

  renameVault(path: string, newName: string): VaultInfo {
    const vault = this.vaults.get(path);
    if (!vault) throw new Error('Vault not found');
    
    vault.name = newName;
    vault.updated_at = now();
    
    return vault;
  }

  isValidVault(path: string): boolean {
    return this.vaults.has(path);
  }

  getVaultInfo(path: string): VaultInfo | null {
    return this.vaults.get(path) ?? null;
  }

  // Canvas operations
  createCanvas(vaultPath: string, vaultId: string, name: string, description?: string): CanvasInfo {
    const id = generateUuid();
    const timestamp = now();
    const canvasPath = `${vaultPath}/canvases/${name}`;
    
    const canvas: CanvasInfo = {
      id,
      vault_id: vaultId,
      name,
      description: description ?? '',
      path: canvasPath,
      created_at: timestamp,
      updated_at: timestamp,
      tags: []
    };
    
    this.canvases.set(canvasPath, canvas);
    
    // Initialize workspace
    this.workspaces.set(canvasPath, {
      version: '2.0.0',
      nodes: [],
      edges: [],
      settings: { ...defaultSettings }
    });
    
    // Initialize state
    this.canvasStates.set(canvasPath, {
      viewport: { x: 0, y: 0, zoom: 1 },
      selected_nodes: [],
      selected_edges: [],
      canvas_mode: 'select',
      updated_at: timestamp
    });
    
    // Track
    this.trackCanvasOpen(id, vaultId, name, canvasPath);
    this.appState.last_canvas_id = id;
    
    // Update vault canvas count
    const vault = this.vaults.get(vaultPath);
    if (vault) {
      vault.canvas_count = this.listCanvases(vaultPath).length;
    }
    
    return canvas;
  }

  openCanvas(canvasPath: string): CanvasInfo {
    const canvas = this.canvases.get(canvasPath);
    if (!canvas) throw new Error('Canvas not found');
    
    this.trackCanvasOpen(canvas.id, canvas.vault_id, canvas.name, canvasPath);
    this.appState.last_canvas_id = canvas.id;
    
    return canvas;
  }

  listCanvases(vaultPath: string): CanvasInfo[] {
    return Array.from(this.canvases.values())
      .filter(c => c.path.startsWith(vaultPath))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  renameCanvas(canvasPath: string, newName: string): CanvasInfo {
    const canvas = this.canvases.get(canvasPath);
    if (!canvas) throw new Error('Canvas not found');
    
    canvas.name = newName;
    canvas.updated_at = now();
    
    return canvas;
  }

  deleteCanvas(canvasPath: string): void {
    const canvas = this.canvases.get(canvasPath);
    if (canvas) {
      this.removeCanvasFromHistory(canvas.id);
    }
    
    this.canvases.delete(canvasPath);
    this.canvasStates.delete(canvasPath);
    this.workspaces.delete(canvasPath);
  }

  loadCanvasState(canvasPath: string): CanvasUIState {
    return this.canvasStates.get(canvasPath) ?? {
      viewport: { x: 0, y: 0, zoom: 1 },
      selected_nodes: [],
      selected_edges: [],
      canvas_mode: 'select',
      updated_at: now()
    };
  }

  saveCanvasState(canvasPath: string, state: CanvasUIState): void {
    this.canvasStates.set(canvasPath, { ...state, updated_at: now() });
  }

  // Workspace operations
  loadWorkspace(canvasPath: string): WorkspaceData {
    return this.workspaces.get(canvasPath) ?? {
      version: '2.0.0',
      nodes: [],
      edges: [],
      settings: { ...defaultSettings }
    };
  }

  saveWorkspace(canvasPath: string, data: WorkspaceData): void {
    this.workspaces.set(canvasPath, data);
  }

  // State operations
  loadAppState(): AppState {
    return { ...this.appState };
  }

  saveAppState(state: AppState): void {
    this.appState = { ...state, updated_at: now() };
  }

  updateLastOpened(vaultId?: string | null, canvasId?: string | null): void {
    if (vaultId !== undefined) {
      this.appState.last_vault_id = vaultId;
    }
    if (canvasId !== undefined) {
      this.appState.last_canvas_id = canvasId;
    }
    this.appState.updated_at = now();
  }

  // History operations
  loadHistory(): AppHistory {
    return { ...this.history };
  }

  trackVaultOpen(id: string, name: string, path: string): void {
    const timestamp = now();
    const existing = this.history.vaults.find(v => v.id === id);
    
    if (existing) {
      existing.name = name;
      existing.path = path;
      existing.last_opened = timestamp;
      existing.open_count++;
    } else {
      this.history.vaults.unshift({
        id,
        name,
        path,
        last_opened: timestamp,
        open_count: 1,
        added_at: timestamp
      });
    }
    
    this.history.vaults.sort((a, b) => b.last_opened.localeCompare(a.last_opened));
    this.history.vaults = this.history.vaults.slice(0, this.history.max_items);
  }

  trackCanvasOpen(id: string, vaultId: string, name: string, path: string): void {
    const timestamp = now();
    const existing = this.history.canvases.find(c => c.id === id);
    
    if (existing) {
      existing.name = name;
      existing.path = path;
      existing.last_opened = timestamp;
      existing.open_count++;
    } else {
      this.history.canvases.unshift({
        id,
        vault_id: vaultId,
        name,
        path,
        last_opened: timestamp,
        open_count: 1,
        added_at: timestamp
      });
    }
    
    this.history.canvases.sort((a, b) => b.last_opened.localeCompare(a.last_opened));
    this.history.canvases = this.history.canvases.slice(0, this.history.max_items);
  }

  removeVaultFromHistory(vaultId: string): void {
    this.history.vaults = this.history.vaults.filter(v => v.id !== vaultId);
    this.history.canvases = this.history.canvases.filter(c => c.vault_id !== vaultId);
  }

  removeCanvasFromHistory(canvasId: string): void {
    this.history.canvases = this.history.canvases.filter(c => c.id !== canvasId);
  }

  getRecentVaults(limit?: number): VaultHistoryEntry[] {
    return this.history.vaults.slice(0, limit ?? 10);
  }

  getRecentCanvases(vaultId?: string, limit?: number): CanvasHistoryEntry[] {
    let canvases = this.history.canvases;
    if (vaultId) {
      canvases = canvases.filter(c => c.vault_id === vaultId);
    }
    return canvases.slice(0, limit ?? 10);
  }

  findVaultById(vaultId: string): VaultHistoryEntry | null {
    return this.history.vaults.find(v => v.id === vaultId) ?? null;
  }

  findCanvasById(canvasId: string): CanvasHistoryEntry | null {
    return this.history.canvases.find(c => c.id === canvasId) ?? null;
  }
}

// Singleton instance
export const devStorage = new DevStorage();
