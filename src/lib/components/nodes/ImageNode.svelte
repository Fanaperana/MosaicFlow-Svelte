<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { ImageNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Image, Camera } from 'lucide-svelte';

  type ImageNode = Node<ImageNodeData, 'image'>;

  let { data, selected, id }: NodeProps<ImageNode> = $props();
  
  let isDraggingOver = $state(false);

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
  const backgroundColor = $derived(hexToRgba(data.color || '#1a1d21', bgOpacity));

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = true;
  }

  function handleDragLeave() {
    isDraggingOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = false;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          workspace.updateNodeData(id, { imageUrl });
        };
        reader.readAsDataURL(file);
      }
    }
  }

  function handleUrlInput(e: Event) {
    const target = e.target as HTMLInputElement;
    workspace.updateNodeData(id, { imageUrl: target.value });
  }
</script>

<NodeResizer 
  minWidth={150} 
  minHeight={150} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="image-node"
  class:selected
  class:dragging-over={isDraggingOver}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="img"
  style="
    background: {backgroundColor};
    border-color: {data.borderColor || '#333'};
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
    color: {data.textColor || '#e0e0e0'};
  "
>
  <div class="node-header">
    <span class="node-icon"><Image size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  </div>
  
  <div class="node-content">
    {#if data.imageUrl}
      <img src={data.imageUrl} alt={data.caption || data.title} />
      {#if data.caption}
        <div class="caption">{data.caption}</div>
      {/if}
    {:else}
      <div class="drop-zone">
        <div class="drop-icon"><Camera size={32} strokeWidth={1.5} /></div>
        <div class="drop-text">Drop image here</div>
        <div class="drop-or">or</div>
        <input 
          type="text" 
          class="url-input nodrag"
          placeholder="Paste image URL..."
          onchange={handleUrlInput}
        />
      </div>
    {/if}
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .image-node {
    min-width: 150px;
    min-height: 150px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .image-node.selected {
    border-color: #3b82f6;
  }

  .image-node.dragging-over {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .node-header {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .node-icon {
    font-size: 14px;
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
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    flex: 1;
  }

  .caption {
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    font-size: 11px;
    text-align: center;
    color: #aaa;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    height: 100%;
    text-align: center;
  }

  .drop-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .drop-text {
    font-size: 12px;
    color: #888;
  }

  .drop-or {
    font-size: 10px;
    color: #555;
    margin: 8px 0;
  }

  .url-input {
    width: 90%;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
  }

  .url-input:focus {
    border-color: #3b82f6;
  }
</style>
