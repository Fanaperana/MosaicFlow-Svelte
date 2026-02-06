/**
 * Plugin API Bridge
 * 
 * Frontend bridge for plugin discovery and management via Tauri.
 */

import { safeInvoke } from './bridge';
import type { PluginManifest } from '$lib/kernel/types';

/**
 * Discovered plugin from the plugins directory
 */
export interface DiscoveredPlugin {
  manifest: PluginManifest;
  path: string;
  mainUrl: string | null;
  stylesUrl: string | null;
}

/**
 * Get the plugins directory path
 */
export async function getPluginsDir(): Promise<string> {
  return safeInvoke<string>('get_plugins_dir', undefined, () => {
    // Dev fallback - return a placeholder
    return '/path/to/plugins';
  });
}

/**
 * Discover all external plugins in the plugins directory
 */
export async function discoverPlugins(): Promise<DiscoveredPlugin[]> {
  return safeInvoke<DiscoveredPlugin[]>('discover_plugins', undefined, () => {
    // Dev fallback - return empty array
    return [];
  });
}

/**
 * Read a plugin's main module content
 */
export async function readPluginModule(pluginId: string): Promise<string> {
  return safeInvoke<string>('read_plugin_module', { pluginId }, () => {
    throw new Error(`Cannot read plugin module in dev mode: ${pluginId}`);
  });
}
