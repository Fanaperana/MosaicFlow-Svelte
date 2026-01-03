<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import { ChevronRight, ChevronDown, Search, Box, StickyNote, Image, Link, Code, Clock, User, Building2, Globe, FileDigit, KeyRound, MessageSquare, FolderOpen, MapPin, List, CheckSquare, Router, Camera, LayoutGrid } from 'lucide-svelte';
  import type { MosaicNode } from '$lib/types';
  import { useSvelteFlow } from '@xyflow/svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();
  
  const { fitView, setCenter } = useSvelteFlow();

  let searchQuery = $state('');
  let expandedGroups = $state<Set<string>>(new Set());

  // Icon mapping
  const iconMap: Record<string, any> = {
    note: StickyNote,
    image: Image,
    link: Link,
    code: Code,
    timestamp: Clock,
    person: User,
    organization: Building2,
    domain: Globe,
    hash: FileDigit,
    credential: KeyRound,
    socialPost: MessageSquare,
    group: FolderOpen,
    map: MapPin,
    router: Router,
    linkList: List,
    snapshot: Camera,
    action: CheckSquare,
    iframe: LayoutGrid,
    annotation: StickyNote, // Use StickyNote for annotation as fallback or add specific icon
  };

  function getIcon(type: string) {
    return iconMap[type] || Box;
  }

  // Filter and organize nodes
  const organizedNodes = $derived.by(() => {
    const nodes = workspace.nodes;
    const query = searchQuery.toLowerCase();

    // Filter by search query
    const filtered = nodes.filter(node => {
      if (!query) return true;
      const label = node.data.label || node.data.title || node.data.name || node.id;
      return String(label).toLowerCase().includes(query);
    });

    // Separate groups and root nodes
    const groups = filtered.filter(n => n.type === 'group');
    const rootNodes = filtered.filter(n => !n.parentId && n.type !== 'group');
    
    // Map children to groups
    const groupChildren: Record<string, MosaicNode[]> = {};
    groups.forEach(group => {
      groupChildren[group.id] = filtered.filter(n => n.parentId === group.id);
    });

    return { groups, rootNodes, groupChildren };
  });

  function toggleGroup(groupId: string) {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    expandedGroups = newExpanded;
  }

  function handleNodeClick(node: MosaicNode) {
    // Select node
    workspace.setSelectedNodes([node.id]);
  }

  function handleNodeDoubleClick(node: MosaicNode) {
    // Ensure selection is set before focusing
    handleNodeClick(node);
    
    // Calculate absolute position for child nodes
    let absoluteX = node.position.x;
    let absoluteY = node.position.y;
    
    // If node has a parent (is inside a group), add parent's position
    if (node.parentId) {
      const parent = workspace.nodes.find(n => n.id === node.parentId);
      if (parent) {
        absoluteX += parent.position.x;
        absoluteY += parent.position.y;
      }
    }
    
    // Center view on node using absolute canvas position
    const width = node.width || 200;
    const height = node.height || 100;
    setCenter(
      absoluteX + width / 2,
      absoluteY + height / 2,
      { zoom: 1.2, duration: 800 }
    );
  }

  function getNodeLabel(node: MosaicNode): string {
    return (node.data.label || node.data.title || node.data.name || node.data.content || node.id) as string;
  }
</script>

<div class="node-list-sidebar" class:open={isOpen}>
  <div class="header">
    <h3>Nodes</h3>
    <button class="close-btn" onclick={onClose}>&times;</button>
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
          onclick={() => handleNodeClick(group)}
          ondblclick={() => handleNodeDoubleClick(group)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleNodeDoubleClick(group)}
        >
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
                onclick={() => handleNodeClick(child)}
                ondblclick={() => handleNodeDoubleClick(child)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && handleNodeDoubleClick(child)}
              >
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
        onclick={() => handleNodeClick(node)}
        ondblclick={() => handleNodeDoubleClick(node)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && handleNodeDoubleClick(node)}
      >
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
  }

  .node-item:hover, .group-header:hover {
    background: #161b22;
  }

  .node-item.selected, .group-header.selected {
    background: rgba(56, 139, 253, 0.15);
    color: #58a6ff;
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
