<!--
  Ribbon (Obsidian-style): panel toggles and canvas tools. Page navigation lives in PagesSidebar.
-->
<script lang="ts">
  import {
    Download,
    Undo2,
    Redo2,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Trash2,
    Search,
    Image,
    FileCode,
    Package,
    Shapes,
    PanelLeft,
    Puzzle,
    Settings,
    Waypoints,
  } from 'lucide-svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { exportJsonCanvasDialog } from '$lib/services/interopService';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { pageNav } from '$lib/stores/pages.svelte';
  import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';
  import { keybindings } from '$lib/kernel/keybindings.svelte';

  interface Props {
    onSearch: () => void;
    onExport: () => void;
    onExportPackage: () => void;
    onExportPng: () => void;
    onExportSvg: () => void;
    onPlugins: () => void;
    onSettings: () => void;
  }

  let { onSearch, onExport, onExportPackage, onExportPng, onExportSvg, onPlugins, onSettings }: Props = $props();

  /** Tooltip with the command's current shortcut, e.g. "Undo (Ctrl+Z)". */
  function tip(text: string, commandId: string): string {
    const keys = keybindings.label(commandId);
    return keys ? `${text} (${keys})` : text;
  }

  let exportMenuOpen = $state(false);
  let hasSelection = $derived(workspace.selectedNodeIds.length > 0 || workspace.selectedEdgeIds.length > 0);

  function runExport(action: () => void) {
    exportMenuOpen = false;
    action();
  }
</script>

<svelte:window onclick={() => (exportMenuOpen = false)} />

<nav class="ribbon" aria-label="Canvas tools">
  <div class="ribbon-section">
    <SimpleTooltip text={tip('Pages', 'view.togglePages')} position="right">
      <button class="ribbon-btn" class:active={pageNav.sidebarOpen} aria-pressed={pageNav.sidebarOpen} onclick={() => pageNav.toggleSidebar()}>
        <PanelLeft size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text={tip('Search', 'app.search')} position="right">
      <button class="ribbon-btn" onclick={(e) => { e.stopPropagation(); onSearch(); }}>
        <Search size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text={tip('Graph view', 'view.graph')} position="right">
      <button class="ribbon-btn" class:active={ui.graphOpen} aria-pressed={ui.graphOpen} onclick={() => (ui.graphOpen = !ui.graphOpen)}>
        <Waypoints size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <div class="ribbon-section">
    <SimpleTooltip text={tip('Undo', 'edit.undo')} position="right">
      <button class="ribbon-btn" disabled={!workspace.canUndo || workspace.locked} onclick={() => workspace.undo()}>
        <Undo2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text={tip('Redo', 'edit.redo')} position="right">
      <button class="ribbon-btn" disabled={!workspace.canRedo || workspace.locked} onclick={() => workspace.redo()}>
        <Redo2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <div class="ribbon-section">
    <SimpleTooltip text={tip('Zoom in', 'view.zoomIn')} position="right">
      <button class="ribbon-btn" onclick={() => window.dispatchEvent(new CustomEvent('mosaicflow:zoomIn'))}>
        <ZoomIn size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text={tip('Zoom out', 'view.zoomOut')} position="right">
      <button class="ribbon-btn" onclick={() => window.dispatchEvent(new CustomEvent('mosaicflow:zoomOut'))}>
        <ZoomOut size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text={tip('Fit view', 'view.fit')} position="right">
      <button class="ribbon-btn" onclick={() => window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.1 } }))}>
        <Maximize2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <div class="ribbon-section">
    <SimpleTooltip text={tip('Delete selection', 'edit.delete')} position="right">
      <button
        class="ribbon-btn danger"
        disabled={!hasSelection || workspace.locked}
        onclick={() => workspace.deleteSelection([...workspace.selectedNodeIds], [...workspace.selectedEdgeIds])}
      >
        <Trash2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <div class="ribbon-spacer"></div>

  <div class="ribbon-section">
    <SimpleTooltip text="Plugins" position="right">
      <button class="ribbon-btn" onclick={(e) => { e.stopPropagation(); onPlugins(); }}>
        <Puzzle size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <div class="dropdown-container">
      <SimpleTooltip text="Export" position="right">
        <button
          class="ribbon-btn"
          class:active={exportMenuOpen}
          aria-haspopup="menu"
          aria-expanded={exportMenuOpen}
          onclick={(e) => { e.stopPropagation(); exportMenuOpen = !exportMenuOpen; }}
        >
          <Download size={17} strokeWidth={1.6} />
        </button>
      </SimpleTooltip>

      {#if exportMenuOpen}
        <div class="dropdown-menu" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (exportMenuOpen = false)}>
          <div class="menu-heading">Export page</div>
          <button class="menu-item" role="menuitem" onclick={() => runExport(onExportPackage)}>
            <Package size={15} strokeWidth={1.5} /><span>MosaicFlow package</span><kbd>.mosaic</kbd>
          </button>
          <button class="menu-item" role="menuitem" onclick={() => runExport(exportJsonCanvasDialog)}>
            <Shapes size={15} strokeWidth={1.5} /><span>Obsidian canvas</span><kbd>.canvas</kbd>
          </button>
          <button class="menu-item" role="menuitem" onclick={() => runExport(onExport)}>
            <Download size={15} strokeWidth={1.5} /><span>JSON</span><kbd>.json</kbd>
          </button>
          <div class="menu-divider"></div>
          <button class="menu-item" role="menuitem" onclick={() => runExport(onExportPng)}>
            <Image size={15} strokeWidth={1.5} /><span>Image</span><kbd>.png</kbd>
          </button>
          <button class="menu-item" role="menuitem" onclick={() => runExport(onExportSvg)}>
            <FileCode size={15} strokeWidth={1.5} /><span>Vector</span><kbd>.svg</kbd>
          </button>
        </div>
      {/if}
    </div>
    <SimpleTooltip text={tip('Settings', 'app.settings')} position="right">
      <button class="ribbon-btn" onclick={(e) => { e.stopPropagation(); onSettings(); }}>
        <Settings size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>
</nav>

<style>
  .ribbon {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 44px;
    padding: 4px 0 8px;
    border-right: 1px solid var(--mf-border);
    background: var(--mf-bg);
  }

  .ribbon-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 3px 0;
  }

  .ribbon-section:not(:last-child)::after {
    content: '';
    display: block;
    width: 18px;
    height: 1px;
    margin-top: 4px;
    background: var(--mf-border);
  }

  .ribbon-spacer {
    flex: 1;
  }

  .ribbon-btn {
    position: relative;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .ribbon-btn:hover:not(:disabled) {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .ribbon-btn.active {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .ribbon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .ribbon-btn.danger:hover:not(:disabled) {
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
  }

  .dropdown-container {
    position: relative;
  }

  .dropdown-menu {
    position: absolute;
    left: calc(100% + 8px);
    bottom: 0;
    z-index: 1000;
    min-width: 220px;
    padding: 4px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 8px;
    background: var(--mf-surface-2);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .menu-heading {
    padding: 4px 8px 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--mf-text-3);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: var(--mf-row);
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }

  .menu-item span {
    flex: 1;
  }

  .menu-item :global(svg) {
    color: var(--mf-text-2);
  }

  .menu-item kbd {
    font-family: var(--mf-font-mono);
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .menu-item:hover {
    background: var(--mf-hover);
  }

  .menu-divider {
    height: 1px;
    margin: 4px 2px;
    background: var(--mf-border);
  }
</style>
