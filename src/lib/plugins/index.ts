/**
 * Core Plugins Bootstrap
 * 
 * This module initializes and loads all core plugins.
 * Core plugins are bundled with the app and provide essential functionality.
 */

import { pluginLoader } from '$lib/kernel/plugin-loader';
import type { PluginManifest } from '$lib/kernel/types';

// Import core plugin manifests
import coreContentManifest from './core-content/plugin.json';
import coreEntityManifest from './core-entity/plugin.json';
import coreDataManifest from './core-data/plugin.json';
import coreUtilityManifest from './core-utility/plugin.json';

// Import core plugin modules
import * as coreContent from './core-content/index';
import * as coreEntity from './core-entity/index';
import * as coreData from './core-data/index';
import * as coreUtility from './core-utility/index';

/**
 * Core plugin definitions
 */
const CORE_PLUGINS = [
  { manifest: coreContentManifest as PluginManifest, module: coreContent },
  { manifest: coreEntityManifest as PluginManifest, module: coreEntity },
  { manifest: coreDataManifest as PluginManifest, module: coreData },
  { manifest: coreUtilityManifest as PluginManifest, module: coreUtility },
];

/**
 * Register all core plugin factories
 */
export function registerCorePlugins(): void {
  console.log('[Plugins] Registering core plugin factories...');
  
  for (const { manifest, module } of CORE_PLUGINS) {
    pluginLoader.registerCorePlugin(manifest.id, () => module);
  }
  
  console.log(`[Plugins] Registered ${CORE_PLUGINS.length} core plugin factories`);
}

/**
 * Load all core plugins
 */
export async function loadCorePlugins(): Promise<void> {
  console.log('[Plugins] Loading core plugins...');
  
  for (const { manifest } of CORE_PLUGINS) {
    try {
      await pluginLoader.loadCorePlugin(manifest as PluginManifest);
    } catch (error) {
      console.error(`[Plugins] Failed to load core plugin: ${manifest.id}`, error);
    }
  }
  
  console.log(`[Plugins] Loaded ${pluginLoader.getActive().length} core plugins`);
}

/**
 * Load external plugins from the plugins directory
 */
export async function loadExternalPlugins(): Promise<void> {
  console.log('[Plugins] Discovering external plugins...');
  
  try {
    // Import dynamically to avoid circular dependencies
    const { discoverPlugins, getPluginsDir } = await import('$lib/api/plugin');
    
    // Log the plugins directory for user reference
    const pluginsDir = await getPluginsDir();
    console.log(`[Plugins] Plugins directory: ${pluginsDir}`);
    
    // Discover plugins
    const discovered = await discoverPlugins();
    console.log(`[Plugins] Found ${discovered.length} external plugin(s)`);
    
    // Load each discovered plugin
    for (const plugin of discovered) {
      try {
        if (plugin.mainUrl) {
          console.log(`[Plugins] Loading external plugin: ${plugin.manifest.id}`);
          await pluginLoader.loadExternalPlugin(plugin.manifest, plugin.mainUrl);
        } else {
          console.warn(`[Plugins] Plugin ${plugin.manifest.id} has no main URL, skipping`);
        }
      } catch (error) {
        console.error(`[Plugins] Failed to load external plugin: ${plugin.manifest.id}`, error);
      }
    }
  } catch (error) {
    console.error('[Plugins] Failed to discover external plugins:', error);
  }
}

/**
 * Initialize the plugin system
 * 
 * This should be called early in the app initialization to ensure
 * all node types are registered before the canvas renders.
 */
export async function initializePluginSystem(): Promise<void> {
  console.log('[Plugins] Initializing plugin system...');
  
  // Register core plugin factories
  registerCorePlugins();
  
  // Load all core plugins
  await loadCorePlugins();
  
  // Load external plugins from the plugins directory
  await loadExternalPlugins();
  
  console.log('[Plugins] Plugin system initialized');
}

// Re-export for convenience
export { pluginLoader };
