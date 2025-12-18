<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { GroupNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Box, ChevronDown, ChevronRight } from 'lucide-svelte';

  type GroupNode = Node<GroupNodeData, 'group'>;

  let { data, selected, id }: NodeProps<GroupNode> = $props();

  function updateField(field: keyof GroupNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  // Toggle collapsed state
  function toggleCollapsed() {
    updateField('collapsed', !data.collapsed);
  }

  // Border styling
  const borderWidth = $derived((data.borderWidth as number) ?? 2);
  const borderStyle = $derived((data.borderStyle as string) ?? 'dashed');
  const borderRadius = $derived((data.borderRadius as number) ?? 8);
  const bgOpacity = $derived((data.bgOpacity as number) ?? 0.08);

  // Font styling
  const fontSize = $derived((data.fontSize as number) ?? 14);
  const fontWeight = $derived((data.fontWeight as string) ?? 'semibold');
  const fontStyle = $derived((data.fontStyle as string) ?? 'normal');
  const labelColor = $derived((data.labelColor as string) ?? data.textColor ?? '#c4b5fd');

  // Map font weight names to values
  const fontWeightValues: Record<string, number> = {
    'normal': 400,
    'medium': 500,
    'semibold': 600,
    'bold': 700,
  };

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
  
  const backgroundColor = $derived(hexToRgba(data.color || '#8b5cf6', bgOpacity));
  const headerBgColor = $derived(hexToRgba(data.color || '#8b5cf6', 0.15));
  
  // Count child nodes
  const childCount = $derived((data.childNodeIds?.length ?? 0));
</script>

<NodeResizer 
  minWidth={200} 
  minHeight={data.collapsed ? 50 : 150} 
  isVisible={selected ?? false}
  lineStyle="border-color: {data.color || '#8b5cf6'}"
  handleStyle="background: {data.color || '#8b5cf6'}; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="group-node"
  class:selected
  class:collapsed={data.collapsed}
  style="
    background: {backgroundColor};
    border-color: {data.borderColor || hexToRgba(data.color || '#8b5cf6', 0.4)};
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
  "
>
  <div 
    class="group-header"
    style="background: {headerBgColor}; border-radius: {borderRadius - 1}px {borderRadius - 1}px 0 0;"
  >
    <button class="collapse-btn nodrag" onclick={toggleCollapsed} title={data.collapsed ? 'Expand' : 'Collapse'}>
      {#if data.collapsed}
        <ChevronRight size={14} />
      {:else}
        <ChevronDown size={14} />
      {/if}
    </button>
    <span class="node-icon" style="color: {labelColor}"><Box size={14} strokeWidth={1.5} /></span>
    <input 
      type="text" 
      class="label-input nodrag"
      value={data.label || 'Group'}
      oninput={(e) => updateField('label', (e.target as HTMLInputElement).value)}
      placeholder="Group Label"
      style="
        color: {labelColor};
        font-size: {fontSize}px;
        font-weight: {fontWeightValues[fontWeight] || 600};
        font-style: {fontStyle};
      "
    />
    {#if childCount > 0}
      <span class="child-count" style="background: {hexToRgba(data.color || '#8b5cf6', 0.3)}; color: {labelColor};">
        {childCount}
      </span>
    {/if}
  </div>
  
  {#if !data.collapsed}
    <div class="group-content">
      {#if childCount === 0}
        <span class="hint" style="color: {hexToRgba(data.color || '#8b5cf6', 0.5)};">
          Select nodes and press Ctrl+G to group
        </span>
      {/if}
    </div>
  {/if}
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .group-node {
    min-width: 200px;
    min-height: 150px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
  }

  .group-node.collapsed {
    min-height: 40px;
    height: auto !important;
  }

  .group-node.selected {
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.5);
  }

  .group-header {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .collapse-btn {
    padding: 2px;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    border-radius: 3px;
  }

  .collapse-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .node-icon {
    display: flex;
    align-items: center;
  }

  .label-input {
    flex: 1;
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    outline: none;
    min-width: 0;
  }

  .label-input:focus {
    border-bottom-color: currentColor;
  }

  .child-count {
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 10px;
  }

  .group-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .hint {
    font-size: 11px;
    text-align: center;
  }
</style>
