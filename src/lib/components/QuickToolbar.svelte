<script lang="ts">
  import { 
    nodeRegistry,
    NODE_CATEGORIES, 
    getIconByName,
  } from '$lib/kernel/registries/node-registry';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { findNonOverlappingPosition } from '$lib/utils/resolve-collisions';
  import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { 
    MousePointer2, 
    Hand, 
    Plus,
  } from 'lucide-svelte';

  // Icon size for toolbar
  const ICON_SIZE = 16;

  // Group nodes by category - using plugin registry
  const groupedNodes = $derived(() => nodeRegistry.getGroupedByCategory());

  // Category labels from registry
  const categoryLabels = Object.fromEntries(
    NODE_CATEGORIES.map(c => [c.id, c.label])
  );

  // Quick access nodes from plugin registry (nodes with quickAccess: true)
  const quickNodes = $derived(nodeRegistry.getQuickAccess());

  function setSelectMode() {
    workspace.setCanvasMode('select');
  }

  function setPanMode() {
    workspace.setCanvasMode('drag');
  }

  function handleAddNode(type: string) {
    const { defaultWidth, defaultHeight } = nodeRegistry.getDimensions(type);
    const centerX = (window.innerWidth / 2 - workspace.viewport.x) / workspace.viewport.zoom;
    const centerY = (window.innerHeight / 2 - workspace.viewport.y) / workspace.viewport.zoom;
    const position = findNonOverlappingPosition(
      { x: centerX - defaultWidth / 2, y: centerY - defaultHeight / 2 },
      { width: defaultWidth, height: defaultHeight },
      workspace.nodes,
      20
    );
    const newNode = workspace.createNode(type, position);
    
    // Select the newly created node
    workspace.setSelectedNodes([newNode.id]);
  }
</script>

<div class="quick-toolbar">
  <!-- Mode Selection -->
  <div class="toolbar-group">
    <SimpleTooltip text="Select (V)" position="bottom">
      <button 
        class="toolbar-btn" 
        class:active={workspace.canvasMode === 'select'}
        onclick={setSelectMode}
      >
        <MousePointer2 size={ICON_SIZE} strokeWidth={1.5} />
      </button>
    </SimpleTooltip>

    <SimpleTooltip text="Pan (Space + Drag)" position="bottom">
      <button 
        class="toolbar-btn"
        class:active={workspace.canvasMode === 'drag'}
        onclick={setPanMode}
      >
        <Hand size={ICON_SIZE} strokeWidth={1.5} />
      </button>
    </SimpleTooltip>
  </div>

  <div class="toolbar-divider"></div>

  <!-- Quick Add Nodes -->
  <div class="toolbar-group">
    {#each quickNodes as nodeInfo}
      {@const IconComponent = getIconByName(nodeInfo.iconName)}
      <SimpleTooltip text={nodeInfo.label} position="bottom">
        <button 
          class="toolbar-btn"
          onclick={() => handleAddNode(nodeInfo.type)}
        >
          <IconComponent size={ICON_SIZE} strokeWidth={1.5} />
        </button>
      </SimpleTooltip>
    {/each}
  </div>

  <div class="toolbar-divider"></div>

  <!-- More Nodes Dropdown -->
  <DropdownMenu.Root>
    <SimpleTooltip text="More nodes" position="bottom">
      <DropdownMenu.Trigger class="toolbar-btn dropdown-trigger">
        <Plus size={ICON_SIZE} strokeWidth={1.5} />
      </DropdownMenu.Trigger>
    </SimpleTooltip>
    
    <DropdownMenu.Content class="node-dropdown" align="start" sideOffset={4}>
      {#each Object.entries(groupedNodes()) as [category, nodes]}
        <DropdownMenu.Group>
          <DropdownMenu.Label class="category-label">{categoryLabels[category]}</DropdownMenu.Label>
          {#each nodes as nodeInfo}
            {@const IconComponent = getIconByName(nodeInfo.iconName)}
            <DropdownMenu.Item 
              class="node-item"
              onclick={() => handleAddNode(nodeInfo.type)}
            >
              <IconComponent size={14} strokeWidth={1.5} />
              <span>{nodeInfo.label}</span>
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Group>
        {#if category !== 'utility'}
          <DropdownMenu.Separator />
        {/if}
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<style>
  .quick-toolbar {
    position: absolute;
    top: 46px; /* Below the canvas header */
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    background: color-mix(in srgb, var(--mf-surface-2) 92%, transparent);
    border: 1px solid var(--mf-border-strong);
    border-radius: 10px;
    backdrop-filter: blur(10px);
    z-index: 100;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .quick-toolbar :global(.toolbar-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--mf-text-2);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .quick-toolbar :global(.toolbar-btn:hover) {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .quick-toolbar :global(.toolbar-btn.active) {
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
  }

  .toolbar-divider {
    width: 1px;
    height: 16px;
    background: var(--mf-border-strong);
    margin: 0 3px;
  }

  /* Dropdown menu overrides */
  :global(.node-dropdown) {
    min-width: 180px !important;
    max-height: 70vh;
    overflow-y: auto;
    padding: 4px !important;
    background: var(--mf-surface-2) !important;
    border: 1px solid var(--mf-border-strong) !important;
    border-radius: 8px !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45) !important;
    font-family: var(--mf-font-ui);
  }

  :global(.node-dropdown .category-label) {
    font-size: 11px !important;
    color: var(--mf-text-3) !important;
    padding: 6px 8px 2px !important;
    font-weight: 500 !important;
  }

  :global(.node-dropdown .node-item) {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    height: var(--mf-row);
    padding: 0 8px !important;
    font-size: 12.5px !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    color: var(--mf-text) !important;
  }

  :global(.node-dropdown .node-item svg) {
    color: var(--mf-text-2);
  }

  :global(.node-dropdown .node-item:hover),
  :global(.node-dropdown .node-item[data-highlighted]) {
    background: var(--mf-hover) !important;
  }

  :global(.node-dropdown [data-dropdown-menu-separator]) {
    height: 1px !important;
    background: var(--mf-border) !important;
    margin: 4px 0 !important;
  }
</style>
