<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { OrganizationNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Building2, Globe, ExternalLink } from 'lucide-svelte';

  type OrganizationNode = Node<OrganizationNodeData, 'organization'>;

  let { data, selected, id }: NodeProps<OrganizationNode> = $props();

  function updateField(field: keyof OrganizationNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openWebsite() {
    if (data.website) {
      let url = data.website;
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
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
  minWidth={220} 
  minHeight={160} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="org-node"
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
    <span class="node-icon"><Building2 size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  </div>
  
  <div class="node-content">
    <div class="org-header">
      <div class="logo">
        {#if data.logo}
          <img src={data.logo} alt={data.name} />
        {:else}
          <span class="logo-placeholder"><Building2 size={24} strokeWidth={1.5} /></span>
        {/if}
      </div>
      <div class="org-info">
        <input 
          type="text" 
          class="name-input nodrag"
          value={data.name || ''}
          oninput={(e) => updateField('name', (e.target as HTMLInputElement).value)}
          placeholder="Organization Name"
        />
        <input 
          type="text" 
          class="type-input nodrag"
          value={data.type || ''}
          oninput={(e) => updateField('type', (e.target as HTMLInputElement).value)}
          placeholder="Type (e.g., Corporation, NGO)"
        />
      </div>
    </div>

    <div class="fields">
      <div class="field">
        <span class="field-icon"><Globe size={12} strokeWidth={1.5} /></span>
        <input 
          type="text" 
          class="nodrag"
          value={data.website || ''}
          oninput={(e) => updateField('website', (e.target as HTMLInputElement).value)}
          placeholder="Website"
        />
        {#if data.website}
          <button class="link-btn" onclick={openWebsite}><ExternalLink size={12} strokeWidth={1.5} /></button>
        {/if}
      </div>
      <div class="field description">
        <textarea 
          class="nodrag nowheel"
          value={data.description || ''}
          oninput={(e) => updateField('description', (e.target as HTMLTextAreaElement).value)}
          placeholder="Description..."
        ></textarea>
      </div>
    </div>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .org-node {
    min-width: 220px;
    min-height: 160px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .org-node.selected {
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

  .node-content {
    padding: 12px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .org-header {
    display: flex;
    gap: 12px;
  }

  .logo {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .logo-placeholder {
    font-size: 24px;
    opacity: 0.5;
  }

  .org-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .name-input {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 600;
    outline: none;
  }

  .name-input:focus {
    border-color: #3b82f6;
  }

  .type-input {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #888;
    font-size: 11px;
    outline: none;
  }

  .type-input:focus {
    border-color: #3b82f6;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-icon {
    font-size: 12px;
    width: 20px;
    text-align: center;
  }

  .field input {
    flex: 1;
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

  .link-btn {
    background: transparent;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
  }

  .field.description {
    flex-direction: column;
  }

  .field textarea {
    width: 100%;
    min-height: 50px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
    resize: none;
    font-family: inherit;
  }

  .field textarea:focus {
    border-color: #3b82f6;
  }
</style>
