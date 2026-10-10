// App-wide user settings, saved to {APP_DATA}/settings.json.
// Appearance is applied as CSS variables; keybinding overrides and plugin settings live here too.

import { toast } from 'svelte-sonner';
import { themeRegistry } from '$lib/kernel/registries/contribution-registry';

export type CanvasBackground = 'dots' | 'lines' | 'cross' | 'none';
export type UiFont = 'space-grotesk' | 'system' | 'serif' | 'mono' | 'custom';
export type MonoFont = 'pt-mono' | 'space-mono' | 'system' | 'custom';
export type IconColor = 'default' | 'accent' | 'custom';
export type IconWeight = 'thin' | 'regular' | 'bold';
export type Density = 'compact' | 'default' | 'comfortable';

export interface AppearanceSettings {
  /** Theme id from the theme registry (built in or from a plugin). */
  theme: string;
  accent: string;
  /** Whole-window zoom, like browser zoom. */
  uiScale: number;
  /** Text size of menus, panels and dialogs (not blocks on the canvas). */
  textScale: number;
  uiFont: UiFont;
  /** Installed font family used when uiFont is 'custom'. */
  customUiFont: string;
  monoFont: MonoFont;
  customMonoFont: string;
  iconScale: number;
  iconColor: IconColor;
  customIconColor: string;
  iconWeight: IconWeight;
  /** Corner radius of buttons, inputs and menus, in px. */
  radius: number;
  density: Density;
  reduceMotion: boolean;
  /** User CSS, injected last (like Obsidian snippets). */
  customCss: string;
}

export interface AppSettings {
  general: {
    hoverPreviews: boolean;
    previewDelay: number;
    confirmDelete: boolean;
  };
  appearance: AppearanceSettings;
  canvas: {
    background: CanvasBackground;
    gridSize: number;
    snapToGrid: boolean;
    showMinimap: boolean;
    showControls: boolean;
    doubleClickInsert: boolean;
    /** When selecting a node opens the properties panel; 'wide' skips narrow windows. */
    propertiesOnSelect: 'always' | 'wide' | 'never';
    /** Side panel, a popover next to the node, or the popover only on narrow windows. */
    propertiesView: 'auto' | 'panel' | 'popover';
    peekOnAlt: boolean;
    escapeRestoresView: boolean;
    autoHidePagesOnNarrow: boolean;
    pageOpenView: 'restore' | 'fit';
    keyboardNav: 'spatial' | 'connected';
    scrollFade: boolean;
    touchDragPans: boolean;
  };
  /** Command id -> chords; only commands the user changed are stored. */
  keybindings: Record<string, string[]>;
  /** Plugin id -> setting key -> value. */
  plugins: Record<string, Record<string, unknown>>;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: { hoverPreviews: true, previewDelay: 380, confirmDelete: true },
  appearance: {
    theme: 'core.default',
    accent: '#5b8def',
    uiScale: 1,
    textScale: 1,
    uiFont: 'space-grotesk',
    customUiFont: '',
    monoFont: 'pt-mono',
    customMonoFont: '',
    iconScale: 1,
    iconColor: 'default',
    customIconColor: '#a6a6ad',
    iconWeight: 'regular',
    radius: 6,
    density: 'default',
    reduceMotion: false,
    customCss: '',
  },
  canvas: {
    background: 'dots', gridSize: 20, snapToGrid: false, showMinimap: true, showControls: true, doubleClickInsert: true,
    propertiesOnSelect: 'wide', propertiesView: 'auto', peekOnAlt: true, escapeRestoresView: true, autoHidePagesOnNarrow: true,
    pageOpenView: 'restore', keyboardNav: 'spatial', scrollFade: true, touchDragPans: true,
  },
  keybindings: {},
  plugins: {},
};

export const ACCENT_PRESETS = ['#5b8def', '#8b7cf6', '#22c55e', '#14b8a6', '#f59e0b', '#f43f5e', '#e5e7eb'];

const FONTS: Record<Exclude<UiFont, 'custom'>, string> = {
  'space-grotesk': "'Space Grotesk Variable', 'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
  mono: "'PT Mono', ui-monospace, 'Consolas', monospace",
};
const MONO_FONTS: Record<Exclude<MonoFont, 'custom'>, string> = {
  'pt-mono': "'PT Mono', 'Space Mono', ui-monospace, 'Consolas', monospace",
  'space-mono': "'Space Mono', 'PT Mono', ui-monospace, monospace",
  system: "ui-monospace, 'Cascadia Code', 'Consolas', monospace",
};
const ROW_HEIGHT: Record<Density, string> = { compact: '24px', default: '28px', comfortable: '32px' };
const ICON_STROKE: Record<IconWeight, string | null> = { thin: '1.25', regular: null, bold: '2.25' };

/** Allowed ranges; used by the Settings window and to validate values from plugins and settings.json. */
export const APPEARANCE_LIMITS = {
  uiScale: { min: 0.75, max: 1.5, step: 0.05 },
  textScale: { min: 0.85, max: 1.35, step: 0.05 },
  iconScale: { min: 0.75, max: 1.5, step: 0.05 },
  radius: { min: 0, max: 14, step: 1 },
} as const;
const MAX_CUSTOM_CSS = 100_000;

const HEX = /^#[0-9a-f]{6}$/i;
const FONT_NAME = /^[\p{L}\p{N} ._-]{1,64}$/u;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function clampTo(value: unknown, { min, max }: { min: number; max: number }, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n)) * 100) / 100 : fallback;
}

/** Keeps only valid appearance values; anything invalid falls back to `base`. */
export function sanitizeAppearance(patch: Partial<AppearanceSettings>, base: AppearanceSettings): AppearanceSettings {
  const p = { ...base, ...patch };
  const L = APPEARANCE_LIMITS;
  return {
    theme: typeof p.theme === 'string' && p.theme.length <= 128 ? p.theme : base.theme,
    accent: HEX.test(String(p.accent)) ? String(p.accent) : base.accent,
    uiScale: clampTo(p.uiScale, L.uiScale, base.uiScale),
    textScale: clampTo(p.textScale, L.textScale, base.textScale),
    uiFont: pick(p.uiFont, ['space-grotesk', 'system', 'serif', 'mono', 'custom'], base.uiFont),
    customUiFont: p.customUiFont === '' || FONT_NAME.test(String(p.customUiFont)) ? String(p.customUiFont) : base.customUiFont,
    monoFont: pick(p.monoFont, ['pt-mono', 'space-mono', 'system', 'custom'], base.monoFont),
    customMonoFont: p.customMonoFont === '' || FONT_NAME.test(String(p.customMonoFont)) ? String(p.customMonoFont) : base.customMonoFont,
    iconScale: clampTo(p.iconScale, L.iconScale, base.iconScale),
    iconColor: pick(p.iconColor, ['default', 'accent', 'custom'], base.iconColor),
    customIconColor: HEX.test(String(p.customIconColor)) ? String(p.customIconColor) : base.customIconColor,
    iconWeight: pick(p.iconWeight, ['thin', 'regular', 'bold'], base.iconWeight),
    radius: clampTo(p.radius, L.radius, base.radius),
    density: pick(p.density, ['compact', 'default', 'comfortable'], base.density),
    reduceMotion: typeof p.reduceMotion === 'boolean' ? p.reduceMotion : base.reduceMotion,
    customCss: typeof p.customCss === 'string' ? p.customCss.slice(0, MAX_CUSTOM_CSS) : base.customCss,
  };
}

function fontStack(name: string, fallback: string): string {
  return name ? `"${name}", ${fallback}` : fallback;
}

/** Sets or replaces a <style> element in <head>; empty css removes it. */
function setStyle(id: string, css: string) {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!css) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = id;
  }
  el.textContent = css;
  // Appended (again) so it comes after app and plugin styles.
  document.head.appendChild(el);
}

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
    appearance: sanitizeAppearance(saved.appearance ?? {}, d.appearance),
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
  private appearanceListeners = new Map<string, Set<(appearance: AppearanceSettings) => void>>();
  private themeVars: string[] = [];
  private appliedScale = 1;

  constructor() {
    // Plugins register themes after settings load; re-apply so the saved theme takes effect (or falls back).
    themeRegistry.subscribe(() => this.apply());
  }

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
    const next =
      section === 'appearance'
        ? sanitizeAppearance(patch as Partial<AppearanceSettings>, this.current.appearance)
        : { ...this.current[section], ...patch };
    this.current = { ...this.current, [section]: next };
    if (section === 'appearance') {
      this.apply();
      this.notifyAppearance();
    }
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
    this.appearanceListeners.delete(pluginId);
  }

  /** Called with the new appearance after every change; returns an unsubscribe function. */
  onAppearanceChange(pluginId: string, listener: (appearance: AppearanceSettings) => void): () => void {
    const set = this.appearanceListeners.get(pluginId) ?? new Set();
    set.add(listener);
    this.appearanceListeners.set(pluginId, set);
    return () => set.delete(listener);
  }

  private notifyAppearance() {
    const snapshot = { ...this.current.appearance };
    for (const [pluginId, listeners] of this.appearanceListeners) {
      for (const listener of listeners) {
        try {
          listener({ ...snapshot });
        } catch (error) {
          console.error(`[Settings] ${pluginId} appearance listener failed`, error);
        }
      }
    }
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
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const a = this.current.appearance;

    // Theme first, so the user's accent and other settings below take precedence.
    const theme = themeRegistry.get(a.theme) ?? themeRegistry.get(DEFAULT_APP_SETTINGS.appearance.theme);
    for (const key of this.themeVars) root.style.removeProperty(key);
    this.themeVars = [];
    for (const [key, value] of Object.entries(theme?.variables ?? {})) {
      if (!/^--[\w-]+$/.test(key)) continue;
      root.style.setProperty(key, String(value));
      this.themeVars.push(key);
    }
    root.dataset.theme = theme?.id ?? '';
    setStyle('mf-theme-css', theme?.css ?? '');

    const rgb = hexToRgb(a.accent);
    root.style.setProperty('--mf-accent', a.accent);
    if (rgb) root.style.setProperty('--mf-accent-soft', `rgba(${rgb.join(', ')}, 0.16)`);
    const uiFont = a.uiFont === 'custom' ? fontStack(a.customUiFont, FONTS['space-grotesk']) : FONTS[a.uiFont];
    const monoFont = a.monoFont === 'custom' ? fontStack(a.customMonoFont, MONO_FONTS['pt-mono']) : MONO_FONTS[a.monoFont];
    root.style.setProperty('--mf-font-ui', uiFont ?? FONTS['space-grotesk']);
    root.style.setProperty('--mf-font-mono', monoFont ?? MONO_FONTS['pt-mono']);
    root.style.setProperty('--mf-text-scale', String(a.textScale));
    root.style.setProperty('--mf-icon-scale', String(a.iconScale));
    root.style.setProperty('--mf-radius', `${a.radius}px`);
    root.style.setProperty('--mf-row', ROW_HEIGHT[a.density]);
    const iconColor = a.iconColor === 'accent' ? 'var(--mf-accent)' : a.iconColor === 'custom' ? a.customIconColor : null;
    if (iconColor) root.style.setProperty('--mf-icon-color', iconColor);
    else root.style.removeProperty('--mf-icon-color');
    root.classList.toggle('mf-icon-colored', !!iconColor);
    const stroke = ICON_STROKE[a.iconWeight];
    if (stroke) root.style.setProperty('--mf-icon-stroke', stroke);
    else root.style.removeProperty('--mf-icon-stroke');
    root.classList.toggle('mf-icon-weighted', !!stroke);
    root.classList.toggle('reduce-motion', a.reduceMotion);
    setStyle('mf-custom-css', a.customCss);
    this.applyScale(a.uiScale);
  }

  /** Native webview zoom keeps pointer coordinates right for the canvas (CSS zoom would not). */
  private applyScale(scale: number) {
    if (scale === this.appliedScale) return;
    this.appliedScale = scale;
    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) => getCurrentWebview().setZoom(scale))
      .catch((error) => console.warn('[Settings] Interface scale unavailable:', error));
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
