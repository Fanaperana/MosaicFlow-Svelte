<!--
  GroupNode - Utility Category
  
  Visual container for grouping nodes.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { GroupNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Folder, Palette } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type GroupNodeType = Node<GroupNodeData, 'group'>;

  let { data, selected, id }: NodeProps<GroupNodeType> = $props();

  const presetColors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];

  function updateField(field: keyof GroupNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function setColor(color: string) {
    workspace.updateNodeData(id, { groupColor: color });
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="group" class="group-node">
  {#snippet header()}
    <span class="node-icon"><Folder size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.label || data.title}</span>
  {/snippet}
  
  <NodeField 
    label="Group Label"
    value={data.label || ''}
    placeholder="Enter group name..."
    oninput={(v) => updateField('label', v)}
  />
  
  <div class="color-section">
    <span class="section-label">
      <Palette size={12} />
      Color
    </span>
    <div class="color-presets">
      {#each presetColors as color}
        <button
          class="color-btn nodrag"
          class:selected={data.groupColor === color}
          style="background: {color}"
          onclick={() => setColor(color)}
          title={color}
        ></button>
      {/each}
    </div>
  </div>
  
  {#if data.description}
    <div class="group-description">{data.description}</div>
  {/if}
  
  <div class="group-hint">
    Resize and position this node to contain other nodes
  </div>
</NodeWrapper>

<style>
  .color-section {
    margin-top: 8px;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #888;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .color-presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .color-btn {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .color-btn:hover {
    transform: scale(1.1);
  }

  .color-btn.selected {
    border-color: white;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
  }

  .group-description {
    margin-top: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 11px;
    color: #999;
  }

  .group-hint {
    margin-top: 12px;
    padding: 8px;
    background: rgba(59, 130, 246, 0.05);
    border: 1px dashed rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    font-size: 10px;
    color: #666;
    text-align: center;
  }
</style>
