/**
 * Vault Store
 * 
 * Manages the currently open vault and its canvases.
 * Uses Svelte 5 runes for reactive state management.
 */

import * as api from '$lib/api';
import type { VaultInfo, CanvasInfo } from '$lib/api';

// ============================================================================
// STATE DEFINITION
// ============================================================================

interface VaultStoreState {
  // Current vault
  current: VaultInfo | null;
  
  // Canvases in current vault
  canvases: CanvasInfo[];
  
  // Loading states
  isLoading: boolean;
  isLoadingCanvases: boolean;
  
  // Error state
  error: string | null;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

function createVaultStore() {
  // Reactive state
  let state = $state<VaultStoreState>({
    current: null,
    canvases: [],
    isLoading: false,
    isLoadingCanvases: false,
    error: null
  });

  // Derived values
  const isOpen = $derived(state.current !== null);
  const vaultPath = $derived(state.current?.path ?? null);
  const vaultId = $derived(state.current?.id ?? null);
  const vaultName = $derived(state.current?.name ?? '');
  const canvasCount = $derived(state.canvases.length);
  const sortedCanvases = $derived(
    [...state.canvases].sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  );

  // Event listeners cleanup
  let unlisteners: (() => void)[] = [];

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function subscribeToEvents(): Promise<void> {
    try {
      // Vault update events
      const unlistenVaultUpdated = await api.events.onVaultUpdated((event) => {
        if (state.current && event.vault_id === state.current.id) {
          state.current = {
            ...state.current,
            name: event.vault_name,
            updated_at: new Date().toISOString()
          };
        }
      });
      unlisteners.push(unlistenVaultUpdated);

      // Canvas created events
      const unlistenCanvasCreated = await api.events.onCanvasCreated((event) => {
        if (state.current && event.vault_id === state.current.id) {
          // Reload canvas list
          loadCanvases();
        }
      });
      unlisteners.push(unlistenCanvasCreated);

      // Canvas deleted events
      const unlistenCanvasDeleted = await api.events.onCanvasDeleted((event) => {
        if (state.current && event.vault_id === state.current.id) {
          state.canvases = state.canvases.filter(c => c.id !== event.canvas_id);
        }
      });
      unlisteners.push(unlistenCanvasDeleted);

      // Canvas updated events
      const unlistenCanvasUpdated = await api.events.onCanvasUpdated((event) => {
        const index = state.canvases.findIndex(c => c.id === event.canvas_id);
        if (index >= 0) {
          state.canvases[index] = {
            ...state.canvases[index],
            name: event.canvas_name,
            updated_at: new Date().toISOString()
          };
        }
      });
      unlisteners.push(unlistenCanvasUpdated);
    } catch (err) {
      console.error('[VaultStore] Event subscription error:', err);
    }
  }

  function cleanup(): void {
    unlisteners.forEach(unlisten => unlisten());
    unlisteners = [];
  }

  async function create(path: string, name: string, description?: string): Promise<VaultInfo> {
    state.isLoading = true;
    state.error = null;

    try {
      const vault = await api.vault.create(path, name, description);
      state.current = vault;
      
      // Load canvases for new vault
      await loadCanvases();
      
      // Subscribe to events
      await subscribeToEvents();
      
      return vault;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to create vault';
      throw err;
    } finally {
      state.isLoading = false;
    }
  }

  async function open(path: string): Promise<VaultInfo> {
    state.isLoading = true;
    state.error = null;

    try {
      const vault = await api.vault.open(path);
      state.current = vault;
      
      // Load canvases
      await loadCanvases();
      
      // Subscribe to events
      await subscribeToEvents();
      
      return vault;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to open vault';
      throw err;
    } finally {
      state.isLoading = false;
    }
  }

  async function loadCanvases(): Promise<void> {
    if (!state.current) return;
    
    state.isLoadingCanvases = true;

    try {
      state.canvases = await api.canvas.list(state.current.path);
    } catch (err) {
      console.error('[VaultStore] Load canvases error:', err);
    } finally {
      state.isLoadingCanvases = false;
    }
  }

  async function rename(newName: string): Promise<void> {
    if (!state.current) throw new Error('No vault open');
    
    try {
      const updated = await api.vault.rename(state.current.path, newName);
      state.current = updated;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to rename vault';
      throw err;
    }
  }

  async function updateDescription(description: string): Promise<void> {
    if (!state.current) throw new Error('No vault open');
    
    try {
      const updated = await api.vault.updateDescription(state.current.path, description);
      state.current = updated;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to update description';
      throw err;
    }
  }

  async function createCanvas(name: string, description?: string): Promise<CanvasInfo> {
    if (!state.current) throw new Error('No vault open');
    
    try {
      const canvas = await api.canvas.create(
        state.current.path,
        state.current.id,
        name,
        description
      );
      
      // Add to local state
      state.canvases = [canvas, ...state.canvases];
      
      return canvas;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to create canvas';
      throw err;
    }
  }

  async function deleteCanvas(canvasPath: string): Promise<void> {
    try {
      await api.canvas.remove(canvasPath);
      
      // Remove from local state
      state.canvases = state.canvases.filter(c => c.path !== canvasPath);
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to delete canvas';
      throw err;
    }
  }

  function close(): void {
    cleanup();
    state.current = null;
    state.canvases = [];
    state.error = null;
  }

  function findCanvasById(canvasId: string): CanvasInfo | undefined {
    return state.canvases.find(c => c.id === canvasId);
  }

  function findCanvasByPath(canvasPath: string): CanvasInfo | undefined {
    return state.canvases.find(c => c.path === canvasPath);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State (read-only access)
    get state() { return state; },
    get current() { return state.current; },
    get canvases() { return state.canvases; },
    get sortedCanvases() { return sortedCanvases; },
    get isOpen() { return isOpen; },
    get vaultPath() { return vaultPath; },
    get vaultId() { return vaultId; },
    get vaultName() { return vaultName; },
    get canvasCount() { return canvasCount; },
    get isLoading() { return state.isLoading; },
    get isLoadingCanvases() { return state.isLoadingCanvases; },
    get error() { return state.error; },

    // Actions
    create,
    open,
    close,
    rename,
    updateDescription,
    loadCanvases,
    createCanvas,
    deleteCanvas,
    findCanvasById,
    findCanvasByPath,
    cleanup
  };
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const vaultStore = createVaultStore();
