/**
 * App Store
 * 
 * Centralized application state management using Svelte 5 runes.
 * This is the SINGLE source of truth for app-level state.
 * 
 * Architecture:
 * - Reactive state with $state
 * - Derived values with $derived
 * - Effect-based persistence with $effect
 * - Event-driven updates from Rust backend
 */

import * as api from '$lib/api';
import type { 
  AppState, 
  AppHistory, 
  VaultHistoryEntry, 
  CanvasHistoryEntry 
} from '$lib/api';

// ============================================================================
// STATE DEFINITION
// ============================================================================

interface AppStoreState {
  // Core state
  appState: AppState | null;
  history: AppHistory | null;
  
  // Loading states
  isInitialized: boolean;
  isLoading: boolean;
  
  // Error state
  error: string | null;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

function createAppStore() {
  // Reactive state using Svelte 5 runes
  let state = $state<AppStoreState>({
    appState: null,
    history: null,
    isInitialized: false,
    isLoading: false,
    error: null
  });

  // Derived values
  const lastVaultId = $derived(state.appState?.last_vault_id ?? null);
  const lastCanvasId = $derived(state.appState?.last_canvas_id ?? null);
  const recentVaults = $derived(state.history?.vaults ?? []);
  const recentCanvases = $derived(state.history?.canvases ?? []);
  const hasHistory = $derived(recentVaults.length > 0);

  // Event listeners cleanup
  let unlisteners: (() => void)[] = [];

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function initialize(): Promise<void> {
    if (state.isInitialized) return;
    
    state.isLoading = true;
    state.error = null;

    try {
      // Load initial data in parallel
      const [appState, history] = await Promise.all([
        api.state.load(),
        api.history.load()
      ]);

      state.appState = appState;
      state.history = history;
      state.isInitialized = true;

      // Subscribe to backend events
      await subscribeToEvents();
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to initialize';
      console.error('[AppStore] Initialize error:', err);
    } finally {
      state.isLoading = false;
    }
  }

  async function subscribeToEvents(): Promise<void> {
    try {
      // State change events
      const unlistenState = await api.events.onStateChanged((event) => {
        if (state.appState) {
          state.appState = {
            ...state.appState,
            last_vault_id: event.last_vault_id,
            last_canvas_id: event.last_canvas_id,
            updated_at: new Date().toISOString()
          };
        }
      });
      unlisteners.push(unlistenState);

      // History change events
      const unlistenHistory = await api.events.onHistoryChanged(async () => {
        // Reload history when it changes
        state.history = await api.history.load();
      });
      unlisteners.push(unlistenHistory);
    } catch (err) {
      console.error('[AppStore] Event subscription error:', err);
    }
  }

  function cleanup(): void {
    unlisteners.forEach(unlisten => unlisten());
    unlisteners = [];
  }

  async function updateLastOpened(
    vaultId?: string | null,
    canvasId?: string | null
  ): Promise<void> {
    try {
      await api.state.updateLastOpened(vaultId, canvasId);
      
      // Optimistic update
      if (state.appState) {
        if (vaultId !== undefined) {
          state.appState.last_vault_id = vaultId;
        }
        if (canvasId !== undefined) {
          state.appState.last_canvas_id = canvasId;
        }
        state.appState.updated_at = new Date().toISOString();
      }
    } catch (err) {
      console.error('[AppStore] Update last opened error:', err);
      throw err;
    }
  }

  async function findVaultById(vaultId: string): Promise<VaultHistoryEntry | null> {
    return api.history.findVaultById(vaultId);
  }

  async function findCanvasById(canvasId: string): Promise<CanvasHistoryEntry | null> {
    return api.history.findCanvasById(canvasId);
  }

  async function getRecentVaults(limit?: number): Promise<VaultHistoryEntry[]> {
    return api.history.getRecentVaults(limit);
  }

  async function getRecentCanvases(vaultId?: string, limit?: number): Promise<CanvasHistoryEntry[]> {
    return api.history.getRecentCanvases(vaultId, limit);
  }

  async function removeVaultFromHistory(vaultId: string): Promise<void> {
    await api.history.removeVault(vaultId);
    
    // Optimistic update
    if (state.history) {
      state.history.vaults = state.history.vaults.filter(v => v.id !== vaultId);
      state.history.canvases = state.history.canvases.filter(c => c.vault_id !== vaultId);
    }
  }

  async function removeCanvasFromHistory(canvasId: string): Promise<void> {
    await api.history.removeCanvas(canvasId);
    
    // Optimistic update
    if (state.history) {
      state.history.canvases = state.history.canvases.filter(c => c.id !== canvasId);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State (read-only access)
    get state() { return state; },
    get lastVaultId() { return lastVaultId; },
    get lastCanvasId() { return lastCanvasId; },
    get recentVaults() { return recentVaults; },
    get recentCanvases() { return recentCanvases; },
    get hasHistory() { return hasHistory; },
    get isInitialized() { return state.isInitialized; },
    get isLoading() { return state.isLoading; },
    get error() { return state.error; },

    // Actions
    initialize,
    cleanup,
    updateLastOpened,
    findVaultById,
    findCanvasById,
    getRecentVaults,
    getRecentCanvases,
    removeVaultFromHistory,
    removeCanvasFromHistory
  };
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const appStore = createAppStore();
