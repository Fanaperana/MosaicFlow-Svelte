<script lang="ts">
  import { 
    nodeRegistry,
    getIconByName,
  } from '$lib/kernel/registries/node-registry';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { findNonOverlappingPosition } from '$lib/utils/resolve-collisions';
  import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';
  import { 
    MousePointer2, 
    Hand, 
    Plus,
  } from 'lucide-svelte';

  // Icon size for toolbar
  const ICON_SIZE = 16;

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

  <!-- All blocks -->
  <SimpleTooltip text="Insert block (/)" position="bottom">
    <button
      class="toolbar-btn"
      onclick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        window.dispatchEvent(new CustomEvent('mosaicflow:insertMenu', { detail: { x: r.left, y: r.bottom + 4 } }));
      }}
    >
      <Plus size={ICON_SIZE} strokeWidth={1.5} />
    </button>
  </SimpleTooltip>
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
</style>
