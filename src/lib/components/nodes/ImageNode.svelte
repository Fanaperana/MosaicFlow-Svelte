<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { ImageNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Image, Camera, Upload, Link } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { convertFileSrc } from '@tauri-apps/api/core';

  type ImageNode = Node<ImageNodeData, 'image'>;

  let { data, selected, id }: NodeProps<ImageNode> = $props();
  
  let isDraggingOver = $state(false);
  let showUrlInput = $state(false);
  let urlInputValue = $state('');

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
        // Check for Tauri file path
        const filePath = (file as any).path;
        if (filePath) {
          // Convert local path to asset URL for Tauri
          const assetUrl = convertFileSrc(filePath);
          workspace.updateNodeData(id, { imageUrl: assetUrl });
        } else {
          // Fallback: read as data URL for browser-based drops
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageUrl = event.target?.result as string;
            workspace.updateNodeData(id, { imageUrl });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  async function handlePickImage() {
    try {
      const file = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
        }]
      });
      if (file) {
        const assetUrl = convertFileSrc(file as string);
        workspace.updateNodeData(id, { imageUrl: assetUrl });
      }
    } catch (err) {
      console.error('Failed to pick image:', err);
    }
  }

  function handleUrlSubmit() {
    if (urlInputValue.trim()) {
      workspace.updateNodeData(id, { imageUrl: urlInputValue.trim() });
      showUrlInput = false;
      urlInputValue = '';
    }
  }

  function handleUrlKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleUrlSubmit();
    } else if (e.key === 'Escape') {
      showUrlInput = false;
      urlInputValue = '';
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
        
        <div class="drop-actions">
          <button 
            type="button" 
            class="action-btn nodrag" 
            onclick={handlePickImage}
          >
            <Upload size={14} />
            <span>Upload</span>
          </button>
          
          <button 
            type="button" 
            class="action-btn nodrag" 
            onclick={() => showUrlInput = !showUrlInput}
          >
            <Link size={14} />
            <span>URL</span>
          </button>
        </div>
        
        {#if showUrlInput}
          <div class="url-input-wrapper">
            <input 
              type="text" 
              class="url-input nodrag"
              placeholder="https://example.com/image.png"
              bind:value={urlInputValue}
              onkeydown={handleUrlKeydown}
            />
            <button 
              type="button" 
              class="url-submit nodrag" 
              onclick={handleUrlSubmit}
            >
              Add
            </button>
          </div>
        {/if}
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
    gap: 8px;
  }

  .drop-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .drop-text {
    font-size: 12px;
    color: #888;
  }

  .drop-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .action-btn:active {
    background: rgba(255, 255, 255, 0.15);
  }

  .url-input-wrapper {
    display: flex;
    gap: 6px;
    width: 100%;
    max-width: 280px;
    margin-top: 8px;
  }

  .url-input {
    flex: 1;
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

  .url-submit {
    padding: 6px 12px;
    background: #3b82f6;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .url-submit:hover {
    background: #2563eb;
  }
</style>
