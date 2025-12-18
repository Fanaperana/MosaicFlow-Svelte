<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { SocialPostNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { MessageSquare, ExternalLink } from 'lucide-svelte';

  type SocialPostNode = Node<SocialPostNodeData, 'socialPost'>;

  let { data, selected, id }: NodeProps<SocialPostNode> = $props();

  function updateField(field: keyof SocialPostNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openPost() {
    if (data.postUrl) {
      window.open(data.postUrl, '_blank');
    }
  }

  const platformColors: Record<string, string> = {
    twitter: '#1da1f2',
    x: '#000',
    facebook: '#1877f2',
    instagram: '#e4405f',
    linkedin: '#0077b5',
    tiktok: '#000',
    youtube: '#ff0000',
    reddit: '#ff4500',
    mastodon: '#6364ff',
    threads: '#000',
    bluesky: '#0085ff',
  };

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
  minWidth={280} 
  minHeight={180} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="social-node"
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
  <div class="node-header" style="border-left: 3px solid {platformColors[data.platform?.toLowerCase()] || '#3b82f6'}">
    <span class="node-icon"><MessageSquare size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    {#if data.postUrl}
      <button class="open-btn" onclick={openPost}><ExternalLink size={12} strokeWidth={1.5} /></button>
    {/if}
  </div>
  
  <div class="node-content">
    <div class="post-meta">
      <div class="field">
        <span class="label">Platform</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.platform || ''}
          oninput={(e) => updateField('platform', (e.target as HTMLInputElement).value)}
          placeholder="Twitter, Facebook, etc."
        />
      </div>
      <div class="field">
        <span class="label">Author</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.author || ''}
          oninput={(e) => updateField('author', (e.target as HTMLInputElement).value)}
          placeholder="@username"
        />
      </div>
    </div>

    <div class="post-content">
      <textarea 
        class="nodrag nowheel"
        value={data.content || ''}
        oninput={(e) => updateField('content', (e.target as HTMLTextAreaElement).value)}
        placeholder="Post content..."
      ></textarea>
    </div>

    <div class="post-footer">
      <div class="field">
        <span class="label">Post URL</span>
        <input 
          type="url" 
          class="nodrag"
          value={data.postUrl || ''}
          oninput={(e) => updateField('postUrl', (e.target as HTMLInputElement).value)}
          placeholder="https://..."
        />
      </div>
      {#if data.timestamp}
        <span class="timestamp">{new Date(data.timestamp).toLocaleString()}</span>
      {/if}
    </div>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .social-node {
    min-width: 280px;
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

  .social-node.selected {
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

  .open-btn {
    background: transparent;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
  }

  .open-btn:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .node-content {
    padding: 12px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .post-meta {
    display: flex;
    gap: 12px;
  }

  .post-meta .field {
    flex: 1;
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

  .post-content {
    flex: 1;
    min-height: 60px;
  }

  .post-content textarea {
    width: 100%;
    height: 100%;
    min-height: 60px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #333;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 12px;
    line-height: 1.5;
    outline: none;
    resize: none;
    font-family: inherit;
  }

  .post-content textarea:focus {
    border-color: #3b82f6;
  }

  .post-footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .timestamp {
    font-size: 10px;
    color: #666;
  }
</style>
