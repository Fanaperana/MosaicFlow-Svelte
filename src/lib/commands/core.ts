// Built-in commands. Each has a default shortcut users can change in Settings → Keyboard shortcuts.

import { commandRegistry, type CommandRegistration } from '$lib/kernel/registries/command-registry';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import { workspace } from '$lib/stores/workspace.svelte';
import { vaultStore } from '$lib/stores/vault.svelte';
import { pageNav } from '$lib/stores/pages.svelte';
import { packageDialogs } from '$lib/stores/packages.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { registerCoreLayouts } from '$lib/services/contributions';

const emit = (name: string, detail?: unknown) => () => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};
const onCanvas = () => vaultStore.appView === 'canvas' && !!vaultStore.currentCanvas;

type CoreCommand = Omit<CommandRegistration, 'pluginId'>;

// Sets the panels directly so hiding them doesn't overwrite the saved sidebar preference.
export function toggleFocusMode() {
  const next = ui.toggleFocusMode({ pages: pageNav.sidebarOpen, properties: workspace.propertiesPanelOpen, nodeList: ui.nodeListOpen });
  pageNav.sidebarOpen = next.pages;
  workspace.propertiesPanelOpen = next.properties;
  ui.nodeListOpen = next.nodeList;
}

const COMMANDS: CoreCommand[] = [
  // App
  { id: 'app.commandPalette', label: 'Command palette', category: 'App', shortcut: 'Ctrl+P', context: 'global',
    handler: () => { ui.paletteOpen = !ui.paletteOpen; } },
  { id: 'app.search', label: 'Search pages and nodes', category: 'App', shortcut: ['Ctrl+K', 'Ctrl+O'], context: 'global',
    enabled: () => !!vaultStore.currentVault, handler: () => { ui.searchOpen = !ui.searchOpen; } },
  { id: 'app.settings', label: 'Open settings', category: 'App', shortcut: 'Ctrl+,', context: 'global',
    handler: () => ui.openSettings('general') },
  { id: 'app.shortcuts', label: 'Show keyboard shortcuts', category: 'App', shortcut: 'Ctrl+/', context: 'global',
    handler: () => ui.openSettings('keybindings') },
  { id: 'app.plugins', label: 'Manage plugins', category: 'App', context: 'global', handler: () => ui.openSettings('plugins') },
  { id: 'vault.switch', label: 'Switch vault', category: 'App', shortcut: 'Ctrl+Shift+O', context: 'global',
    enabled: () => !!vaultStore.currentVault, handler: emit('mosaicflow:openVaultSwitcher') },

  // Pages
  { id: 'page.new', label: 'New page', category: 'Pages', shortcut: 'Ctrl+N', context: 'global',
    enabled: () => !!vaultStore.currentVault, handler: () => void vaultStore.createCanvas() },
  { id: 'page.back', label: 'Go back', category: 'Pages', shortcut: 'Alt+ArrowLeft', enabled: () => pageNav.canGoBack, handler: () => pageNav.goBack() },
  { id: 'page.forward', label: 'Go forward', category: 'Pages', shortcut: 'Alt+ArrowRight', enabled: () => pageNav.canGoForward, handler: () => pageNav.goForward() },
  { id: 'page.allPages', label: 'Show all pages', category: 'Pages', enabled: onCanvas, handler: () => vaultStore.closeCanvas() },
  { id: 'page.toggleLock', label: 'Lock / unlock page (view only)', category: 'Pages', shortcut: 'Ctrl+Shift+K', context: 'global',
    enabled: onCanvas, handler: () => workspace.setLocked(!workspace.locked) },
  { id: 'page.export', label: 'Export as .mosaic…', category: 'Pages', shortcut: 'Ctrl+Shift+E', context: 'global',
    enabled: () => !!vaultStore.currentVault, handler: () => packageDialogs.openExport(vaultStore.currentCanvas ? 'current' : 'all') },

  // View
  { id: 'view.togglePages', label: 'Toggle pages sidebar', category: 'View', shortcut: 'Ctrl+\\', context: 'global',
    enabled: onCanvas, handler: () => pageNav.toggleSidebar() },
  { id: 'view.toggleProperties', label: 'Toggle properties panel', category: 'View', shortcut: 'Ctrl+Shift+\\', context: 'global',
    enabled: onCanvas, handler: () => workspace.togglePropertiesPanel() },
  { id: 'view.toggleNodeList', label: 'Toggle node list', category: 'View', shortcut: 'Ctrl+Shift+L', context: 'global',
    enabled: onCanvas, handler: () => { ui.nodeListOpen = !ui.nodeListOpen; } },
  { id: 'view.focusMode', label: 'Toggle focus mode', category: 'View', shortcut: 'Ctrl+.', context: 'global',
    enabled: onCanvas, handler: toggleFocusMode },
  { id: 'view.graph', label: 'Open graph view', category: 'View', shortcut: 'Ctrl+Alt+G', context: 'global',
    enabled: onCanvas, handler: () => { ui.graphOpen = !ui.graphOpen; } },
  { id: 'view.fit', label: 'Fit view', category: 'View', shortcut: 'Shift+1', handler: emit('mosaicflow:fitView', { padding: 0.1 }) },
  { id: 'view.zoomIn', label: 'Zoom in', category: 'View', shortcut: ['Ctrl+=', 'Shift+='], handler: emit('mosaicflow:zoomIn') },
  { id: 'view.zoomOut', label: 'Zoom out', category: 'View', shortcut: 'Ctrl+-', handler: emit('mosaicflow:zoomOut') },

  // Canvas
  { id: 'canvas.insert', label: 'Insert block', category: 'Canvas', shortcut: '/', enabled: () => !workspace.locked, handler: emit('mosaicflow:insertAtPointer') },
  { id: 'canvas.selectMode', label: 'Select tool', category: 'Canvas', shortcut: 'V', handler: () => workspace.setCanvasMode('select') },
  { id: 'canvas.panMode', label: 'Hand (pan) tool', category: 'Canvas', shortcut: 'H', handler: () => workspace.setCanvasMode('drag') },

  // Edit
  { id: 'edit.undo', label: 'Undo', category: 'Edit', shortcut: 'Ctrl+Z', enabled: () => workspace.canUndo, handler: () => workspace.undo() },
  { id: 'edit.redo', label: 'Redo', category: 'Edit', shortcut: ['Ctrl+Y', 'Ctrl+Shift+Z'], enabled: () => workspace.canRedo, handler: () => workspace.redo() },
  { id: 'edit.selectAll', label: 'Select all', category: 'Edit', shortcut: 'Ctrl+A', handler: () => workspace.setSelectedNodes(workspace.nodes.map((n) => n.id)) },
  { id: 'edit.duplicate', label: 'Duplicate selection', category: 'Edit', shortcut: 'Ctrl+D',
    enabled: () => workspace.selectedNodeIds.length > 0,
    handler: () => {
      const copies = workspace.duplicateNodes(workspace.selectedNodeIds);
      if (copies.length) workspace.setSelectedNodes(copies.map((n) => n.id));
    } },
  { id: 'edit.delete', label: 'Delete selection', category: 'Edit', shortcut: ['Delete', 'Backspace'],
    enabled: () => workspace.selectedNodeIds.length > 0 || workspace.selectedEdgeIds.length > 0,
    handler: () => workspace.deleteSelection([...workspace.selectedNodeIds], [...workspace.selectedEdgeIds]) },
  { id: 'edit.group', label: 'Group selection', category: 'Edit', shortcut: 'Ctrl+G',
    enabled: () => workspace.selectedNodeIds.filter((id) => !workspace.getNode(id)?.parentId).length >= 2,
    handler: () => workspace.groupSelectedNodes() },
  { id: 'edit.ungroup', label: 'Ungroup', category: 'Edit', shortcut: 'Ctrl+Shift+G',
    enabled: () => workspace.selectedNodeIds.length === 1 && nodeRegistry.isContainer(workspace.getNode(workspace.selectedNodeIds[0])?.type),
    handler: () => workspace.ungroupNode(workspace.selectedNodeIds[0]) },
];

export const COMMAND_CATEGORIES = ['App', 'Pages', 'View', 'Canvas', 'Edit'];

export function registerCoreCommands() {
  for (const cmd of COMMANDS) commandRegistry.register({ ...cmd, pluginId: 'core' });
  registerCoreLayouts();
}
