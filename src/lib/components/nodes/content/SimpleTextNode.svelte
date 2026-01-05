<!--
  SimpleTextNode - Content Category
  
  A minimal plain text node without markdown or rich formatting.
-->
<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { SimpleTextNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Type } from 'lucide-svelte';
  import { hexToRgba } from '../_shared/utils';
  import { NodeFloatingToolbar } from '../_shared';

  type SimpleTextNodeType = Node<SimpleTextNodeData, 'simpleText'>;

  let { data, selected, id }: NodeProps<SimpleTextNodeType> = $props();
  
  let content = $state('');
  
  // Check if node is locked
  const isLocked = $derived(data.locked ?? false);

  // Border styling
  const borderWidth = $derived((data.borderWidth as number) ?? 0);
  const borderStyle = $derived((data.borderStyle as string) ?? 'none');
  const borderRadius = $derived((data.borderRadius as number) ?? 2);
  const bgOpacity = $derived((data.bgOpacity as number) ?? 0);
  
  $effect(() => {
    content = data.content || '';
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    content = target.value;
    workspace.updateNodeData(id, { content: target.value });
  }

  const nodeColor = $derived(data.color || '#1a1d21');
  const textColor = $derived(data.textColor || '#e4e4e7');
  const backgroundColor = $derived(hexToRgba(nodeColor, bgOpacity));

  function handleColorChange(newColor: string) {
    workspace.updateNodeData(id, { color: newColor });
  }
</script>

<NodeFloatingToolbar 
  nodeId={id} 
  selected={selected ?? false} 
  color={nodeColor}
  bgOpacity={bgOpacity}
  onColorChange={handleColorChange}
  onBgOpacityChange={(opacity) => workspace.updateNodeData(id, { bgOpacity: opacity })}
/>

{#if !isLocked}
  <NodeResizer 
    minWidth={60} 
    minHeight={24}
    isVisible={selected}
  />
{/if}

<Handle type="target" position={Position.Left} class="handle-style" />
<Handle type="source" position={Position.Right} class="handle-style" />

<div 
  class="simple-text-node"
  class:selected
  style:background-color={backgroundColor}
  style:border-width="{borderWidth}px"
  style:border-style={borderStyle}
  style:border-color={data.borderColor || '#27272a'}
  style:border-radius="{borderRadius}px"
>
  <textarea
    class="text-content"
    value={content}
    oninput={handleInput}
    placeholder="Type here..."
    disabled={isLocked}
    style:color={textColor}
  ></textarea>
</div>

<style>
  .simple-text-node {
    width: 100%;
    height: 100%;
    min-width: 60px;
    min-height: 24px;
    display: flex;
  }

  .simple-text-node.selected {
    outline: 1px solid rgba(99, 102, 241, 0.5);
    outline-offset: 1px;
  }

  .text-content {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.4;
    padding: 4px 6px;
  }

  .text-content::placeholder {
    color: #52525b;
    opacity: 0.7;
  }

  .text-content:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  :global(.handle-style) {
    width: 8px;
    height: 8px;
    background: #3f3f46;
    border: 1px solid #52525b;
  }

  :global(.handle-style:hover) {
    background: #6366f1;
    border-color: #818cf8;
  }
</style>
