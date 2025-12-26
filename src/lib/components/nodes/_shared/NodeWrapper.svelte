<!--
  NodeWrapper Component
  
  Base wrapper for all node components providing:
  - NodeResizer
  - NodeFloatingToolbar (delete, color, zoom, edit)
  - Consistent styling
  - Border/background customization
  - Selection state
  
  Usage:
  <NodeWrapper {data} {selected} {id} nodeType="note">
    <svelte:fragment slot="header">
      <StickyNote size={14} />
      <span>{data.title}</span>
    </svelte:fragment>
    
    [Your node content here]
  </NodeWrapper>
-->
<script lang="ts">
  import { NodeResizer } from '@xyflow/svelte';
  import type { BaseNodeData, NodeType } from '$lib/types';
  import { getNodeStyles, getNodeDimensions, nodeStyleToString } from './utils';
  import type { Snippet } from 'svelte';
  import NodeHandles from './NodeHandles.svelte';
  import NodeFloatingToolbar from './NodeFloatingToolbar.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import '$lib/components/nodes/_shared/styles.css';

  interface Props {
    data: BaseNodeData;
    selected?: boolean;
    id: string;
    nodeType: NodeType;
    header?: Snippet;
    headerActions?: Snippet;
    children?: Snippet;
    showHeader?: boolean;
    hideHandles?: boolean;
    hideToolbar?: boolean;
    class?: string;
  }

  let { 
    data, 
    selected = false, 
    id, 
    nodeType,
    header,
    headerActions,
    children,
    showHeader,
    hideHandles = false,
    hideToolbar = false,
    class: className = ''
  }: Props = $props();
  
  // showHeader defaults to data.showHeader ?? false (hidden by default like original)
  const shouldShowHeader = $derived(showHeader ?? data.showHeader ?? false);
  
  // Get dimensions for this node type
  const dimensions = $derived(getNodeDimensions(nodeType));
  
  // Compute styles from data
  const styles = $derived(getNodeStyles(data));
  const styleString = $derived(nodeStyleToString(styles));
  
  // Check if locked
  const isLocked = $derived(data.locked ?? false);

  // Get color for the toolbar
  const nodeColor = $derived(data.color || data.borderColor || '#1e1e1e');

  function handleColorChange(newColor: string) {
    workspace.updateNodeData(id, { color: newColor });
  }
</script>

{#if !hideToolbar}
  <NodeFloatingToolbar 
    nodeId={id} 
    selected={selected} 
    color={nodeColor}
    onColorChange={handleColorChange}
  />
{/if}

<NodeResizer 
  minWidth={dimensions.minWidth} 
  minHeight={dimensions.minHeight} 
  isVisible={selected && !isLocked}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="mosaic-node {className}"
  class:selected
  class:locked={isLocked}
  style={styleString}
  data-node-id={id}
  data-node-type={nodeType}
>
  {#if shouldShowHeader}
    <div class="node-header">
      {#if header}
        {@render header()}
      {:else}
        <span class="node-title">{data.title}</span>
      {/if}
      {#if headerActions}
        {@render headerActions()}
      {/if}
    </div>
  {/if}
  
  <div class="node-content">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

{#if !hideHandles}
  <NodeHandles />
{/if}
