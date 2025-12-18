<script lang="ts">
  import { 
    Plus, 
    Save, 
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
    // Node type icons
    StickyNote,
    Image,
    Link,
    Code,
    Clock,
    User,
    Building2,
    Globe,
    FileDigit,
    KeyRound,
    MessageSquare,
    Router,
    Camera,
    FolderOpen as FolderIcon,
    MapPin,
    List,
    CheckSquare,
  } from 'lucide-svelte';
  import { NODE_TYPE_INFO, type NodeType } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { cn } from '$lib/utils';

  interface Props {
    onHome: () => void;
    onSave: () => void;
    onOpen: () => void;
    onExport: () => void;
    onSettings: () => void;
    onNewCanvas?: () => void;
    canvasName?: string;
    vaultName?: string;
  }

  let { onHome, onSave, onOpen, onExport, onSettings, onNewCanvas, canvasName, vaultName }: Props = $props();

  let addMenuOpen = $state(false);
  let exportMenuOpen = $state(false);

  // Map icon names to components
  const iconMap: Record<string, typeof StickyNote> = {
    StickyNote,
    Image,
    Link,
    Code,
    Clock,
    User,
    Building2,
    Globe,
    FileDigit,
    KeyRound,
    MessageSquare,
    Router,
    Camera,
    FolderOpen: FolderIcon,
    MapPin,
    List,
    CheckSquare,
  };

  function getIconComponent(iconName: string) {
    return iconMap[iconName] || StickyNote;
  }

  function handleAddNode(type: NodeType) {
    // Add node at center of viewport
    const centerX = (window.innerWidth / 2 - workspace.viewport.x) / workspace.viewport.zoom;
    const centerY = (window.innerHeight / 2 - workspace.viewport.y) / workspace.viewport.zoom;
    workspace.createNode(type, { x: centerX, y: centerY });
    addMenuOpen = false;
  }

  function handleClickOutside() {
    addMenuOpen = false;
    exportMenuOpen = false;
  }

  // Group nodes by category
  const groupedNodes = $derived(() => {
    const groups: Record<string, typeof NODE_TYPE_INFO> = {
      content: [],
      entity: [],
      osint: [],
      utility: [],
    };
    NODE_TYPE_INFO.forEach(info => {
      groups[info.category].push(info);
    });
    return groups;
  });

  const categoryLabels: Record<string, string> = {
    content: 'Content',
    entity: 'Entities',
    osint: 'OSINT',
    utility: 'Utility',
  };
</script>

<svelte:window onclick={handleClickOutside} />

<div class="sidebar">
  <!-- Top section -->
  <div class="sidebar-section">
    <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onHome(); }} title="Home">
      <Home size={20} strokeWidth={1.5} />
    </button>
  </div>

  <!-- Main tools -->
  <div class="sidebar-section">
    <div class="dropdown-container">
      <button 
        class="sidebar-btn primary" 
        onclick={(e) => { e.stopPropagation(); addMenuOpen = !addMenuOpen; exportMenuOpen = false; }}
        title="Add Node"
      >
        <Plus size={20} strokeWidth={1.5} />
      </button>
      
      {#if addMenuOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="dropdown-menu add-menu" onclick={(e) => e.stopPropagation()}>
          {#each Object.entries(groupedNodes()) as [category, nodes]}
            <div class="menu-category">
              <span class="category-label">{categoryLabels[category]}</span>
              {#each nodes as nodeInfo}
                {@const IconComponent = getIconComponent(nodeInfo.icon)}
                <button 
                  class="menu-item"
                  onclick={() => handleAddNode(nodeInfo.type)}
                >
                  <IconComponent size={16} strokeWidth={1.5} />
                  <span>{nodeInfo.label}</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onSave(); }} title="Save">
      <Save size={20} strokeWidth={1.5} />
    </button>
    
    <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onOpen(); }} title="Open">
      <FolderOpen size={20} strokeWidth={1.5} />
    </button>

    <div class="dropdown-container">
      <button 
        class="sidebar-btn"
        onclick={(e) => { e.stopPropagation(); exportMenuOpen = !exportMenuOpen; addMenuOpen = false; }}
        title="Export"
      >
        <Download size={20} strokeWidth={1.5} />
      </button>
      
      {#if exportMenuOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="dropdown-menu" onclick={(e) => e.stopPropagation()}>
          <button class="menu-item" onclick={() => { onExport(); exportMenuOpen = false; }}>
            <Download size={16} strokeWidth={1.5} />
            <span>Export as ZIP</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Edit tools -->
  <div class="sidebar-section">
    <button class="sidebar-btn" title="Undo (coming soon)" disabled>
      <Undo2 size={20} strokeWidth={1.5} />
    </button>
    <button class="sidebar-btn" title="Redo (coming soon)" disabled>
      <Redo2 size={20} strokeWidth={1.5} />
    </button>
  </div>

  <!-- View tools -->
  <div class="sidebar-section">
    <button 
      class="sidebar-btn" 
      onclick={() => workspace.setViewport({ ...workspace.viewport, zoom: Math.min(workspace.viewport.zoom * 1.2, 4) })}
      title="Zoom In"
    >
      <ZoomIn size={20} strokeWidth={1.5} />
    </button>
    <button 
      class="sidebar-btn"
      onclick={() => workspace.setViewport({ ...workspace.viewport, zoom: Math.max(workspace.viewport.zoom / 1.2, 0.1) })}
      title="Zoom Out"
    >
      <ZoomOut size={20} strokeWidth={1.5} />
    </button>
    <button 
      class="sidebar-btn"
      onclick={() => workspace.setViewport({ x: 0, y: 0, zoom: 1 })}
      title="Fit View"
    >
      <Maximize2 size={20} strokeWidth={1.5} />
    </button>
  </div>

  <!-- Delete -->
  <div class="sidebar-section">
    <button 
      class="sidebar-btn danger" 
      onclick={() => {
        if (workspace.selectedNodeIds.length > 0) {
          workspace.deleteNodes(workspace.selectedNodeIds);
        }
      }}
      title="Delete Selected"
      disabled={workspace.selectedNodeIds.length === 0}
    >
      <Trash2 size={20} strokeWidth={1.5} />
    </button>
  </div>

  <!-- Spacer -->
  <div class="sidebar-spacer"></div>

  <!-- Bottom section -->
  <div class="sidebar-section">
    <button class="sidebar-btn" onclick={(e) => { e.stopPropagation(); onSettings(); }} title="Settings">
      <Settings size={20} strokeWidth={1.5} />
    </button>
  </div>
</div>

<style>
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 52px;
    background: #0a0a0f;
    border-right: 1px solid #1e1e2e;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 4px;
    z-index: 100;
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }

  .sidebar-section:not(:last-child)::after {
    content: '';
    display: block;
    height: 1px;
    background: #1e1e2e;
    margin-top: 4px;
  }

  .sidebar-spacer {
    flex: 1;
  }

  .sidebar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #888;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .sidebar-btn:hover:not(:disabled) {
    background: #1e1e2e;
    color: #fafafa;
  }

  .sidebar-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sidebar-btn.primary {
    background: #3b82f6;
    color: white;
  }

  .sidebar-btn.primary:hover {
    background: #2563eb;
  }

  .sidebar-btn.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
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
    min-width: 180px;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 1000;
  }

  .dropdown-menu.add-menu {
    min-width: 200px;
    max-height: 400px;
    overflow-y: auto;
  }

  .menu-category {
    padding: 4px 0;
  }

  .menu-category:not(:last-child) {
    border-bottom: 1px solid #1e1e2e;
    margin-bottom: 4px;
  }

  .category-label {
    display: block;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #666;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #fafafa;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .menu-item:hover {
    background: #1e1e2e;
  }
</style>
