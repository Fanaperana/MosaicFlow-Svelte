// User plugins from {APP_DATA}/plugins. Plugins run with full app access, so each one
// stays disabled until the user enables it.

import { pluginLoader } from '$lib/kernel/plugin-loader';
import type { PluginManifest } from '$lib/kernel/types';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import {
  discoverPlugins,
  getPluginsDir,
  openPluginsDir,
  readPluginFile,
  readPluginModule,
} from '$lib/api/plugin';

const ENABLED_KEY = 'mosaicflow:enabled-plugins';

export type PluginStatus = 'disabled' | 'loading' | 'active' | 'error';

export interface UserPlugin {
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
  status: PluginStatus;
  error?: string;
  nodeTypes: string[];
}

function readEnabled(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(ENABLED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

class PluginStore {
  plugins = $state<UserPlugin[]>([]);
  dir = $state('');
  busy = $state(false);

  private enabled = readEnabled();

  get activeCount(): number {
    return this.plugins.filter((p) => p.status === 'active').length;
  }

  /** Discover plugins and load the enabled ones (called at startup). */
  async init() {
    await this.rescan();
  }

  /** Re-read the plugins folder, then (re)load every enabled plugin. */
  async rescan() {
    this.busy = true;
    try {
      for (const p of this.plugins) await this.unload(p.manifest.id);
      this.dir = await getPluginsDir();
      const found = await discoverPlugins();
      this.plugins = found.map((d) => ({
        manifest: d.manifest,
        path: d.path,
        enabled: this.enabled.has(d.manifest.id),
        status: 'disabled' as PluginStatus,
        nodeTypes: [],
      }));
      for (const p of this.plugins) {
        if (p.enabled) await this.load(p.manifest.id);
      }
    } catch (error) {
      console.error('[Plugins] Failed to scan plugins folder:', error);
    } finally {
      this.busy = false;
    }
  }

  async setEnabled(id: string, on: boolean) {
    if (on) this.enabled.add(id);
    else this.enabled.delete(id);
    localStorage.setItem(ENABLED_KEY, JSON.stringify([...this.enabled]));
    this.patch(id, { enabled: on });
    if (on) await this.load(id);
    else await this.unload(id);
  }

  openFolder() {
    return openPluginsDir();
  }

  private patch(id: string, changes: Partial<UserPlugin>) {
    this.plugins = this.plugins.map((p) => (p.manifest.id === id ? { ...p, ...changes } : p));
  }

  private async load(id: string) {
    const plugin = this.plugins.find((p) => p.manifest.id === id);
    if (!plugin) return;
    this.patch(id, { status: 'loading', error: undefined });
    try {
      if (pluginLoader.isLoaded(id)) await pluginLoader.unloadPlugin(id);
      const source = await readPluginModule(id);
      await pluginLoader.loadExternalPlugin(plugin.manifest, source);
      const styles = plugin.manifest.frontend?.styles;
      if (styles) injectStyles(id, await readPluginFile(id, styles));
      const nodeTypes = nodeRegistry.getAll().filter((r) => r.pluginId === id).map((r) => r.type);
      this.patch(id, { status: 'active', nodeTypes });
    } catch (error) {
      await pluginLoader.unloadPlugin(id);
      removeStyles(id);
      this.patch(id, { status: 'error', error: error instanceof Error ? error.message : String(error), nodeTypes: [] });
    }
  }

  private async unload(id: string) {
    await pluginLoader.unloadPlugin(id);
    removeStyles(id);
    this.patch(id, { status: 'disabled', nodeTypes: [] });
  }
}

function injectStyles(id: string, css: string) {
  removeStyles(id);
  const el = document.createElement('style');
  el.dataset.pluginStyles = id;
  el.textContent = css;
  document.head.appendChild(el);
}

function removeStyles(id: string) {
  document.querySelectorAll<HTMLStyleElement>('style[data-plugin-styles]').forEach((el) => {
    if (el.dataset.pluginStyles === id) el.remove();
  });
}

export const pluginStore = new PluginStore();
