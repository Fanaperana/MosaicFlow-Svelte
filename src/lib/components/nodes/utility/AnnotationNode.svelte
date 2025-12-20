<!--
  AnnotationNode - Visual Annotation/Callout
  
  A lightweight annotation node inspired by xyflow's AnnotationNode.
  - No background, just text
  - Font size scales with node size
  - Customizable arrow position
  - Cannot be linked to other nodes (no handles)
-->
<script lang="ts">
  import { type NodeProps, type Node, NodeResizer } from '@xyflow/svelte';
  import type { AnnotationNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';

  type AnnotationNodeType = Node<AnnotationNodeData, 'annotation'>;

  let { data, selected, id, width, height }: NodeProps<AnnotationNodeType> = $props();
  
  let isEditing = $state(false);
  let labelText = $state('');
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  
  $effect(() => {
    labelText = data.label || 'Double-click to edit...';
  });

  // Calculate font size based on node dimensions
  const calculatedFontSize = $derived(() => {
    const w = width || 200;
    const h = height || 100;
    // Base the font size on the smaller dimension to ensure text fits
    const minDim = Math.min(w, h);
    // Scale factor: starts at 14px for 100px and grows proportionally
    const baseFontSize = data.fontSize || Math.max(12, Math.min(48, minDim / 5));
    return baseFontSize;
  });

  // Arrow symbols for different positions
  const arrowSymbols: Record<string, string> = {
    'top-left': '↖',
    'top-right': '↗',
    'bottom-left': '↙',
    'bottom-right': '↘',
    'left': '←',
    'right': '→',
    'none': '',
  };

  const arrowPosition = $derived(data.arrowPosition || 'bottom-left');
  const arrowSymbol = $derived(data.arrow || arrowSymbols[arrowPosition] || '⤹');
  
  // Arrow transform (rotation and flip)
  const arrowTransform = $derived(() => {
    const transforms: string[] = [];
    if (data.arrowRotation) {
      transforms.push(`rotate(${data.arrowRotation}deg)`);
    }
    if (data.arrowFlipX) {
      transforms.push('scaleX(-1)');
    }
    if (data.arrowFlipY) {
      transforms.push('scaleY(-1)');
    }
    return transforms.length > 0 ? transforms.join(' ') : 'none';
  });

  function handleDoubleClick() {
    isEditing = true;
    setTimeout(() => textareaRef?.focus(), 0);
  }

  function handleBlur() {
    isEditing = false;
    if (labelText.trim() !== data.label) {
      workspace.updateNodeData(id, { label: labelText.trim() || 'Annotation' });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isEditing = false;
      labelText = data.label || '';
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    labelText = target.value;
  }
</script>

<div 
  class="annotation-node"
  class:selected
  class:editing={isEditing}
  style="
    --font-size: {calculatedFontSize()}px;
    --font-weight: {data.fontWeight || '400'};
    --font-style: {data.fontStyle || 'normal'};
    --text-color: {data.textColor || '#999'};
    --text-align: {data.textAlign || 'left'};
  "
  ondblclick={handleDoubleClick}
  role="button"
  tabindex="0"
>
  <NodeResizer 
    minWidth={80} 
    minHeight={40}
    isVisible={selected ?? false}
    lineStyle="border-color: rgba(59, 130, 246, 0.5); border-style: dashed;"
    handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
  />
  
  <div class="annotation-content">
    {#if isEditing}
      <textarea
        bind:this={textareaRef}
        class="annotation-input nodrag nowheel"
        value={labelText}
        oninput={handleInput}
        onblur={handleBlur}
        onkeydown={handleKeydown}
        placeholder="Enter annotation text..."
      ></textarea>
    {:else}
      <div class="annotation-label">{labelText}</div>
    {/if}
  </div>

  {#if arrowPosition !== 'none' && arrowSymbol}
    <div 
      class="annotation-arrow" 
      class:top-left={arrowPosition === 'top-left'}
      class:top-right={arrowPosition === 'top-right'}
      class:bottom-left={arrowPosition === 'bottom-left'}
      class:bottom-right={arrowPosition === 'bottom-right'}
      class:left={arrowPosition === 'left'}
      class:right={arrowPosition === 'right'}
      style="{data.arrowStyle || ''}; transform: {arrowTransform()};"
    >
      {arrowSymbol}
    </div>
  {/if}
</div>

<style>
  .annotation-node {
    position: relative;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    cursor: default;
    user-select: none;
    padding: 8px;
    box-sizing: border-box;
  }

  .annotation-node.selected {
    outline: 2px dashed rgba(59, 130, 246, 0.5);
    outline-offset: 2px;
  }

  .annotation-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .annotation-label {
    font-size: var(--font-size);
    font-weight: var(--font-weight);
    font-style: var(--font-style);
    color: var(--text-color);
    text-align: var(--text-align);
    line-height: 1.3;
    white-space: pre-wrap;
    word-break: break-word;
    width: 100%;
  }

  .annotation-input {
    width: 100%;
    height: 100%;
    font-size: var(--font-size);
    font-weight: var(--font-weight);
    font-style: var(--font-style);
    color: var(--text-color);
    text-align: var(--text-align);
    line-height: 1.3;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.5);
    border-radius: 4px;
    padding: 4px;
    resize: none;
    outline: none;
    font-family: inherit;
  }

  .annotation-input::placeholder {
    color: #555;
  }

  .annotation-arrow {
    position: absolute;
    font-size: calc(var(--font-size) * 1.5);
    color: var(--text-color);
    line-height: 1;
    opacity: 0.7;
  }

  .annotation-arrow.top-left {
    top: -0.5em;
    left: -0.5em;
  }

  .annotation-arrow.top-right {
    top: -0.5em;
    right: -0.5em;
  }

  .annotation-arrow.bottom-left {
    bottom: -0.5em;
    left: -0.5em;
  }

  .annotation-arrow.bottom-right {
    bottom: -0.5em;
    right: -0.5em;
  }

  .annotation-arrow.left {
    top: 50%;
    left: -1em;
    transform: translateY(-50%);
  }

  .annotation-arrow.right {
    top: 50%;
    right: -1em;
    transform: translateY(-50%);
  }

  /* Selection state from svelte-flow */
  :global(.svelte-flow__node.selected .annotation-node) {
    outline: 2px dashed rgba(59, 130, 246, 0.5);
    outline-offset: 2px;
  }
</style>
