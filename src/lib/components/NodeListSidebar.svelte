<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import { ChevronRight, ChevronDown, Search, FolderOpen, GripVertical } from 'lucide-svelte';
  import type { MosaicNode, NodeType } from '$lib/types';
  import { getIconComponent } from '$lib/types';
  import { useSvelteFlow } from '@xyflow/svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();
  
  const { fitView, setCenter } = useSvelteFlow();

  let searchQuery = $state('');
  let expandedGroups = $state<Set<string>>(new Set());
  let focusOnly = $state(false);

  // Sync suppress flag with focusOnly toggle
  $effect(() => {
    if (!focusOnly) {
      workspace.suppressPropertiesPanel = false;
    }
  });

  // Pointer-based DnD sorting state
  let draggedId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);
  let dropPosition = $state<'before' | 'after'>('after');
  let dragContext = $state<string | null>(null);
  let isDragging = $state(false);

  // Custom sort orders (local to sidebar session)
  let groupSortOrder = $state<string[]>([]);
  let rootSortOrder = $state<string[]>([]);
  let childSortOrders = $state<Record<string, string[]>>({});

  // Use centralized icon registry
  function getIcon(type: string) {
    return getIconComponent(type as NodeType);
  }

  function applyCustomOrder(nodes: MosaicNode[], order: string[]): MosaicNode[] {
    if (!order.length) return nodes;
    const orderMap = new Map(order.map((id, i) => [id, i]));
    return [...nodes].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : order.length;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : order.length;
      return ai - bi;
    });
  }

  // Filter and organize nodes
  const organizedNodes = $derived.by(() => {
    const nodes = workspace.nodes;
    const query = searchQuery.toLowerCase();

    const filtered = nodes.filter(node => {
      if (!query) return true;
      const label = node.data.label || node.data.title || node.data.name || node.id;
      return String(label).toLowerCase().includes(query);
    });

    const groups = applyCustomOrder(
      filtered.filter(n => n.type === 'group'),
      groupSortOrder
    );
    const rootNodes = applyCustomOrder(
      filtered.filter(n => !n.parentId && n.type !== 'group'),
      rootSortOrder
    );
    
    const groupChildren: Record<string, MosaicNode[]> = {};
    groups.forEach(group => {
      groupChildren[group.id] = applyCustomOrder(
        filtered.filter(n => n.parentId === group.id),
        childSortOrders[group.id] || []
      );
    });

    return { groups, rootNodes, groupChildren };
  });

  // --- Pointer-based DnD handlers ---
  function handleGripDown(e: PointerEvent, nodeId: string, context: string) {
    e.preventDefault();
    e.stopPropagation();
    draggedId = nodeId;
    dragContext = context;
    isDragging = true;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isDragging || !draggedId) return;

      // Find the node-item or group-header element under the pointer
      const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
      let targetEl: HTMLElement | null = null;
      for (const el of elements) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.dataset.nodeId && htmlEl.dataset.nodeId !== draggedId && htmlEl.dataset.dragContext === dragContext) {
          targetEl = htmlEl;
          break;
        }
      }

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        dropPosition = moveEvent.clientY < midY ? 'before' : 'after';
        dropTargetId = targetEl.dataset.nodeId!;
      } else {
        dropTargetId = null;
      }
    };

    const onPointerUp = () => {
      if (draggedId && dropTargetId && dragContext) {
        applyDrop(draggedId, dropTargetId, dragContext);
      }
      resetDrag();
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function applyDrop(fromId: string, toId: string, context: string) {
    let currentList: MosaicNode[];
    if (context === 'groups') {
      currentList = organizedNodes.groups;
    } else if (context === 'root') {
      currentList = organizedNodes.rootNodes;
    } else {
      currentList = organizedNodes.groupChildren[context] || [];
    }

    const ids = currentList.map(n => n.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(fromIdx, 1);
    const insertIdx = dropPosition === 'before' ? ids.indexOf(toId) : ids.indexOf(toId) + 1;
    ids.splice(insertIdx, 0, fromId);

    if (context === 'groups') {
      groupSortOrder = ids;
    } else if (context === 'root') {
      rootSortOrder = ids;
    } else {
      childSortOrders = { ...childSortOrders, [context]: ids };
    }
  }

  function resetDrag() {
    draggedId = null;
    dropTargetId = null;
    dragContext = null;
    isDragging = false;
  }

  function toggleGroup(groupId: string) {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    expandedGroups = newExpanded;
  }

  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  function selectWithoutProperties(nodeId: string) {
    workspace.suppressPropertiesPanel = true;
    workspace.setSelectedNodes([nodeId]);
    workspace.propertiesPanelOpen = false;
    workspace.selectedNodeForProperties = null;
  }

  function handleNodeClick(node: MosaicNode) {
    if (focusOnly) {
      // Delay to distinguish single vs double click
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        selectWithoutProperties(node.id);
        // Fit the whole canvas into view
        fitView({ duration: 800 });
        clickTimer = null;
      }, 250);
    } else {
      workspace.setSelectedNodes([node.id]);
    }
  }

  function handleNodeDoubleClick(node: MosaicNode) {
    if (focusOnly) {
      // Cancel the pending single-click
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      selectWithoutProperties(node.id);
    } else {
      handleNodeClick(node);
    }
    
    const [absX, absY] = getAbsolutePosition(node);
    const width = node.width || 200;
    const height = node.height || 100;
    setCenter(
      absX + width / 2,
      absY + height / 2,
      { zoom: 1.2, duration: 800 }
    );
  }

  function getAbsolutePosition(node: MosaicNode): [number, number] {
    let x = node.position.x;
    let y = node.position.y;
    if (node.parentId) {
      const parent = workspace.nodes.find(n => n.id === node.parentId);
      if (parent) {
        x += parent.position.x;
        y += parent.position.y;
      }
    }
    return [x, y];
  }

  function getNodeLabel(node: MosaicNode): string {
    return (node.data.label || node.data.title || node.data.name || node.data.content || node.id) as string;
  }
</script>

<div class="node-list-sidebar" class:open={isOpen}>
  <div class="header">
    <h3>Nodes</h3>
    <div class="header-actions">
      <label class="focus-toggle" title="Focus only: double-click navigates without opening properties">
        <input type="checkbox" bind:checked={focusOnly} />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span class="toggle-label">Focus only</span>
      </label>
      <button class="close-btn" onclick={onClose}>&times;</button>
    </div>
  </div>

  <div class="search-bar">
    <Search size={14} class="search-icon" />
    <input 
      type="text" 
      placeholder="Filter nodes..." 
      bind:value={searchQuery}
    />
  </div>

  <div class="node-list">
    <!-- Groups -->
    {#each organizedNodes.groups as group (group.id)}
      <div class="node-item-group">
        <div 
          class="group-header"
          class:selected={workspace.selectedNodeIds.includes(group.id)}
          class:dragging={draggedId === group.id}
          class:drop-before={dropTargetId === group.id && dropPosition === 'before'}
          class:drop-after={dropTargetId === group.id && dropPosition === 'after'}
          data-node-id={group.id}
          data-drag-context="groups"
          onclick={() => handleNodeClick(group)}
          ondblclick={() => handleNodeDoubleClick(group)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleNodeDoubleClick(group)}
        >
          <span
            class="drag-handle"
            onpointerdown={(e) => handleGripDown(e, group.id, 'groups')}
            role="button"
            tabindex="-1"
          ><GripVertical size={12} /></span>
          <button 
            class="expand-btn" 
            onclick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
          >
            {#if expandedGroups.has(group.id)}
              <ChevronDown size={12} />
            {:else}
              <ChevronRight size={12} />
            {/if}
          </button>
          
          <FolderOpen size={14} class="node-icon" />
          <span class="node-label">{getNodeLabel(group)}</span>
          <span class="count-badge">{organizedNodes.groupChildren[group.id]?.length || 0}</span>
        </div>

        {#if expandedGroups.has(group.id)}
          <div class="group-children">
            {#each organizedNodes.groupChildren[group.id] || [] as child (child.id)}
              {@const Icon = getIcon(child.type)}
              <div 
                class="node-item child-node"
                class:selected={workspace.selectedNodeIds.includes(child.id)}
                class:dragging={draggedId === child.id}
                class:drop-before={dropTargetId === child.id && dropPosition === 'before'}
                class:drop-after={dropTargetId === child.id && dropPosition === 'after'}
                data-node-id={child.id}
                data-drag-context={group.id}
                onclick={() => handleNodeClick(child)}
                ondblclick={() => handleNodeDoubleClick(child)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && handleNodeDoubleClick(child)}
              >
                <span
                  class="drag-handle"
                  onpointerdown={(e) => handleGripDown(e, child.id, group.id)}
                  role="button"
                  tabindex="-1"
                ><GripVertical size={12} /></span>
                <Icon size={14} class="node-icon" />
                <span class="node-label">{getNodeLabel(child)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Root Nodes -->
    {#each organizedNodes.rootNodes as node (node.id)}
      {@const Icon = getIcon(node.type)}
      <div 
        class="node-item"
        class:selected={workspace.selectedNodeIds.includes(node.id)}
        class:dragging={draggedId === node.id}
        class:drop-before={dropTargetId === node.id && dropPosition === 'before'}
        class:drop-after={dropTargetId === node.id && dropPosition === 'after'}
        data-node-id={node.id}
        data-drag-context="root"
        onclick={() => handleNodeClick(node)}
        ondblclick={() => handleNodeDoubleClick(node)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && handleNodeDoubleClick(node)}
      >
        <span
          class="drag-handle"
          onpointerdown={(e) => handleGripDown(e, node.id, 'root')}
          role="button"
          tabindex="-1"
        ><GripVertical size={12} /></span>
        <Icon size={14} class="node-icon" />
        <span class="node-label">{getNodeLabel(node)}</span>
      </div>
    {/each}

    {#if organizedNodes.groups.length === 0 && organizedNodes.rootNodes.length === 0}
      <div class="empty-state">
        No nodes found
      </div>
    {/if}
  </div>
</div>

<style>
  .node-list-sidebar {
    position: absolute;
    top: 36px;
    right: 0;
    width: 280px;
    height: calc(100% - 36px);
    background: #0d1117;
    border-left: 1px solid #30363d;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 50;
  }

  .node-list-sidebar.open {
    transform: translateX(0);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #30363d;
  }

  .header h3 {
    font-size: 14px;
    font-weight: 600;
    color: #c9d1d9;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .focus-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
  }

  .focus-toggle input {
    display: none;
  }

  .toggle-track {
    width: 28px;
    height: 14px;
    background: #30363d;
    border-radius: 7px;
    position: relative;
    transition: background 0.2s ease;
  }

  .focus-toggle input:checked + .toggle-track {
    background: #388bfd;
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    background: #c9d1d9;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }

  .focus-toggle input:checked + .toggle-track .toggle-thumb {
    transform: translateX(14px);
  }

  .toggle-label {
    font-size: 10px;
    color: #8b949e;
  }

  .close-btn {
    background: none;
    border: none;
    color: #8b949e;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: #c9d1d9;
  }

  .search-bar {
    padding: 12px 16px;
    position: relative;
    border-bottom: 1px solid #30363d;
  }

  .search-bar :global(.search-icon) {
    position: absolute;
    left: 24px;
    top: 50%;
    transform: translateY(-50%);
    color: #8b949e;
  }

  .search-bar input {
    width: 100%;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 6px 10px 6px 30px;
    color: #c9d1d9;
    font-size: 12px;
    outline: none;
  }

  .search-bar input:focus {
    border-color: #58a6ff;
  }

  .node-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .node-item, .group-header {
    display: flex;
    align-items: center;
    padding: 6px 16px;
    cursor: pointer;
    color: #c9d1d9;
    font-size: 12px;
    user-select: none;
    position: relative;
    transition: background 0.15s ease;
  }

  .node-item:hover, .group-header:hover {
    background: #161b22;
  }

  .node-item.selected, .group-header.selected {
    background: rgba(56, 139, 253, 0.15);
    color: #58a6ff;
  }

  /* DnD styles */
  .drag-handle {
    display: flex;
    align-items: center;
    color: #484f58;
    margin-right: 4px;
    cursor: grab;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
    touch-action: none;
  }

  .node-item:hover .drag-handle,
  .group-header:hover .drag-handle {
    opacity: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .node-item.dragging, .group-header.dragging {
    opacity: 0.4;
  }

  .node-item.drop-before, .group-header.drop-before {
    box-shadow: inset 0 2px 0 0 #58a6ff;
  }

  .node-item.drop-after, .group-header.drop-after {
    box-shadow: inset 0 -2px 0 0 #58a6ff;
  }

  .node-item :global(.node-icon),
  .group-header :global(.node-icon) {
    margin-right: 8px;
    color: #8b949e;
    flex-shrink: 0;
  }

  .node-item.selected :global(.node-icon),
  .group-header.selected :global(.node-icon) {
    color: #58a6ff;
  }

  .node-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .expand-btn {
    background: none;
    border: none;
    color: #8b949e;
    padding: 2px;
    margin-right: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .expand-btn:hover {
    color: #c9d1d9;
  }

  .count-badge {
    font-size: 10px;
    color: #8b949e;
    background: #21262d;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 8px;
  }

  .group-children {
    background: rgba(0, 0, 0, 0.1);
  }

  .child-node {
    padding-left: 36px;
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: #8b949e;
    font-size: 12px;
  }
</style>
