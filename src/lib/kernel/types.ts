/**
 * MosaicFlow Kernel API Types
 * 
 * TypeScript types matching the Rust kernel_api crate.
 * These are the stable types for the plugin system.
 */

// =============================================================================
// PLUGIN MANIFEST TYPES
// =============================================================================

export interface PluginManifest {
  /** Unique plugin identifier (e.g., "com.mosaicflow.core.notes") */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description: string;
  /** Plugin author */
  author: string;
  /** License identifier */
  license?: string;
  /** Plugin homepage/repository URL */
  homepage?: string;
  /** Required kernel API version (semver range) */
  apiVersion: string;
  /** Plugin capabilities */
  capabilities: PluginCapability[];
  /** Required permissions */
  permissions: PluginPermission[];
  /** Dependencies on other plugins */
  dependencies: PluginDependency[];
  /** Frontend entry point */
  frontend?: FrontendEntry;
  /** Backend entry point (for WASM plugins) */
  backend?: BackendEntry;
  /** Plugin-specific configuration schema */
  configSchema?: Record<string, unknown>;
  /** Default configuration values */
  defaultConfig?: Record<string, unknown>;
  /** Plugin type classification */
  pluginType: PluginType;
  /** Whether this is a core plugin */
  core: boolean;
  /** Minimum MosaicFlow version required */
  minAppVersion?: string;
}

export type PluginType = 'core' | 'community' | 'premium';

export type PluginCapability =
  | { type: 'nodeTypes'; types: string[] }
  | { type: 'panels'; panels: string[] }
  | { type: 'commands'; commands: string[] }
  | { type: 'contextMenus'; menus: string[] }
  | { type: 'edgeTypes'; types: string[] }
  | { type: 'themes'; themes: string[] }
  | { type: 'formats'; formats: string[] }
  | { type: 'custom'; name: string; metadata?: Record<string, unknown> };

export type PluginPermission =
  | 'file_read'
  | 'file_write'
  | 'network'
  | 'clipboard'
  | 'notifications'
  | 'shell'
  | 'storage'
  | 'backend_commands'
  | { custom: string };

export interface PluginDependency {
  /** Plugin ID of the dependency */
  id: string;
  /** Required version (semver range) */
  version: string;
  /** Whether the dependency is optional */
  optional?: boolean;
}

export interface FrontendEntry {
  /** Path to the main module */
  main: string;
  /** Path to styles */
  styles?: string;
}

export interface BackendEntry {
  /** Path to WASM module */
  wasm: string;
}

// =============================================================================
// PLUGIN STATE TYPES
// =============================================================================

export type PluginState =
  | 'discovered'
  | 'loading'
  | 'loaded'
  | 'active'
  | 'disabled'
  | 'error'
  | 'unloading';

export interface PluginInfo {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Current state */
  state: PluginState;
  /** Plugin directory path */
  path: string;
  /** Error message if in error state */
  error?: string;
  /** Plugin configuration */
  config: Record<string, unknown>;
  /** Load order */
  loadOrder: number;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface KernelRequest {
  /** Target plugin ID */
  pluginId: string;
  /** Command to invoke */
  command: string;
  /** Command payload */
  payload: unknown;
  /** Request ID for correlation */
  requestId?: string;
}

export interface KernelResponse<T = unknown> {
  /** Whether the request succeeded */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message */
  error?: string;
  /** Correlated request ID */
  requestId?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type EventTopic =
  // Plugin lifecycle
  | 'plugin_loaded'
  | 'plugin_unloaded'
  | 'plugin_enabled'
  | 'plugin_disabled'
  | 'plugin_error'
  // Registry events
  | 'node_type_registered'
  | 'node_type_unregistered'
  | 'panel_registered'
  | 'panel_unregistered'
  | 'command_registered'
  | 'command_unregistered'
  // Workspace events
  | 'workspace_created'
  | 'workspace_opened'
  | 'workspace_saved'
  | 'workspace_closed'
  // Canvas events
  | 'canvas_created'
  | 'canvas_opened'
  | 'canvas_saved'
  | 'canvas_closed'
  // Node events
  | 'node_created'
  | 'node_updated'
  | 'node_deleted'
  | 'node_selected'
  | 'node_deselected'
  // Edge events
  | 'edge_created'
  | 'edge_updated'
  | 'edge_deleted'
  // Custom
  | `custom:${string}`;

export interface KernelEvent<T = unknown> {
  /** Event topic */
  topic: EventTopic;
  /** Source plugin ID */
  source?: string;
  /** Event payload */
  payload: T;
  /** Timestamp (Unix milliseconds) */
  timestamp: number;
}
