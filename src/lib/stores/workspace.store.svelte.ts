/**
 * Workspace Store
 * 
 * Manages nodes and edges for the current canvas.
 * Uses Svelte 5 runes for reactive state management.
 */

import * as api from '$lib/api';
import type { 
  WorkspaceData, 
  WorkspaceNode, 
  WorkspaceEdge, 
  WorkspaceSettings 
} from '$lib/api';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_SETTINGS: WorkspaceSettings = {
  grid_size: 20,
  snap_to_grid: true,
  show_minimap: true,
  auto_save: true,
  auto_save_interval: 1000,
  theme: 'dark',
  default_node_color: '#1e1e1e',
  default_edge_color: '#555555'
};

// ============================================================================
// STATE DEFINITION
// ============================================================================

interface WorkspaceStoreState {
  // Workspace data
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  settings: WorkspaceSettings;
  
  // Current canvas path
  canvasPath: string | null;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  
  // Dirty tracking
  isDirty: boolean;
  
  // Error state
  error: string | null;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

function createWorkspaceStore() {
  // Reactive state
  let state = $state<WorkspaceStoreState>({
    nodes: [],
    edges: [],
    settings: { ...DEFAULT_SETTINGS },
    canvasPath: null,
    isLoading: false,
    isSaving: false,
    isDirty: false,
    error: null
  });

  // Derived values
  const isLoaded = $derived(state.canvasPath !== null);
  const nodeCount = $derived(state.nodes.length);
  const edgeCount = $derived(state.edges.length);
  
  const nodeMap = $derived(
    new Map(state.nodes.map(n => [n.id, n]))
  );
  
  const edgeMap = $derived(
    new Map(state.edges.map(e => [e.id, e]))
  );

  const nodesByType = $derived(() => {
    const map = new Map<string, WorkspaceNode[]>();
    for (const node of state.nodes) {
      const list = map.get(node.node_type) ?? [];
      list.push(node);
      map.set(node.node_type, list);
    }
    return map;
  });

  // Event listeners cleanup
  let unlisteners: (() => void)[] = [];

  // Auto-save
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function subscribeToEvents(): Promise<void> {
    try {
      const unlistenChanged = await api.events.onWorkspaceChanged((event) => {
        if (state.canvasPath && event.canvas_path === state.canvasPath) {
          // External change - reload
          if (event.change_type === 'saved') {
            load(state.canvasPath);
          }
        }
      });
      unlisteners.push(unlistenChanged);
    } catch (err) {
      console.error('[WorkspaceStore] Event subscription error:', err);
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

  async function load(canvasPath: string): Promise<void> {
    state.isLoading = true;
    state.error = null;

    try {
      const data = await api.workspace.load(canvasPath);
      
      state.canvasPath = canvasPath;
      state.nodes = data.nodes;
      state.edges = data.edges;
      state.settings = data.settings;
      state.isDirty = false;
      
      // Subscribe to events
      await subscribeToEvents();
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to load workspace';
      throw err;
    } finally {
      state.isLoading = false;
    }
  }

  async function save(): Promise<void> {
    if (!state.canvasPath || !state.isDirty) return;
    
    state.isSaving = true;

    try {
      const data: WorkspaceData = {
        version: '2.0.0',
        nodes: state.nodes,
        edges: state.edges,
        settings: state.settings
      };
      
      await api.workspace.save(state.canvasPath, data);
      state.isDirty = false;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to save workspace';
      console.error('[WorkspaceStore] Save error:', err);
    } finally {
      state.isSaving = false;
    }
  }

  function debouncedSave(delay?: number): void {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const interval = delay ?? state.settings.auto_save_interval;
    saveTimeout = setTimeout(() => {
      save();
    }, interval);
  }

  function markDirty(): void {
    state.isDirty = true;
    if (state.settings.auto_save) {
      debouncedSave();
    }
  }

  // Node operations
  function addNode(node: WorkspaceNode): void {
    state.nodes = [...state.nodes, node];
    markDirty();
  }

  function addNodes(nodes: WorkspaceNode[]): void {
    state.nodes = [...state.nodes, ...nodes];
    markDirty();
  }

  function updateNode(nodeId: string, updates: Partial<WorkspaceNode>): void {
    state.nodes = state.nodes.map(n =>
      n.id === nodeId ? { ...n, ...updates } : n
    );
    markDirty();
  }

  function updateNodes(nodes: WorkspaceNode[]): void {
    const updateMap = new Map(nodes.map(n => [n.id, n]));
    state.nodes = state.nodes.map(n =>
      updateMap.has(n.id) ? { ...n, ...updateMap.get(n.id) } : n
    );
    markDirty();
  }

  function removeNode(nodeId: string): void {
    state.nodes = state.nodes.filter(n => n.id !== nodeId);
    // Also remove connected edges
    state.edges = state.edges.filter(e => 
      e.source !== nodeId && e.target !== nodeId
    );
    markDirty();
  }

  function removeNodes(nodeIds: string[]): void {
    const idsSet = new Set(nodeIds);
    state.nodes = state.nodes.filter(n => !idsSet.has(n.id));
    state.edges = state.edges.filter(e => 
      !idsSet.has(e.source) && !idsSet.has(e.target)
    );
    markDirty();
  }

  function getNode(nodeId: string): WorkspaceNode | undefined {
    return nodeMap.get(nodeId);
  }

  function getNodesByType(nodeType: string): WorkspaceNode[] {
    return state.nodes.filter(n => n.node_type === nodeType);
  }

  // Edge operations
  function addEdge(edge: WorkspaceEdge): void {
    state.edges = [...state.edges, edge];
    markDirty();
  }

  function addEdges(edges: WorkspaceEdge[]): void {
    state.edges = [...state.edges, ...edges];
    markDirty();
  }

  function updateEdge(edgeId: string, updates: Partial<WorkspaceEdge>): void {
    state.edges = state.edges.map(e =>
      e.id === edgeId ? { ...e, ...updates } : e
    );
    markDirty();
  }

  function removeEdge(edgeId: string): void {
    state.edges = state.edges.filter(e => e.id !== edgeId);
    markDirty();
  }

  function removeEdges(edgeIds: string[]): void {
    const idsSet = new Set(edgeIds);
    state.edges = state.edges.filter(e => !idsSet.has(e.id));
    markDirty();
  }

  function getEdge(edgeId: string): WorkspaceEdge | undefined {
    return edgeMap.get(edgeId);
  }

  function getEdgesForNode(nodeId: string): WorkspaceEdge[] {
    return state.edges.filter(e => 
      e.source === nodeId || e.target === nodeId
    );
  }

  // Settings operations
  function updateSettings(updates: Partial<WorkspaceSettings>): void {
    state.settings = { ...state.settings, ...updates };
    markDirty();
  }

  // Batch operations
  async function batchUpdate(
    nodesToAdd: WorkspaceNode[],
    nodesToRemove: string[],
    edgesToAdd: WorkspaceEdge[],
    edgesToRemove: string[]
  ): Promise<void> {
    // Update local state
    const removeNodeSet = new Set(nodesToRemove);
    const removeEdgeSet = new Set(edgesToRemove);
    
    state.nodes = [
      ...state.nodes.filter(n => !removeNodeSet.has(n.id)),
      ...nodesToAdd
    ];
    
    state.edges = [
      ...state.edges.filter(e => !removeEdgeSet.has(e.id)),
      ...edgesToAdd
    ];
    
    markDirty();
  }

  function reset(): void {
    cleanup();
    state.nodes = [];
    state.edges = [];
    state.settings = { ...DEFAULT_SETTINGS };
    state.canvasPath = null;
    state.isDirty = false;
    state.error = null;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State (read-only access)
    get state() { return state; },
    get nodes() { return state.nodes; },
    get edges() { return state.edges; },
    get settings() { return state.settings; },
    get canvasPath() { return state.canvasPath; },
    get isLoaded() { return isLoaded; },
    get nodeCount() { return nodeCount; },
    get edgeCount() { return edgeCount; },
    get isLoading() { return state.isLoading; },
    get isSaving() { return state.isSaving; },
    get isDirty() { return state.isDirty; },
    get error() { return state.error; },

    // Node actions
    addNode,
    addNodes,
    updateNode,
    updateNodes,
    removeNode,
    removeNodes,
    getNode,
    getNodesByType,

    // Edge actions
    addEdge,
    addEdges,
    updateEdge,
    removeEdge,
    removeEdges,
    getEdge,
    getEdgesForNode,

    // Settings actions
    updateSettings,

    // Lifecycle actions
    load,
    save,
    batchUpdate,
    reset,
    cleanup
  };
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const workspaceStore = createWorkspaceStore();
