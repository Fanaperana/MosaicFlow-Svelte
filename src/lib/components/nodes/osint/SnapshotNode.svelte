<!--
  SnapshotNode - OSINT Category
  
  Evidence screenshot/capture reference.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { SnapshotNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Camera, Calendar, Download, ExternalLink, Link } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { NodeWrapper, NodeField } from '../_shared';

  type SnapshotNodeType = Node<SnapshotNodeData, 'snapshot'>;

  let { data, selected, id }: NodeProps<SnapshotNodeType> = $props();

  function updateField(field: keyof SnapshotNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  async function pickImage() {
    try {
      const file = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
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

  function openSource() {
    if (data.sourceUrl) {
      window.open(data.sourceUrl, '_blank');
    }
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="snapshot" class="snapshot-node">
  {#snippet header()}
    <span class="node-icon"><Camera size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    {#if data.sourceUrl}
      <button class="node-action-btn" onclick={openSource} title="Open source">
        <ExternalLink size={14} strokeWidth={1.5} />
      </button>
    {/if}
  {/snippet}
  
  <div class="snapshot-image">
    {#if data.imageUrl}
      <img src={data.imageUrl} alt={data.title} />
    {:else}
      <button class="upload-btn nodrag" onclick={pickImage}>
        <Camera size={24} />
        <span>Upload Screenshot</span>
      </button>
    {/if}
  </div>
  
  {#if data.timestamp}
    <div class="snapshot-meta">
      <Calendar size={11} />
      <span>Captured: {data.timestamp}</span>
    </div>
  {/if}
  
  <NodeField 
    label="Source URL"
    type="url"
    value={data.sourceUrl || ''}
    placeholder="https://..."
    oninput={(v) => updateField('sourceUrl', v)}
  />
  
  {#if data.hash}
    <div class="snapshot-hash">
      <span class="label">SHA256:</span>
      <span class="value">{data.hash}</span>
    </div>
  {/if}
  
  {#if data.notes}
    <div class="snapshot-notes">{data.notes}</div>
  {/if}
</NodeWrapper>

<style>
  .snapshot-image {
    min-height: 100px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .snapshot-image img {
    width: 100%;
    height: auto;
    object-fit: contain;
  }

  .upload-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px;
    background: transparent;
    border: 2px dashed #444;
    border-radius: 4px;
    color: #666;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
    height: 100%;
  }

  .upload-btn:hover {
    border-color: #555;
    color: #888;
  }

  .snapshot-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #666;
    margin-bottom: 8px;
  }

  .snapshot-hash {
    margin-top: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    font-size: 10px;
    font-family: monospace;
  }

  .snapshot-hash .label {
    color: #666;
  }

  .snapshot-hash .value {
    color: #888;
    word-break: break-all;
  }

  .snapshot-notes {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 11px;
    color: #999;
    line-height: 1.4;
  }
</style>
