<!--
  ImageNode - Content Category
  
  Display images with drag-and-drop, file picker, and URL input support.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { ImageNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Image, Camera, Upload, Link } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { NodeWrapper } from '../_shared';

  type ImageNodeType = Node<ImageNodeData, 'image'>;

  let { data, selected, id }: NodeProps<ImageNodeType> = $props();
  
  let isDraggingOver = $state(false);
  let showUrlInput = $state(false);
  let urlInputValue = $state('');

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
        const filePath = (file as unknown as { path?: string }).path;
        if (filePath) {
          const assetUrl = convertFileSrc(filePath);
          workspace.updateNodeData(id, { imageUrl: assetUrl });
        } else {
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
</script>

<NodeWrapper {data} {selected} {id} nodeType="image" class="image-node">
  {#snippet header()}
    <span class="node-icon"><Image size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="image-content"
    class:dragging-over={isDraggingOver}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
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
          <button type="button" class="action-btn nodrag" onclick={handlePickImage}>
            <Upload size={14} />
            <span>Upload</span>
          </button>
          
          <button type="button" class="action-btn nodrag" onclick={() => showUrlInput = !showUrlInput}>
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
            <button type="button" class="url-submit nodrag" onclick={handleUrlSubmit}>
              Add
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</NodeWrapper>

<style>
  .image-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .image-content.dragging-over {
    background: rgba(59, 130, 246, 0.1);
    border: 2px dashed #3b82f6;
    border-radius: 4px;
  }

  .image-content img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  .caption {
    margin-top: 8px;
    font-size: 11px;
    color: #888;
    text-align: center;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 100px;
    gap: 8px;
    color: #666;
  }

  .drop-icon {
    opacity: 0.5;
  }

  .drop-text {
    font-size: 12px;
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
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #555;
  }

  .url-input-wrapper {
    display: flex;
    gap: 4px;
    margin-top: 8px;
    width: 100%;
    max-width: 250px;
  }

  .url-input {
    flex: 1;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: inherit;
    font-size: 11px;
  }

  .url-submit {
    padding: 6px 12px;
    background: #3b82f6;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 11px;
    cursor: pointer;
  }

  .url-submit:hover {
    background: #2563eb;
  }
</style>
