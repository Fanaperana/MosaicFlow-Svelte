<script lang="ts">
  import { NODE_TYPE_INFO, type NodeType } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { 
    MousePointer2, 
    Hand, 
    Plus,
    ChevronDown,
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
    FolderOpen, 
    MapPin, 
    List, 
    Router, 
    Camera, 
    CheckSquare,
    Frame,
  } from 'lucide-svelte';

  // Icon size for toolbar
  const ICON_SIZE = 16;

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
    FolderOpen,
    MapPin,
    List,
    CheckSquare,
    Frame,
  };

  function getIconComponent(iconName: string) {
    return iconMap[iconName] || StickyNote;
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

  // Quick access nodes (most commonly used)
  const quickNodes = $derived(
    NODE_TYPE_INFO.filter(n => ['note', 'image', 'annotation', 'link', 'person', 'timestamp'].includes(n.type))
  );

  function setSelectMode() {
    workspace.setCanvasMode('select');
  }

  function setPanMode() {
    workspace.setCanvasMode('drag');
  }

  function handleAddNode(type: NodeType) {
    // Add node at center of viewport
    const centerX = (window.innerWidth / 2 - workspace.viewport.x) / workspace.viewport.zoom;
    const centerY = (window.innerHeight / 2 - workspace.viewport.y) / workspace.viewport.zoom;
    const newNode = workspace.createNode(type, { x: centerX - 100, y: centerY - 50 });
    
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
      {@const IconComponent = getIconComponent(nodeInfo.icon)}
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
            {@const IconComponent = getIconComponent(nodeInfo.icon)}
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
    top: 44px; /* Below the canvas header */
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(17, 17, 24, 0.95);
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    backdrop-filter: blur(8px);
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toolbar-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fafafa;
  }

  .toolbar-btn.active {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .toolbar-divider {
    width: 1px;
    height: 18px;
    background: #2a2a3a;
    margin: 0 4px;
  }

  /* Dropdown menu overrides */
  :global(.node-dropdown) {
    min-width: 160px !important;
    padding: 4px !important;
    background: #111118 !important;
    border: 1px solid #2a2a3a !important;
  }

  :global(.node-dropdown .category-label) {
    font-size: 10px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    color: #666 !important;
    padding: 6px 8px 4px !important;
    font-weight: 500 !important;
  }

  :global(.node-dropdown .node-item) {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 6px 8px !important;
    font-size: 12px !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    color: #ccc !important;
  }

  :global(.node-dropdown .node-item:hover) {
    background: rgba(59, 130, 246, 0.15) !important;
    color: #fafafa !important;
  }

  :global(.node-dropdown [data-dropdown-menu-separator]) {
    height: 1px !important;
    background: #2a2a3a !important;
    margin: 4px 0 !important;
  }
</style>
