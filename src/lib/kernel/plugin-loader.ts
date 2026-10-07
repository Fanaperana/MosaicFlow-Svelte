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
import ExternalNode from '$lib/plugins/ExternalNode.svelte';
import { settings, type PluginSettingDef } from '$lib/stores/settings.svelte';

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

/**
 * Plugin API exposed to plugins for registration
 */
export interface PluginAPI {
  /** Register node types */
  registerNodeTypes: (types: PluginNodeType[]) => void;
  /** Register panels */
  registerPanels: (panels: Omit<PanelRegistration, 'pluginId'>[]) => void;
  /** Register commands; their shortcuts appear in Settings → Keyboard shortcuts */
  registerCommands: (commands: Omit<CommandRegistration, 'pluginId'>[]) => void;
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
      nodeRegistry.unregisterByPlugin(pluginId);
      panelRegistry.unregisterByPlugin(pluginId);
      commandRegistry.unregisterByPlugin(pluginId);
      settings.unregisterPlugin(pluginId);
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
      nodeRegistry.unregisterByPlugin(pluginId);
      panelRegistry.unregisterByPlugin(pluginId);
      commandRegistry.unregisterByPlugin(pluginId);
      settings.unregisterPlugin(pluginId);

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

  /**
   * Create the plugin API for a specific plugin
   */
  private createPluginAPI(manifest: PluginManifest): PluginAPI {
    const pluginId = manifest.id;

    return {
      manifest,
      
      registerNodeTypes: (types) => {
        for (const type of types) {
          nodeRegistry.register(normalizeNodeType(type, manifest));
        }
      },

      registerPanels: (panels) => {
        for (const panel of panels) {
          panelRegistry.register({
            ...panel,
            pluginId,
          });
        }
      },

      registerCommands: (commands) => {
        for (const command of commands) {
          // External plugins get their id as a prefix so they can't replace built-in commands.
          const id = manifest.core || command.id.startsWith(`${pluginId}.`) ? command.id : `${pluginId}.${command.id}`;
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
