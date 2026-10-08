// Shared UI state that commands and components toggle (search, settings, node list).

export type SettingsSection = 'general' | 'appearance' | 'canvas' | 'keybindings' | 'plugins' | 'about';

class UiStore {
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

  openSettings(section: SettingsSection = this.settingsSection) {
    this.settingsSection = section;
    this.settingsOpen = true;
  }
}

export const ui = new UiStore();
