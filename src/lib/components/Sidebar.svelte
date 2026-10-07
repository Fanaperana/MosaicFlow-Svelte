<script lang="ts">
  import { 
    Plus, 
    FolderOpen, 
    Download, 
    Settings, 
    Undo2, 
    Redo2,
    Home,
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
  } from 'lucide-svelte';
  import { pageNav } from '$lib/stores/pages.svelte';
  import { exportJsonCanvasDialog } from '$lib/services/interopService';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { cn } from '$lib/utils';
  import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';

  interface Props {
    onHome: () => void;
    onOpen: () => void;
    onExport: () => void;
    onExportPackage: () => void;
    onExportPng: () => void;
    onExportSvg: () => void;
    onSettings: () => void;
    onNewCanvas: () => void;
    onSearch: () => void;
    canvasName?: string;
    vaultName?: string;
  }

  let { onHome, onOpen, onExport, onExportPackage, onExportPng, onExportSvg, onSettings, onNewCanvas, onSearch, canvasName, vaultName }: Props = $props();

  let exportMenuOpen = $state(false);

  function handleClickOutside() {
    exportMenuOpen = false;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="sidebar">
  <!-- Top section -->
  <div class="sidebar-section">
    <SimpleTooltip text="Pages (Ctrl+\)" position="right">
      <button class="sidebar-btn" class:active={pageNav.sidebarOpen} onclick={(e) => { e.stopPropagation(); pageNav.toggleSidebar(); }}>
        <PanelLeft size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text="Home" position="right">
      <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onHome(); }}>
        <Home size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text="Search (Ctrl+K)" position="right">
      <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onSearch(); }}>
        <Search size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <!-- Main tools -->
  <div class="sidebar-section">
    <SimpleTooltip text="New Canvas" position="right">
      <button 
        class="sidebar-btn" 
        onclick={(e) => { e.stopPropagation(); onNewCanvas(); }}
      >
        <Plus size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    
    <SimpleTooltip text="Open" position="right">
      <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onOpen(); }}>
        <FolderOpen size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>

    <div class="dropdown-container">
      <SimpleTooltip text="Export" position="right">
        <button 
          class="sidebar-btn"
          onclick={(e) => { e.stopPropagation(); exportMenuOpen = !exportMenuOpen; }}
        >
          <Download size={17} strokeWidth={1.6} />
        </button>
      </SimpleTooltip>
      
      {#if exportMenuOpen}
        <div class="dropdown-menu" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <button class="menu-item" onclick={() => { onExportPackage(); exportMenuOpen = false; }}>
            <Package size={16} strokeWidth={1.5} />
            <span>Export as .mosaic</span>
          </button>
          <button class="menu-item" onclick={() => { exportJsonCanvasDialog(); exportMenuOpen = false; }}>
            <Shapes size={16} strokeWidth={1.5} />
            <span>Export as Obsidian canvas</span>
          </button>
          <button class="menu-item" onclick={() => { onExport(); exportMenuOpen = false; }}>
            <Download size={16} strokeWidth={1.5} />
            <span>Export as JSON</span>
          </button>
          <button class="menu-item" onclick={() => { onExportPng(); exportMenuOpen = false; }}>
            <Image size={16} strokeWidth={1.5} />
            <span>Export as PNG</span>
          </button>
          <button class="menu-item" onclick={() => { onExportSvg(); exportMenuOpen = false; }}>
            <FileCode size={16} strokeWidth={1.5} />
            <span>Export as SVG</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Edit tools -->
  <div class="sidebar-section">
    <SimpleTooltip text="Undo (Ctrl+Z)" position="right">
      <button 
        class="sidebar-btn" 
        disabled={!workspace.canUndo}
        onclick={() => workspace.undo()}
      >
        <Undo2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text="Redo (Ctrl+Y)" position="right">
      <button 
        class="sidebar-btn" 
        disabled={!workspace.canRedo}
        onclick={() => workspace.redo()}
      >
        <Redo2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <!-- View tools -->
  <div class="sidebar-section">
    <SimpleTooltip text="Zoom In" position="right">
      <button 
        class="sidebar-btn" 
        onclick={() => window.dispatchEvent(new CustomEvent('mosaicflow:zoomIn'))}
      >
        <ZoomIn size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text="Zoom Out" position="right">
      <button 
        class="sidebar-btn"
        onclick={() => window.dispatchEvent(new CustomEvent('mosaicflow:zoomOut'))}
      >
        <ZoomOut size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
    <SimpleTooltip text="Fit View" position="right">
      <button 
        class="sidebar-btn"
        onclick={() => window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.1 } }))}
      >
        <Maximize2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <!-- Delete -->
  <div class="sidebar-section">
    <SimpleTooltip text="Delete Selected" position="right">
      <button 
        class="sidebar-btn danger" 
        onclick={() => workspace.deleteSelection([...workspace.selectedNodeIds], [...workspace.selectedEdgeIds])}
        disabled={workspace.selectedNodeIds.length === 0 && workspace.selectedEdgeIds.length === 0}
      >
        <Trash2 size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>

  <!-- Spacer -->
  <div class="sidebar-spacer"></div>

  <!-- Bottom section -->
  <div class="sidebar-section">
    <SimpleTooltip text="Settings" position="right">
      <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onSettings(); }}>
        <Settings size={17} strokeWidth={1.6} />
      </button>
    </SimpleTooltip>
  </div>
</div>

<style>
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 44px;
    background: var(--mf-surface);
    border-right: 1px solid var(--mf-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0;
    gap: 2px;
    z-index: 100;
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 3px 0;
  }

  .sidebar-section:not(:last-child)::after {
    content: '';
    display: block;
    width: 18px;
    height: 1px;
    background: var(--mf-border);
    margin-top: 4px;
  }

  .sidebar-spacer {
    flex: 1;
  }

  .sidebar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    position: relative;
  }

  .sidebar-btn:hover:not(:disabled) {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .sidebar-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sidebar-btn.active {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .sidebar-btn.danger:hover:not(:disabled) {
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
  }

  /* Tooltip */
  .sidebar-btn::before {
    content: attr(title);
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    padding: 6px 10px;
    background: #1e1e2e;
    border: 1px solid #2a2a3a;
    border-radius: 6px;
    font-size: 12px;
    color: #fafafa;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s;
    pointer-events: none;
    z-index: 1000;
  }

  .sidebar-btn:hover::before {
    opacity: 1;
    visibility: visible;
  }

  .dropdown-container {
    position: relative;
  }

  .dropdown-menu {
    position: absolute;
    left: calc(100% + 8px);
    top: 0;
    min-width: 168px;
    background: var(--mf-surface-2);
    border: 1px solid var(--mf-border-strong);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    z-index: 1000;
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
    cursor: pointer;
    text-align: left;
  }

  .menu-item :global(svg) {
    color: var(--mf-text-2);
  }

  .menu-item:hover {
    background: var(--mf-hover);
  }
</style>
