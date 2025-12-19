/**
 * MosaicFlow Type Definitions
 * 
 * All types matching the Rust backend models.
 * Single source of truth for data structures.
 */

// ============================================================================
// VAULT TYPES
// ============================================================================

export interface VaultInfo {
  id: string;
  path: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  canvas_count: number;
}

export interface VaultRef {
  id: string;
  name: string;
  path: string;
}

// ============================================================================
// CANVAS TYPES
// ============================================================================

export interface CanvasInfo {
  id: string;
  vault_id: string;
  name: string;
  description: string;
  path: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface CanvasRef {
  id: string;
  vault_id: string;
  name: string;
  path: string;
}

export interface CanvasUIState {
  viewport: ViewportState;
  selected_nodes: string[];
  selected_edges: string[];
  canvas_mode: string;
  updated_at: string;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================================
// HISTORY TYPES
// ============================================================================

export interface AppHistory {
  vaults: VaultHistoryEntry[];
  canvases: CanvasHistoryEntry[];
  max_items: number;
}

export interface VaultHistoryEntry {
  id: string;
  name: string;
  path: string;
  last_opened: string;
  open_count: number;
  added_at: string;
}

export interface CanvasHistoryEntry {
  id: string;
  vault_id: string;
  name: string;
  path: string;
  last_opened: string;
  open_count: number;
  added_at: string;
}

// ============================================================================
// APP STATE TYPES
// ============================================================================

export interface AppState {
  last_vault_id: string | null;
  last_canvas_id: string | null;
  updated_at: string;
  version: string;
}

// ============================================================================
// WORKSPACE TYPES
// ============================================================================

export interface WorkspaceData {
  version: string;
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  settings: WorkspaceSettings;
}

export interface WorkspaceNode {
  id: string;
  node_type: string;
  position: Position;
  width?: number;
  height?: number;
  z_index: number;
  parent_id?: string;
  data: Record<string, unknown>;
}

export interface Position {
  x: number;
  y: number;
}

export interface WorkspaceEdge {
  id: string;
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
  edge_type: string;
  label?: string;
  animated: boolean;
  data: Record<string, unknown>;
}

export interface WorkspaceSettings {
  grid_size: number;
  snap_to_grid: boolean;
  show_minimap: boolean;
  auto_save: boolean;
  auto_save_interval: number;
  theme: string;
  default_node_color: string;
  default_edge_color: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface VaultEvent {
  vault_id: string;
  vault_path: string;
  vault_name: string;
}

export interface CanvasEvent {
  canvas_id: string;
  canvas_path: string;
  canvas_name: string;
  vault_id: string;
}

export interface WorkspaceEvent {
  canvas_path: string;
  change_type: WorkspaceChangeType;
  node_ids?: string[];
  edge_ids?: string[];
}

export type WorkspaceChangeType = 
  | 'loaded'
  | 'saved'
  | 'nodes_added'
  | 'nodes_updated'
  | 'nodes_deleted'
  | 'edges_added'
  | 'edges_updated'
  | 'edges_deleted'
  | 'batch_update';

export interface StateEvent {
  last_vault_id: string | null;
  last_canvas_id: string | null;
}

export interface HistoryEvent {
  vault_count: number;
  canvas_count: number;
}

// ============================================================================
// EVENT NAMES (matching Rust constants)
// ============================================================================

export const EventNames = {
  // Vault events
  VAULT_CREATED: 'vault:created',
  VAULT_OPENED: 'vault:opened',
  VAULT_UPDATED: 'vault:updated',
  VAULT_CLOSED: 'vault:closed',
  
  // Canvas events
  CANVAS_CREATED: 'canvas:created',
  CANVAS_OPENED: 'canvas:opened',
  CANVAS_UPDATED: 'canvas:updated',
  CANVAS_CLOSED: 'canvas:closed',
  CANVAS_DELETED: 'canvas:deleted',
  
  // Workspace events
  WORKSPACE_LOADED: 'workspace:loaded',
  WORKSPACE_SAVED: 'workspace:saved',
  WORKSPACE_CHANGED: 'workspace:changed',
  
  // State events
  STATE_CHANGED: 'state:changed',
  HISTORY_CHANGED: 'history:changed',
} as const;
