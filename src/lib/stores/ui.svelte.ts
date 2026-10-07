// Shared UI state that commands and components toggle (search, settings, node list).

export type SettingsSection = 'general' | 'appearance' | 'canvas' | 'keybindings' | 'plugins' | 'about';

class UiStore {
  searchOpen = $state(false);
  nodeListOpen = $state(false);
  settingsOpen = $state(false);
  graphOpen = $state(false);
  settingsSection = $state<SettingsSection>('general');

  openSettings(section: SettingsSection = this.settingsSection) {
    this.settingsSection = section;
    this.settingsOpen = true;
  }
}

export const ui = new UiStore();
