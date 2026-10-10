// Shared UI state that commands and components toggle (search, settings, node list).

import { settings } from '$lib/stores/settings.svelte';

export type SettingsSection = 'general' | 'appearance' | 'canvas' | 'ai' | 'keybindings' | 'plugins' | 'about';

const COMPACT_QUERY = '(max-width: 1100px)';

class UiStore {
  /** Narrow window: side panels float over the canvas instead of shrinking it. */
  compact = $state(false);
  /** Hides the ribbon, side panels and toolbar so only the canvas remains. */
  focusMode = $state(false);
  private beforeFocus: { pages: boolean; properties: boolean; nodeList: boolean } | null = null;
  /** View to go back to after "zoom to selection". */
  zoomReturn: { x: number; y: number; zoom: number } | null = null;
  searchOpen = $state(false);
  nodeListOpen = $state(false);
  settingsOpen = $state(false);
  graphOpen = $state(false);
  paletteOpen = $state(false);
  /** Id of the open plugin panel, if any. */
  openPanel = $state<string | null>(null);
  settingsSection = $state<SettingsSection>('general');

  togglePanel(id: string) {
    this.openPanel = this.openPanel === id ? null : id;
  }

  /** Properties show as a popover next to the selection instead of the side panel. */
  get propertiesPopover(): boolean {
    const mode = settings.current.canvas.propertiesView;
    return mode === 'popover' || (mode === 'auto' && this.compact);
  }

  openSettings(section: SettingsSection = this.settingsSection) {
    this.settingsSection = section;
    this.settingsOpen = true;
  }

  /** Takes the current panel state and returns the one to apply; leaving focus mode restores it. */
  toggleFocusMode(current: { pages: boolean; properties: boolean; nodeList: boolean }) {
    if (this.focusMode) {
      this.focusMode = false;
      const restore = this.beforeFocus ?? current;
      this.beforeFocus = null;
      return restore;
    }
    this.beforeFocus = current;
    this.focusMode = true;
    return { pages: false, properties: false, nodeList: false };
  }

  watchViewport() {
    const mq = window.matchMedia(COMPACT_QUERY);
    const update = () => (this.compact = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }
}

export const ui = new UiStore();
