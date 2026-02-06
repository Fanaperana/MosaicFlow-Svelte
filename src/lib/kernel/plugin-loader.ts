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

// =============================================================================
// TYPES
// =============================================================================

/**
 * Plugin API exposed to plugins for registration
 */
export interface PluginAPI {
  /** Register node types */
  registerNodeTypes: (types: Omit<NodeTypeRegistration, 'pluginId'>[]) => void;
  /** Register panels */
  registerPanels: (panels: Omit<PanelRegistration, 'pluginId'>[]) => void;
  /** Register commands */
  registerCommands: (commands: Omit<CommandRegistration, 'pluginId'>[]) => void;
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
   * Load an external plugin from a manifest and module URL
   */
  async loadExternalPlugin(manifest: PluginManifest, moduleUrl: string): Promise<void> {
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

    try {
      // Dynamic import the module
      const module = await import(/* @vite-ignore */ moduleUrl) as PluginModule;
      loaded.module = module;

      // Create the plugin API
      const api = this.createPluginAPI(manifest);

      // Activate the plugin
      await module.activate(api);

      loaded.state = 'active';
      console.log(`[PluginLoader] Loaded external plugin: ${pluginId}`);
    } catch (error) {
      loaded.state = 'error';
      loaded.error = String(error);
      console.error(`[PluginLoader] Failed to load external plugin: ${pluginId}`, error);
      throw error;
    } finally {
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
          nodeRegistry.register({
            ...type,
            pluginId,
          });
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
          commandRegistry.register({
            ...command,
            pluginId,
          });
        }
      },
    };
  }
}

// Singleton instance
export const pluginLoader = new PluginLoader();
