/**
 * Canvas Store
 * 
 * Manages the currently open canvas and its state.
 * Uses Svelte 5 runes for reactive state management.
 */

import * as api from '$lib/api';
import type { CanvasInfo, CanvasUIState, ViewportState } from '$lib/api';

// ============================================================================
// STATE DEFINITION
// ============================================================================

interface CanvasStoreState {
  // Current canvas
  current: CanvasInfo | null;
  
  // UI state
  uiState: CanvasUIState | null;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  
  // Error state
  error: string | null;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

function createCanvasStore() {
  // Reactive state
  let state = $state<CanvasStoreState>({
    current: null,
    uiState: null,
    isLoading: false,
    isSaving: false,
    error: null
  });

  // Derived values
  const isOpen = $derived(state.current !== null);
  const canvasPath = $derived(state.current?.path ?? null);
  const canvasId = $derived(state.current?.id ?? null);
  const canvasName = $derived(state.current?.name ?? '');
  const vaultId = $derived(state.current?.vault_id ?? null);
  const viewport = $derived(state.uiState?.viewport ?? { x: 0, y: 0, zoom: 1 });
  const selectedNodes = $derived(state.uiState?.selected_nodes ?? []);
  const selectedEdges = $derived(state.uiState?.selected_edges ?? []);
  const canvasMode = $derived(state.uiState?.canvas_mode ?? 'select');
  const tags = $derived(state.current?.tags ?? []);

  // Event listeners cleanup
  let unlisteners: (() => void)[] = [];

  // Auto-save debounce
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function subscribeToEvents(): Promise<void> {
    try {
      // Canvas update events
      const unlistenUpdated = await api.events.onCanvasUpdated((event) => {
        if (state.current && event.canvas_id === state.current.id) {
          state.current = {
            ...state.current,
            name: event.canvas_name,
            updated_at: new Date().toISOString()
          };
        }
      });
      unlisteners.push(unlistenUpdated);
    } catch (err) {
      console.error('[CanvasStore] Event subscription error:', err);
    }
  }

  function cleanup(): void {
    unlisteners.forEach(unlisten => unlisten());
    unlisteners = [];
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  }

  async function open(canvasPath: string): Promise<CanvasInfo> {
    state.isLoading = true;
    state.error = null;

    try {
      const [canvas, uiState] = await Promise.all([
        api.canvas.open(canvasPath),
        api.canvas.loadState(canvasPath)
      ]);
      
      state.current = canvas;
      state.uiState = uiState;
      
      // Subscribe to events
      await subscribeToEvents();
      
      return canvas;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to open canvas';
      throw err;
    } finally {
      state.isLoading = false;
    }
  }

  async function rename(newName: string): Promise<void> {
    if (!state.current) throw new Error('No canvas open');
    
    try {
      const updated = await api.canvas.rename(state.current.path, newName);
      state.current = updated;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to rename canvas';
      throw err;
    }
  }

  async function updateDescription(description: string): Promise<void> {
    if (!state.current) throw new Error('No canvas open');
    
    try {
      const updated = await api.canvas.updateDescription(state.current.path, description);
      state.current = updated;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to update description';
      throw err;
    }
  }

  async function updateTags(newTags: string[]): Promise<void> {
    if (!state.current) throw new Error('No canvas open');
    
    try {
      const updated = await api.canvas.updateTags(state.current.path, newTags);
      state.current = updated;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to update tags';
      throw err;
    }
  }

  async function saveState(): Promise<void> {
    if (!state.current || !state.uiState) return;
    
    state.isSaving = true;

    try {
      await api.canvas.saveState(state.current.path, state.uiState);
    } catch (err) {
      console.error('[CanvasStore] Save state error:', err);
    } finally {
      state.isSaving = false;
    }
  }

  function debouncedSaveState(delay: number = 500): void {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveState();
    }, delay);
  }

  function updateViewport(newViewport: ViewportState): void {
    if (state.uiState) {
      state.uiState = {
        ...state.uiState,
        viewport: newViewport,
        updated_at: new Date().toISOString()
      };
      debouncedSaveState();
    }
  }

  function updateSelectedNodes(nodeIds: string[]): void {
    if (state.uiState) {
      state.uiState = {
        ...state.uiState,
        selected_nodes: nodeIds,
        updated_at: new Date().toISOString()
      };
    }
  }

  function updateSelectedEdges(edgeIds: string[]): void {
    if (state.uiState) {
      state.uiState = {
        ...state.uiState,
        selected_edges: edgeIds,
        updated_at: new Date().toISOString()
      };
    }
  }

  function updateCanvasMode(mode: string): void {
    if (state.uiState) {
      state.uiState = {
        ...state.uiState,
        canvas_mode: mode,
        updated_at: new Date().toISOString()
      };
      debouncedSaveState();
    }
  }

  function close(): void {
    // Save before closing
    if (state.current && state.uiState) {
      saveState();
    }
    
    cleanup();
    state.current = null;
    state.uiState = null;
    state.error = null;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State (read-only access)
    get state() { return state; },
    get current() { return state.current; },
    get uiState() { return state.uiState; },
    get isOpen() { return isOpen; },
    get canvasPath() { return canvasPath; },
    get canvasId() { return canvasId; },
    get canvasName() { return canvasName; },
    get vaultId() { return vaultId; },
    get viewport() { return viewport; },
    get selectedNodes() { return selectedNodes; },
    get selectedEdges() { return selectedEdges; },
    get canvasMode() { return canvasMode; },
    get tags() { return tags; },
    get isLoading() { return state.isLoading; },
    get isSaving() { return state.isSaving; },
    get error() { return state.error; },

    // Actions
    open,
    close,
    rename,
    updateDescription,
    updateTags,
    saveState,
    updateViewport,
    updateSelectedNodes,
    updateSelectedEdges,
    updateCanvasMode,
    cleanup
  };
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const canvasStore = createCanvasStore();
