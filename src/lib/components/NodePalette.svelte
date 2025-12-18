<script lang="ts">
  import { NODE_TYPE_INFO, type NodeType } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';

  let isCollapsed = $state(false);
  let activeCategory = $state<string | null>(null);
  let searchQuery = $state('');

  const categories = [
    { id: 'content', label: 'Content', icon: '📝' },
    { id: 'entity', label: 'Entities', icon: '👤' },
    { id: 'osint', label: 'OSINT', icon: '🔍' },
    { id: 'utility', label: 'Utility', icon: '🔧' },
  ];

  const filteredNodes = $derived(() => {
    let nodes = NODE_TYPE_INFO;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter(n => 
        n.label.toLowerCase().includes(query) || 
        n.description.toLowerCase().includes(query)
      );
    }
    
    if (activeCategory) {
      nodes = nodes.filter(n => n.category === activeCategory);
    }
    
    return nodes;
  });

  function handleDragStart(e: DragEvent, type: NodeType) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/mosaicflow-node', type);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function toggleCategory(categoryId: string) {
    activeCategory = activeCategory === categoryId ? null : categoryId;
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }
</script>

<div class="node-palette" class:collapsed={isCollapsed}>
  <div class="palette-header">
    <button class="collapse-btn" onclick={toggleCollapse}>
      {isCollapsed ? '→' : '←'}
    </button>
    {#if !isCollapsed}
      <span class="header-title">Nodes</span>
    {/if}
  </div>

  {#if !isCollapsed}
    <div class="search-box">
      <input 
        type="text" 
        placeholder="Search nodes..."
        bind:value={searchQuery}
      />
    </div>

    <div class="categories">
      {#each categories as cat}
        <button 
          class="category-btn"
          class:active={activeCategory === cat.id}
          onclick={() => toggleCategory(cat.id)}
        >
          <span class="cat-icon">{cat.icon}</span>
          <span class="cat-label">{cat.label}</span>
        </button>
      {/each}
    </div>

    <div class="nodes-list">
      {#each filteredNodes() as nodeInfo}
        <div 
          class="node-item"
          draggable="true"
          ondragstart={(e) => handleDragStart(e, nodeInfo.type)}
          role="button"
          tabindex="0"
        >
          <span class="node-icon">{nodeInfo.icon}</span>
          <div class="node-info">
            <span class="node-label">{nodeInfo.label}</span>
            <span class="node-desc">{nodeInfo.description}</span>
          </div>
        </div>
      {/each}
      
      {#if filteredNodes().length === 0}
        <div class="no-results">
          <span>No nodes found</span>
        </div>
      {/if}
    </div>
  {:else}
    <div class="collapsed-nodes">
      {#each NODE_TYPE_INFO as nodeInfo}
        <div 
          class="collapsed-node-item"
          draggable="true"
          ondragstart={(e) => handleDragStart(e, nodeInfo.type)}
          title={nodeInfo.label}
          role="button"
          tabindex="0"
        >
          <span>{nodeInfo.icon}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .node-palette {
    position: fixed;
    top: 0;
    left: 0;
    width: 260px;
    height: 100vh;
    background: #1a1d21;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
    z-index: 100;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    transition: width 0.3s ease;
  }

  .node-palette.collapsed {
    width: 50px;
  }

  .palette-header {
    padding: 12px 16px;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.02);
  }

  .collapse-btn {
    background: transparent;
    border: none;
    color: #888;
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .collapse-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .header-title {
    font-weight: 600;
    font-size: 14px;
  }

  .search-box {
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .search-box input {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
    outline: none;
  }

  .search-box input:focus {
    border-color: #3b82f6;
  }

  .search-box input::placeholder {
    color: #666;
  }

  .categories {
    padding: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    border-bottom: 1px solid #333;
  }

  .category-btn {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 6px;
    color: #888;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .category-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .category-btn.active {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #60a5fa;
  }

  .cat-icon {
    font-size: 12px;
  }

  .nodes-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .node-item {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    border-radius: 8px;
    margin-bottom: 4px;
    cursor: grab;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    transition: all 0.15s ease;
  }

  .node-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: #444;
  }

  .node-item:active {
    cursor: grabbing;
    background: rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
  }

  .node-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .node-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .node-label {
    font-weight: 500;
    font-size: 13px;
  }

  .node-desc {
    font-size: 11px;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-results {
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 13px;
  }

  .collapsed-nodes {
    flex: 1;
    overflow-y: auto;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .collapsed-node-item {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: grab;
    font-size: 16px;
    transition: all 0.15s ease;
  }

  .collapsed-node-item:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #444;
  }

  .collapsed-node-item:active {
    cursor: grabbing;
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
  }
</style>
