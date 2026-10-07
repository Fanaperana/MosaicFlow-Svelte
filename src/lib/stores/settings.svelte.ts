// App-wide user settings, saved to {APP_DATA}/settings.json.
// Appearance is applied as CSS variables; keybinding overrides and plugin settings live here too.

import { toast } from 'svelte-sonner';

export type CanvasBackground = 'dots' | 'lines' | 'cross' | 'none';
export type UiFont = 'space-grotesk' | 'system' | 'mono';
export type MonoFont = 'pt-mono' | 'system';

export interface AppSettings {
  general: {
    hoverPreviews: boolean;
    previewDelay: number;
    confirmDelete: boolean;
  };
  appearance: {
    accent: string;
    uiFont: UiFont;
    monoFont: MonoFont;
    reduceMotion: boolean;
  };
  canvas: {
    background: CanvasBackground;
    gridSize: number;
    snapToGrid: boolean;
    showMinimap: boolean;
    showControls: boolean;
    doubleClickInsert: boolean;
  };
  /** Command id -> chords; only commands the user changed are stored. */
  keybindings: Record<string, string[]>;
  /** Plugin id -> setting key -> value. */
  plugins: Record<string, Record<string, unknown>>;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: { hoverPreviews: true, previewDelay: 380, confirmDelete: true },
  appearance: { accent: '#5b8def', uiFont: 'space-grotesk', monoFont: 'pt-mono', reduceMotion: false },
  canvas: { background: 'dots', gridSize: 20, snapToGrid: false, showMinimap: true, showControls: true, doubleClickInsert: true },
  keybindings: {},
  plugins: {},
};

export const ACCENT_PRESETS = ['#5b8def', '#8b7cf6', '#22c55e', '#14b8a6', '#f59e0b', '#f43f5e', '#e5e7eb'];

const FONTS: Record<UiFont, string> = {
  'space-grotesk': "'Space Grotesk Variable', 'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'PT Mono', ui-monospace, 'Consolas', monospace",
};
const MONO_FONTS: Record<MonoFont, string> = {
  'pt-mono': "'PT Mono', 'Space Mono', ui-monospace, 'Consolas', monospace",
  system: "ui-monospace, 'Cascadia Code', 'Consolas', monospace",
};

const FILE = 'settings.json';

/** A setting a plugin contributes to the Settings window. */
export interface PluginSettingDef {
  key: string;
  label: string;
  description?: string;
  type: 'toggle' | 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  default: unknown;
}

function merge(saved: Partial<AppSettings>): AppSettings {
  const d = DEFAULT_APP_SETTINGS;
  return {
    general: { ...d.general, ...saved.general },
    appearance: { ...d.appearance, ...saved.appearance },
    canvas: { ...d.canvas, ...saved.canvas },
    keybindings: { ...saved.keybindings },
    plugins: { ...saved.plugins },
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

class SettingsStore {
  current = $state<AppSettings>(merge({}));
  /** Settings declared by plugins, keyed by plugin id. */
  pluginDefs = $state<Record<string, { name: string; defs: PluginSettingDef[] }>>({});
  filePath = $state('');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pluginListeners = new Map<string, Set<(key: string, value: unknown) => void>>();

  async load() {
    try {
      const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      this.filePath = await join(await appDataDir(), FILE);
      if (await exists(FILE, { baseDir: BaseDirectory.AppData })) {
        this.current = merge(JSON.parse(await readTextFile(FILE, { baseDir: BaseDirectory.AppData })));
      }
    } catch (error) {
      console.warn('[Settings] Using defaults:', error);
      toast.warning('Settings could not be loaded; using defaults', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
    this.apply();
  }

  /** Changes one section and saves. */
  update<K extends 'general' | 'appearance' | 'canvas'>(section: K, patch: Partial<AppSettings[K]>) {
    this.current = { ...this.current, [section]: { ...this.current[section], ...patch } };
    if (section === 'appearance') this.apply();
    this.scheduleSave();
  }

  setKeybindings(map: Record<string, string[]>) {
    this.current = { ...this.current, keybindings: map };
    this.scheduleSave();
  }

  resetSection(section: 'general' | 'appearance' | 'canvas') {
    this.update(section, DEFAULT_APP_SETTINGS[section]);
  }

  // ---- plugin settings -------------------------------------------------------

  registerPluginSettings(pluginId: string, name: string, defs: PluginSettingDef[]) {
    this.pluginDefs = { ...this.pluginDefs, [pluginId]: { name, defs } };
  }

  unregisterPlugin(pluginId: string) {
    const { [pluginId]: _removed, ...rest } = this.pluginDefs;
    this.pluginDefs = rest;
    this.pluginListeners.delete(pluginId);
  }

  getPluginSetting(pluginId: string, key: string): unknown {
    const value = this.current.plugins[pluginId]?.[key];
    if (value !== undefined) return value;
    return this.pluginDefs[pluginId]?.defs.find((d) => d.key === key)?.default;
  }

  setPluginSetting(pluginId: string, key: string, value: unknown) {
    const plugin = { ...this.current.plugins[pluginId], [key]: value };
    this.current = { ...this.current, plugins: { ...this.current.plugins, [pluginId]: plugin } };
    this.scheduleSave();
    for (const listener of this.pluginListeners.get(pluginId) ?? []) {
      try {
        listener(key, value);
      } catch (error) {
        console.error(`[Settings] ${pluginId} listener failed`, error);
      }
    }
  }

  onPluginSettingChange(pluginId: string, listener: (key: string, value: unknown) => void): () => void {
    const set = this.pluginListeners.get(pluginId) ?? new Set();
    set.add(listener);
    this.pluginListeners.set(pluginId, set);
    return () => set.delete(listener);
  }

  // ---- internals -------------------------------------------------------------

  private apply() {
    const root = document.documentElement;
    const { accent, uiFont, monoFont, reduceMotion } = this.current.appearance;
    const rgb = hexToRgb(accent);
    root.style.setProperty('--mf-accent', accent);
    if (rgb) root.style.setProperty('--mf-accent-soft', `rgba(${rgb.join(', ')}, 0.16)`);
    root.style.setProperty('--mf-font-ui', FONTS[uiFont] ?? FONTS['space-grotesk']);
    root.style.setProperty('--mf-font-mono', MONO_FONTS[monoFont] ?? MONO_FONTS['pt-mono']);
    root.classList.toggle('reduce-motion', reduceMotion);
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), 300);
  }

  private async save() {
    try {
      const { writeTextFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
      await writeTextFile(FILE, JSON.stringify(this.current, null, 2), { baseDir: BaseDirectory.AppData });
    } catch (error) {
      console.error('[Settings] Save failed:', error);
      toast.error('Could not save settings', { description: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const settings = new SettingsStore();
