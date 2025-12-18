<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { LinkListNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { List, Link, ExternalLink } from 'lucide-svelte';

  type LinkListNode = Node<LinkListNodeData, 'linkList'>;
  type LinkItem = { url: string; label: string; description?: string };

  let { data, selected, id }: NodeProps<LinkListNode> = $props();
  
  let links = $state<LinkItem[]>([]);
  
  $effect(() => {
    links = (data.links as LinkItem[]) || [];
  });

  function addLink() {
    links = [...links, { url: '', label: '', description: '' }];
    workspace.updateNodeData(id, { links });
  }

  function removeLink(index: number) {
    links = links.filter((_: LinkItem, i: number) => i !== index);
    workspace.updateNodeData(id, { links });
  }

  function updateLink(index: number, field: 'url' | 'label' | 'description', value: string) {
    links = links.map((link: LinkItem, i: number) => 
      i === index ? { ...link, [field]: value } : link
    );
    workspace.updateNodeData(id, { links });
  }

  function openLink(url: string) {
    if (url) {
      window.open(url, '_blank');
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
  minHeight={150} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="linklist-node"
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
    <span class="node-icon"><List size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    <button class="add-btn" onclick={addLink}>+ Add</button>
  </div>
  
  <div class="node-content">
    {#if links.length === 0}
      <div class="empty-state">
        <span class="empty-icon"><Link size={16} strokeWidth={1.5} /></span>
        <span>No links yet</span>
        <button class="add-link-btn" onclick={addLink}>Add Link</button>
      </div>
    {:else}
      <div class="links-list nowheel">
        {#each links as link, index}
          <div class="link-item">
            <div class="link-header">
              <input 
                type="text" 
                class="nodrag label-input"
                value={link.label}
                oninput={(e) => updateLink(index, 'label', (e.target as HTMLInputElement).value)}
                placeholder="Link label"
              />
              <button class="remove-btn" onclick={() => removeLink(index)}>×</button>
            </div>
            <div class="link-url">
              <input 
                type="url" 
                class="nodrag url-input"
                value={link.url}
                oninput={(e) => updateLink(index, 'url', (e.target as HTMLInputElement).value)}
                placeholder="https://..."
              />
              {#if link.url}
                <button class="open-btn" onclick={() => openLink(link.url)}><ExternalLink size={12} strokeWidth={1.5} /></button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .linklist-node {
    min-width: 250px;
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

  .linklist-node.selected {
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

  .add-btn {
    padding: 4px 8px;
    background: rgba(59, 130, 246, 0.2);
    border: none;
    border-radius: 4px;
    color: #3b82f6;
    font-size: 11px;
    cursor: pointer;
  }

  .add-btn:hover {
    background: rgba(59, 130, 246, 0.3);
  }

  .node-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #666;
  }

  .empty-icon {
    font-size: 24px;
    opacity: 0.5;
  }

  .add-link-btn {
    padding: 6px 12px;
    background: rgba(59, 130, 246, 0.2);
    border: none;
    border-radius: 4px;
    color: #3b82f6;
    font-size: 12px;
    cursor: pointer;
    margin-top: 8px;
  }

  .links-list {
    flex: 1;
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .link-item {
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #333;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .link-header {
    display: flex;
    gap: 8px;
  }

  .label-input {
    flex: 1;
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-bottom: 1px solid #444;
    color: #e0e0e0;
    font-size: 12px;
    font-weight: 500;
    outline: none;
  }

  .label-input:focus {
    border-bottom-color: #3b82f6;
  }

  .remove-btn {
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 14px;
  }

  .remove-btn:hover {
    color: #ef4444;
  }

  .link-url {
    display: flex;
    gap: 4px;
  }

  .url-input {
    flex: 1;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #60a5fa;
    font-size: 10px;
    outline: none;
  }

  .url-input:focus {
    border-color: #3b82f6;
  }

  .open-btn {
    background: transparent;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 12px;
  }
</style>
