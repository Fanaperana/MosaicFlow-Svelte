<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
  import type { BaseNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';

  interface AnnotationNodeData extends BaseNodeData {
    label: string;
    arrow?: string;
  }

  type AnnotationNode = Node<AnnotationNodeData, 'annotation'>;

  let { data, selected, id }: NodeProps<AnnotationNode> = $props();

  function updateField(field: keyof AnnotationNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  const fontSize = $derived((data.fontSize as number) ?? 24);
  const fontWeight = $derived((data.fontWeight as string) ?? 'normal');
  const color = $derived((data.color as string) ?? '#c4b5fd');
</script>

<div 
  class="annotation-node"
  class:selected
  style="
    color: {color};
    font-size: {fontSize}px;
    font-weight: {fontWeight};
    min-width: 100px;
    max-width: 400px;
  "
>
  <div class="annotation-content">
    {#if data.arrow}
      <div class="annotation-arrow">{data.arrow}</div>
    {/if}
    <textarea
      class="annotation-input nodrag"
      value={data.label || 'Annotation'}
      oninput={(e) => updateField('label', (e.target as HTMLTextAreaElement).value)}
      placeholder="Annotation..."
      rows="1"
      style="color: {color};"
    ></textarea>
  </div>
  
  <!-- Hidden handles for connections if needed -->
  <Handle type="target" position={Position.Top} style="opacity: 0;" />
  <Handle type="source" position={Position.Bottom} style="opacity: 0;" />
</div>

<style>
  .annotation-node {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .annotation-node.selected {
    outline: 1px dashed rgba(255, 255, 255, 0.3);
  }

  .annotation-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
  }

  .annotation-arrow {
    font-size: 1.2em;
    line-height: 1;
    margin-top: 2px;
  }

  .annotation-input {
    background: transparent;
    border: none;
    outline: none;
    width: 100%;
    resize: none;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: 1.4;
    overflow: hidden;
    min-height: 1.4em;
  }
  
  .annotation-input::placeholder {
    opacity: 0.5;
    color: inherit;
  }
</style>