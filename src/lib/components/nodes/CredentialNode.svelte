<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { CredentialNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { KeyRound, AlertTriangle, Search } from 'lucide-svelte';

  type CredentialNode = Node<CredentialNodeData, 'credential'>;

  let { data, selected, id }: NodeProps<CredentialNode> = $props();

  function updateField(field: keyof CredentialNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function lookupHIBP() {
    if (data.email) {
      window.open(`https://haveibeenpwned.com/account/${data.email}`, '_blank');
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
  minHeight={140} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="credential-node"
  class:selected
  class:breached={data.breached}
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
    <span class="node-icon"><KeyRound size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    {#if data.breached}
      <span class="breach-badge"><AlertTriangle size={12} strokeWidth={1.5} /> BREACHED</span>
    {/if}
  </div>
  
  <div class="node-content">
    <div class="fields">
      <div class="field">
        <span class="label">Username</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.username || ''}
          oninput={(e) => updateField('username', (e.target as HTMLInputElement).value)}
          placeholder="Username"
        />
      </div>
      <div class="field">
        <span class="label">Email</span>
        <div class="email-row">
          <input 
            type="email" 
            class="nodrag"
            value={data.email || ''}
            oninput={(e) => updateField('email', (e.target as HTMLInputElement).value)}
            placeholder="Email"
          />
          {#if data.email}
            <button class="hibp-btn" onclick={lookupHIBP} title="Check HIBP"><Search size={14} strokeWidth={1.5} /></button>
          {/if}
        </div>
      </div>
      <div class="field">
        <span class="label">Platform</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.platform || ''}
          oninput={(e) => updateField('platform', (e.target as HTMLInputElement).value)}
          placeholder="Platform/Service"
        />
      </div>
      <div class="field">
        <span class="label">Source</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.source || ''}
          oninput={(e) => updateField('source', (e.target as HTMLInputElement).value)}
          placeholder="Data source"
        />
      </div>
      <div class="field checkbox">
        <label>
          <input 
            type="checkbox" 
            class="nodrag"
            checked={data.breached || false}
            onchange={(e) => updateField('breached', (e.target as HTMLInputElement).checked)}
          />
          <span>Breached</span>
        </label>
      </div>
    </div>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .credential-node {
    min-width: 220px;
    min-height: 140px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .credential-node.selected {
    border-color: #3b82f6;
  }

  .credential-node.breached {
    border-color: #ef4444;
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

  .breach-badge {
    padding: 2px 6px;
    background: rgba(239, 68, 68, 0.2);
    border-radius: 4px;
    font-size: 9px;
    font-weight: 600;
    color: #ef4444;
  }

  .node-content {
    padding: 12px;
    flex: 1;
    overflow: auto;
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

  .field input[type="text"],
  .field input[type="email"] {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
    flex: 1;
  }

  .field input:focus {
    border-color: #3b82f6;
  }

  .email-row {
    display: flex;
    gap: 4px;
  }

  .hibp-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .hibp-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .field.checkbox label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 11px;
  }

  .field.checkbox input {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
</style>
