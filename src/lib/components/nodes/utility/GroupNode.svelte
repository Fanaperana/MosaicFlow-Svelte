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
  
  // Use standard properties: borderColor for border, color for background
  // Fall back to legacy groupColor/groupBgColor for backwards compatibility
  const groupColor = $derived(data.borderColor || data.groupColor || '#3b82f6');
  const labelColor = $derived(data.labelColor || data.textColor || groupColor);
  // Default to almost transparent background (5% opacity)
  const bgColor = $derived(data.color || data.groupBgColor || 'rgba(59, 130, 246, 0.05)');
  
  // Helper to parse color and extract rgba values
  function parseColor(color: string): { r: number; g: number; b: number; a: number } {
    // Check if it's an rgba string
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]),
        g: parseInt(rgbaMatch[2]),
        b: parseInt(rgbaMatch[3]),
        a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
      };
    }
    
    // Check if it's a hex color
    const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16),
        a: 1
      };
    }
    
    // Default fallback
    return { r: 59, g: 130, b: 246, a: 1 };
  }
  
  // Get the background color - use the alpha from the color if it has one
  const backgroundColor = $derived(() => {
    const parsed = parseColor(bgColor);
    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${parsed.a})`;
  });
  
  const selectedBgColor = $derived(() => {
    const parsed = parseColor(bgColor);
    const selectedAlpha = Math.min(parsed.a + 0.05, 1);
    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${selectedAlpha})`;
  });
  
  // Extract solid color for border (without alpha)
  const borderColor = $derived(() => {
    const parsed = parseColor(groupColor);
    return `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`;
  });
</script>

<NodeResizer 
  minWidth={200} 
  minHeight={150} 
  isVisible={selected}
  lineStyle="border-color: {borderColor()}"
  handleStyle="background: {borderColor()}; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="group-container"
  class:selected
  style="--group-color: {borderColor()}; --bg-color: {backgroundColor()}; --selected-bg-color: {selectedBgColor()}"
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
