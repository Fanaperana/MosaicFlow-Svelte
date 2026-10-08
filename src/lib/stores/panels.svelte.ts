import { panelRegistry, type PanelRegistration } from '$lib/kernel/registries/panel-registry';
import { ui } from './ui.svelte';

class PanelsStore {
  list = $state.raw<PanelRegistration[]>(panelRegistry.getAll());
  open = $derived(ui.openPanel ? (this.list.find((p) => p.id === ui.openPanel) ?? null) : null);

  constructor() {
    panelRegistry.subscribe(() => {
      this.list = panelRegistry.getAll();
      // Disabling a plugin closes its panel.
      if (ui.openPanel && !panelRegistry.has(ui.openPanel)) ui.openPanel = null;
    });
  }
}

export const panels = new PanelsStore();
