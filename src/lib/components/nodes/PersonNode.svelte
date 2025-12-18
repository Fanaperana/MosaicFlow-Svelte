<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { PersonNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { User, Mail, Phone, Building2, Briefcase } from 'lucide-svelte';

  type PersonNode = Node<PersonNodeData, 'person'>;

  let { data, selected, id }: NodeProps<PersonNode> = $props();

  function updateField(field: keyof PersonNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
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
  minHeight={180} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="person-node"
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
    <span class="node-icon"><User size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  </div>
  
  <div class="node-content">
    <div class="avatar-section">
      <div class="avatar">
        {#if data.avatar}
          <img src={data.avatar} alt={data.name} />
        {:else}
          <span class="avatar-placeholder">
            {data.name ? data.name.charAt(0).toUpperCase() : '?'}
          </span>
        {/if}
      </div>
      <input 
        type="text" 
        class="name-input nodrag"
        value={data.name || ''}
        oninput={(e) => updateField('name', (e.target as HTMLInputElement).value)}
        placeholder="Name"
      />
    </div>

    <div class="fields">
      <div class="field">
        <span class="field-icon"><Mail size={12} strokeWidth={1.5} /></span>
        <input 
          type="email" 
          class="nodrag"
          value={data.email || ''}
          oninput={(e) => updateField('email', (e.target as HTMLInputElement).value)}
          placeholder="Email"
        />
      </div>
      <div class="field">
        <span class="field-icon"><Phone size={12} strokeWidth={1.5} /></span>
        <input 
          type="tel" 
          class="nodrag"
          value={data.phone || ''}
          oninput={(e) => updateField('phone', (e.target as HTMLInputElement).value)}
          placeholder="Phone"
        />
      </div>
      <div class="field">
        <span class="field-icon"><Building2 size={12} strokeWidth={1.5} /></span>
        <input 
          type="text" 
          class="nodrag"
          value={data.organization || ''}
          oninput={(e) => updateField('organization', (e.target as HTMLInputElement).value)}
          placeholder="Organization"
        />
      </div>
      <div class="field">
        <span class="field-icon"><Briefcase size={12} strokeWidth={1.5} /></span>
        <input 
          type="text" 
          class="nodrag"
          value={data.role || ''}
          oninput={(e) => updateField('role', (e.target as HTMLInputElement).value)}
          placeholder="Role"
        />
      </div>
    </div>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .person-node {
    min-width: 220px;
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

  .person-node.selected {
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

  .avatar-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    font-size: 20px;
    font-weight: bold;
    color: white;
  }

  .name-input {
    flex: 1;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 14px;
    font-weight: 600;
    outline: none;
  }

  .name-input:focus {
    border-color: #3b82f6;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
</style>
