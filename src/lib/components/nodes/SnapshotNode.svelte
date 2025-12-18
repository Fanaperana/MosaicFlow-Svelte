<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { SnapshotNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Camera, ExternalLink, History } from 'lucide-svelte';

  type SnapshotNode = Node<SnapshotNodeData, 'snapshot'>;

  let { data, selected, id }: NodeProps<SnapshotNode> = $props();

  function updateField(field: keyof SnapshotNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openUrl() {
    if (data.url) {
      window.open(data.url, '_blank');
    }
  }

  function openWayback() {
    if (data.url) {
      window.open(`https://web.archive.org/web/*/${data.url}`, '_blank');
    }
  }

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
</script>

<NodeResizer 
  minWidth={250} 
  minHeight={180} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="snapshot-node"
  class:selected
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
    <span class="node-icon"><Camera size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    {#if data.url}
      <button class="action-btn" onclick={openUrl} title="Open URL"><ExternalLink size={12} strokeWidth={1.5} /></button>
      <button class="action-btn" onclick={openWayback} title="Wayback Machine"><History size={12} strokeWidth={1.5} /></button>
    {/if}
  </div>
  
  <div class="node-content">
    <div class="preview-area">
      {#if data.screenshotPath}
        <img src={data.screenshotPath} alt="Page snapshot" />
      {:else}
        <div class="no-preview">
          <span class="preview-icon"><Camera size={24} strokeWidth={1.5} /></span>
          <span>No screenshot</span>
        </div>
      {/if}
    </div>

    <div class="fields">
      <div class="field">
        <span class="label">URL</span>
        <input 
          type="url" 
          class="nodrag"
          value={data.url || ''}
          oninput={(e) => updateField('url', (e.target as HTMLInputElement).value)}
          placeholder="https://..."
        />
      </div>
      {#if data.capturedAt}
        <div class="capture-info">
          Captured: {new Date(data.capturedAt).toLocaleString()}
        </div>
      {/if}
    </div>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .snapshot-node {
    min-width: 250px;
    min-height: 180px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .snapshot-node.selected {
    border-color: #3b82f6;
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

  .action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    font-size: 12px;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .node-content {
    padding: 12px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .preview-area {
    flex: 1;
    min-height: 80px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-area img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .no-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #666;
    font-size: 11px;
  }

  .preview-icon {
    font-size: 24px;
    opacity: 0.5;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font-size: 10px;
    text-transform: uppercase;
    color: #666;
    letter-spacing: 0.5px;
  }

  .field input {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
  }

  .field input:focus {
    border-color: #3b82f6;
  }

  .capture-info {
    font-size: 10px;
    color: #666;
    text-align: center;
  }
</style>
