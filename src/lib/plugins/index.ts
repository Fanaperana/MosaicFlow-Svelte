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
import coreKnowledgeManifest from './core-knowledge/plugin.json';

// Import core plugin modules
import * as coreContent from './core-content/index';
import * as coreEntity from './core-entity/index';
import * as coreData from './core-data/index';
import * as coreUtility from './core-utility/index';
import * as coreKnowledge from './core-knowledge/index';

/**
 * Core plugin definitions
 */
const CORE_PLUGINS = [
  { manifest: coreContentManifest as PluginManifest, module: coreContent },
  { manifest: coreEntityManifest as PluginManifest, module: coreEntity },
  { manifest: coreDataManifest as PluginManifest, module: coreData },
  { manifest: coreUtilityManifest as PluginManifest, module: coreUtility },
  { manifest: coreKnowledgeManifest as PluginManifest, module: coreKnowledge },
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
 * Load the user's enabled plugins from {APP_DATA}/plugins
 */
export async function loadExternalPlugins(): Promise<void> {
  const { pluginStore } = await import('$lib/stores/plugins.svelte');
  await pluginStore.init();
  console.log(`[Plugins] ${pluginStore.activeCount} of ${pluginStore.plugins.length} user plugin(s) active (${pluginStore.dir})`);
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
