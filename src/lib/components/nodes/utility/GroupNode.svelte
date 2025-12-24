<!--
  GroupNode - Utility Category
  
  Minimal container for grouping nodes (subflow).
  The label floats at the top and the rest is transparent to show child nodes.
-->
<script lang="ts">
  import { type NodeProps, type Node, NodeResizer } from '@xyflow/svelte';
  import type { GroupNodeData } from '$lib/types';

  type GroupNodeType = Node<GroupNodeData, 'group'>;

  let { data, selected, id }: NodeProps<GroupNodeType> = $props();
  
  const groupColor = $derived(data.groupColor || '#3b82f6');
  const labelColor = $derived(data.labelColor || groupColor);
  const bgColor = $derived(data.groupBgColor || '');
  const bgOpacity = $derived(data.groupBgOpacity ?? 0.05);
  
  // Helper to convert hex to rgba
  function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return `rgba(59, 130, 246, ${opacity})`;
  }
  
  const backgroundColor = $derived(
    bgColor ? hexToRgba(bgColor, bgOpacity) : hexToRgba(groupColor, bgOpacity)
  );
  const selectedBgColor = $derived(
    bgColor ? hexToRgba(bgColor, Math.min(bgOpacity + 0.03, 1)) : hexToRgba(groupColor, Math.min(bgOpacity + 0.03, 1))
  );
</script>

<NodeResizer 
  minWidth={200} 
  minHeight={150} 
  isVisible={selected}
  lineStyle="border-color: {groupColor}"
  handleStyle="background: {groupColor}; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="group-container"
  class:selected
  style="--group-color: {groupColor}; --bg-color: {backgroundColor}; --selected-bg-color: {selectedBgColor}"
>
  {#if data.label}
    <div class="group-label" style="color: {labelColor}">
      {data.label}
    </div>
  {/if}
</div>

<style>
  .group-container {
    width: 100%;
    height: 100%;
    background: var(--bg-color);
    border: 2px dashed var(--group-color, #3b82f6);
    border-radius: 12px;
    position: relative;
    /* Ensure clicks on the background are captured for selection */
    pointer-events: all;
  }

  .group-container.selected {
    background: var(--selected-bg-color);
  }

  .group-label {
    position: absolute;
    top: 8px;
    left: 12px;
    font-size: 12px;
    font-weight: 500;
    background: transparent;
    padding: 2px 8px;
    border-radius: 4px;
    user-select: none;
    pointer-events: none;
  }
</style>
