<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { MosaicNodeData } from '$lib/types';
  import type { Snippet } from 'svelte';

  type BaseNode = Node<MosaicNodeData>;

  interface Props extends NodeProps<BaseNode> {
    children?: Snippet;
  }

  let { data, selected, id, children }: Props = $props();
  
  const nodeColor = $derived(data.color || '#1e1e1e');
  const borderColor = $derived(data.borderColor || (selected ? '#3b82f6' : '#333'));

  // Border styling
  const borderWidth = $derived((data.borderWidth as number) ?? 1);
  const borderStyle = $derived((data.borderStyle as string) ?? 'solid');
  const borderRadius = $derived((data.borderRadius as number) ?? 4);
  const bgOpacity = $derived((data.bgOpacity as number) ?? 1);

  function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return hex;
  }
  const backgroundColor = $derived(hexToRgba(nodeColor, bgOpacity));
</script>

<NodeResizer 
  minWidth={150} 
  minHeight={80} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="mosaic-node"
  style="
    background: {backgroundColor};
    border-color: {borderColor};
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
    color: {data.textColor || '#e0e0e0'};
  "
>
  <div class="node-header">
    <span class="node-title">{data.title}</span>
  </div>
  
  <div class="node-content">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

<Handle type="target" position={Position.Left} id="left-target" />
<Handle type="source" position={Position.Left} id="left-source" />
<Handle type="target" position={Position.Right} id="right-target" />
<Handle type="source" position={Position.Right} id="right-source" />
<Handle type="target" position={Position.Top} id="top-target" />
<Handle type="source" position={Position.Top} id="top-source" />
<Handle type="target" position={Position.Bottom} id="bottom-target" />
<Handle type="source" position={Position.Bottom} id="bottom-source" />

<style>
  .mosaic-node {
    min-width: 150px;
    min-height: 80px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    /* Crisp text rendering */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: geometricPrecision;
  }

  .node-header {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .node-title {
    font-weight: 600;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .node-content {
    padding: 12px;
    flex: 1;
    overflow: auto;
    font-size: 12px;
  }

  :global(.svelte-flow__handle) {
    width: 8px;
    height: 8px;
    background: #3b82f6;
    border: 2px solid #1e1e1e;
    border-radius: 2px;
  }

  :global(.svelte-flow__handle:hover) {
    background: #60a5fa;
  }
</style>
