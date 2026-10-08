/**
 * Plugin Loader
 * 
 * Loads plugins from plugin.json manifests and dynamically imports their frontend code.
 * Handles both core plugins (bundled) and community plugins (external).
 */

import type { PluginManifest, PluginInfo } from './types';
import { nodeRegistry, type NodeTypeRegistration } from './registries/node-registry';
import { panelRegistry, type PanelRegistration } from './registries/panel-registry';
import { commandRegistry, type CommandRegistration } from './registries/command-registry';
import {
  layoutRegistry,
  templateRegistry,
  type LayoutRegistration,
  type TemplateRegistration,
} from './registries/contribution-registry';
import ExternalNode from '$lib/plugins/ExternalNode.svelte';
import { settings, type PluginSettingDef } from '$lib/stores/settings.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { toast } from 'svelte-sonner';
import type { MosaicNode, MosaicEdge, NodeType } from '$lib/types';

/** Node registration as written by plugin authors: only `type` and a renderer are required. */
export type PluginNodeType = Partial<Omit<NodeTypeRegistration, 'pluginId' | 'dimensions' | 'colors'>> & {
  type: string;
  dimensions?: Partial<NodeTypeRegistration['dimensions']>;
  colors?: Partial<NodeTypeRegistration['colors']>;
};

function normalizeNodeType(type: PluginNodeType, manifest: PluginManifest): NodeTypeRegistration {
  if (manifest.core) return { ...type, pluginId: manifest.id } as NodeTypeRegistration;
  const existing = nodeRegistry.get(type.type);
  if (existing && existing.pluginId !== manifest.id) {
    throw new Error(`Node type "${type.type}" is already provided by ${existing.pluginId}`);
  }
  const component = type.component ?? (type.render ? ExternalNode : undefined);
  if (!component) {
    throw new Error(`Node type "${type.type}" needs a render(container, ctx) function`);
  }
  const label = type.label ?? type.type;
  return {
    ...type,
    label,
    description: type.description ?? '',
    category: type.category ?? 'custom',
    iconName: type.iconName ?? 'Puzzle',
    component,
    defaultData: { title: label, ...type.defaultData },
    dimensions: { minWidth: 120, minHeight: 80, defaultWidth: 260, defaultHeight: 180, ...type.dimensions },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '🧩', ...type.colors },
    pluginId: manifest.id,
  };
}

// =============================================================================
// TYPES
// =============================================================================

/** A node as plugins see it: a copy, so changes must go through the workspace API. */
export interface PluginNodeView {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  parentId?: string;
  selected: boolean;
  data: Record<string, unknown>;
}

export interface PluginEdgeView {
  id: string;
  source: string;
  target: string;
  label?: string;
  data: Record<string, unknown>;
}

/**
 * Plugin API exposed to plugins for registration
 */
export interface PluginAPI {
  /** Register node types */
  registerNodeTypes: (types: PluginNodeType[]) => void;
  /** Register sidebar panels (ribbon button + "Toggle panel" in the command palette) */
  registerPanels: (panels: Omit<PanelRegistration, 'pluginId'>[]) => void;
  /** Register commands; they appear in the command palette (Ctrl+P) and Settings → Keyboard shortcuts */
  registerCommands: (commands: Omit<CommandRegistration, 'pluginId'>[]) => void;
  /** Register page templates, inserted from the command palette */
  registerTemplates: (templates: Omit<TemplateRegistration, 'pluginId'>[]) => void;
  /** Register layouts ("Arrange: …" in the command palette) */
  registerLayouts: (layouts: Omit<LayoutRegistration, 'pluginId'>[]) => void;
  /** Read and change the open page. Every change is saved and can be undone. */
  workspace: {
    getNodes: () => PluginNodeView[];
    getEdges: () => PluginEdgeView[];
    getSelection: () => string[];
    select: (ids: string[]) => void;
    createNode: (type: string, position: { x: number; y: number }, data?: Record<string, unknown>) => string;
    updateNodeData: (id: string, patch: Record<string, unknown>) => void;
    moveNode: (id: string, position: { x: number; y: number }) => void;
    deleteNodes: (ids: string[]) => void;
    createEdge: (source: string, target: string, label?: string) => string;
    /** True when the page is view-only; changes are ignored then. */
    isLocked: () => boolean;
  };
  ui: {
    notify: (message: string, kind?: 'info' | 'success' | 'warning' | 'error') => void;
  };
  commands: {
    /** Runs any command by id, e.g. "view.fit" or another plugin's command. */
    execute: (id: string, args?: unknown) => Promise<void>;
  };
  /** Plugin settings shown in Settings → Plugins and saved in settings.json */
  settings: {
    register: (defs: PluginSettingDef[]) => void;
    get: <T = unknown>(key: string) => T;
    set: (key: string, value: unknown) => void;
    onChange: (listener: (key: string, value: unknown) => void) => () => void;
  };
  /** Plugin manifest */
  manifest: PluginManifest;
}

/**
 * Plugin module interface - what a plugin's main module should export
 */
export interface PluginModule {
  /** Activate the plugin */
  activate: (api: PluginAPI) => void | Promise<void>;
  /** Deactivate the plugin (optional) */
  deactivate?: () => void | Promise<void>;
}

/**
 * Loaded plugin state
 */
export interface LoadedPlugin {
  manifest: PluginManifest;
  module?: PluginModule;
  state: 'loading' | 'active' | 'error' | 'disabled';
  error?: string;
}

// =============================================================================
// PLUGIN LOADER
// =============================================================================

class PluginLoader {
  private loadedPlugins = new Map<string, LoadedPlugin>();
  private corePluginFactories = new Map<string, () => PluginModule | Promise<PluginModule>>();
  private listeners = new Set<() => void>();

  /**
   * Register a core plugin factory (for bundled plugins)
   */
  registerCorePlugin(pluginId: string, factory: () => PluginModule | Promise<PluginModule>): void {
    this.corePluginFactories.set(pluginId, factory);
    console.log(`[PluginLoader] Registered core plugin factory: ${pluginId}`);
  }

  /**
   * Load a core plugin by ID
   */
  async loadCorePlugin(manifest: PluginManifest): Promise<void> {
    const pluginId = manifest.id;
    
    if (this.loadedPlugins.has(pluginId)) {
      console.warn(`[PluginLoader] Plugin already loaded: ${pluginId}`);
      return;
    }

    const factory = this.corePluginFactories.get(pluginId);
    if (!factory) {
      throw new Error(`Core plugin factory not found: ${pluginId}`);
    }

    const loaded: LoadedPlugin = {
      manifest,
      state: 'loading',
    };
    this.loadedPlugins.set(pluginId, loaded);
    this.notifyListeners();

    try {
      // Create the module
      const module = await factory();
      loaded.module = module;

      // Create the plugin API
      const api = this.createPluginAPI(manifest);

      // Activate the plugin
      await module.activate(api);

      loaded.state = 'active';
      console.log(`[PluginLoader] Loaded core plugin: ${pluginId}`);
    } catch (error) {
      loaded.state = 'error';
      loaded.error = String(error);
      console.error(`[PluginLoader] Failed to load core plugin: ${pluginId}`, error);
      throw error;
    } finally {
      this.notifyListeners();
    }
  }

  /**
   * Load an external plugin from its bundled ES module source
   */
  async loadExternalPlugin(manifest: PluginManifest, source: string): Promise<void> {
    const pluginId = manifest.id;
    
    if (this.loadedPlugins.has(pluginId)) {
      console.warn(`[PluginLoader] Plugin already loaded: ${pluginId}`);
      return;
    }

    const loaded: LoadedPlugin = {
      manifest,
      state: 'loading',
    };
    this.loadedPlugins.set(pluginId, loaded);
    this.notifyListeners();

    // The webview cannot import file:// URLs, so the module is imported from a blob.
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    try {
      const imported = await import(/* @vite-ignore */ url);
      const module = (typeof imported.activate === 'function' ? imported : imported.default) as PluginModule;
      if (typeof module?.activate !== 'function') {
        throw new Error('The plugin module does not export an activate(api) function');
      }
      loaded.module = module;

      const api = this.createPluginAPI(manifest);
      await module.activate(api);

      loaded.state = 'active';
      console.log(`[PluginLoader] Loaded external plugin: ${pluginId}`);
    } catch (error) {
      loaded.state = 'error';
      loaded.error = error instanceof Error ? error.message : String(error);
      // Drop anything it registered before failing.
      this.unregisterAll(pluginId);
      console.error(`[PluginLoader] Failed to load external plugin: ${pluginId}`, error);
      throw error;
    } finally {
      URL.revokeObjectURL(url);
      this.notifyListeners();
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const loaded = this.loadedPlugins.get(pluginId);
    if (!loaded) {
      return;
    }

    try {
      // Call deactivate if available
      if (loaded.module?.deactivate) {
        await loaded.module.deactivate();
      }

      // Unregister all contributions
      this.unregisterAll(pluginId);

      this.loadedPlugins.delete(pluginId);
      console.log(`[PluginLoader] Unloaded plugin: ${pluginId}`);
    } catch (error) {
      console.error(`[PluginLoader] Error unloading plugin: ${pluginId}`, error);
    } finally {
      this.notifyListeners();
    }
  }

  /**
   * Get a loaded plugin
   */
  get(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getAll(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get active plugins
   */
  getActive(): LoadedPlugin[] {
    return this.getAll().filter(p => p.state === 'active');
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Subscribe to loader changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('[PluginLoader] Listener error:', e);
      }
    }
  }

  private unregisterAll(pluginId: string) {
    nodeRegistry.unregisterByPlugin(pluginId);
    panelRegistry.unregisterByPlugin(pluginId);
    commandRegistry.unregisterByPlugin(pluginId);
    templateRegistry.unregisterByPlugin(pluginId);
    layoutRegistry.unregisterByPlugin(pluginId);
    settings.unregisterPlugin(pluginId);
  }

  /**
   * Create the plugin API for a specific plugin
   */
  private createPluginAPI(manifest: PluginManifest): PluginAPI {
    const pluginId = manifest.id;
    // Contribution ids are namespaced so plugins can't replace each other's or the app's.
    const scoped = (id: string) => (manifest.core || id.startsWith(`${pluginId}.`) ? id : `${pluginId}.${id}`);
    // Plain copies: plugins get data they can read freely; edits go through the API so they save and undo.
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? {}));
    const nodeView = (n: MosaicNode): PluginNodeView => ({
      id: n.id,
      type: n.type,
      x: n.position.x,
      y: n.position.y,
      width: n.width ?? n.measured?.width,
      height: n.height ?? n.measured?.height,
      parentId: n.parentId,
      selected: workspace.selectedNodeIds.includes(n.id),
      data: copy(n.data) as Record<string, unknown>,
    });
    const edgeView = (e: MosaicEdge): PluginEdgeView => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
      data: copy(e.data) as Record<string, unknown>,
    });

    return {
      manifest,

      registerTemplates: (templates) => {
        for (const t of templates) templateRegistry.register({ ...t, id: scoped(t.id), pluginId });
      },

      registerLayouts: (layouts) => {
        for (const l of layouts) layoutRegistry.register({ ...l, id: scoped(l.id), pluginId });
      },

      workspace: {
        getNodes: () => workspace.nodes.map(nodeView),
        getEdges: () => workspace.edges.map(edgeView),
        getSelection: () => [...workspace.selectedNodeIds],
        select: (ids) => workspace.setSelectedNodes(ids),
        createNode: (type, position, data) => {
          if (!nodeRegistry.has(type)) throw new Error(`Unknown node type: ${type}`);
          return workspace.createNode(type as NodeType, position, data as never).id;
        },
        updateNodeData: (id, patch) => workspace.updateNodeData(id, patch as never),
        moveNode: (id, position) => workspace.updateNode(id, { position }),
        deleteNodes: (ids) => workspace.deleteSelection(ids, []),
        createEdge: (source, target, label) => workspace.createEdge(source, target, label).id,
        isLocked: () => workspace.locked,
      },

      ui: {
        notify: (message, kind = 'info') => {
          const title = String(message).slice(0, 300);
          const opts = { description: manifest.name };
          if (kind === 'success') toast.success(title, opts);
          else if (kind === 'warning') toast.warning(title, opts);
          else if (kind === 'error') toast.error(title, opts);
          else toast(title, opts);
        },
      },

      commands: {
        execute: (id, args) => commandRegistry.execute(id, args),
      },
      
      registerNodeTypes: (types) => {
        for (const type of types) {
          nodeRegistry.register(normalizeNodeType(type, manifest));
        }
      },

      registerPanels: (panels) => {
        for (const panel of panels) {
          if (typeof panel.render !== 'function') throw new Error(`Panel "${panel.id}" needs a render(container, ctx) function`);
          panelRegistry.register({ ...panel, id: scoped(panel.id), pluginId });
        }
      },

      registerCommands: (commands) => {
        for (const command of commands) {
          // External plugins get their id as a prefix so they can't replace built-in commands.
          const id = scoped(command.id);
          commandRegistry.register({
            ...command,
            id,
            category: command.category ?? manifest.name,
            pluginId,
          });
        }
      },

      settings: {
        register: (defs) => settings.registerPluginSettings(pluginId, manifest.name, defs),
        get: <T = unknown>(key: string) => settings.getPluginSetting(pluginId, key) as T,
        set: (key, value) => settings.setPluginSetting(pluginId, key, value),
        onChange: (listener) => settings.onPluginSettingChange(pluginId, listener),
      },
    };
  }
}

// Singleton instance
export const pluginLoader = new PluginLoader();
