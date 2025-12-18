<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { DomainNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Globe, Search, ExternalLink } from 'lucide-svelte';

  type DomainNode = Node<DomainNodeData, 'domain'>;

  let { data, selected, id }: NodeProps<DomainNode> = $props();

  function updateField(field: keyof DomainNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openDomain() {
    if (data.domain) {
      let url = data.domain;
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      window.open(url, '_blank');
    }
  }

  function lookupWhois() {
    if (data.domain) {
      window.open(`https://who.is/whois/${data.domain}`, '_blank');
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
  minWidth={240} 
  minHeight={180} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="domain-node"
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
    <span class="node-icon"><Globe size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    <button class="action-btn" onclick={lookupWhois} title="WHOIS Lookup"><Search size={14} strokeWidth={1.5} /></button>
  </div>
  
  <div class="node-content">
    <div class="domain-main">
      <input 
        type="text" 
        class="domain-input nodrag"
        value={data.domain || ''}
        oninput={(e) => updateField('domain', (e.target as HTMLInputElement).value)}
        placeholder="example.com"
      />
      {#if data.domain}
        <button class="open-btn" onclick={openDomain}><ExternalLink size={14} strokeWidth={1.5} /></button>
      {/if}
    </div>

    <div class="fields">
      <div class="field">
        <span class="label">Registrar</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.registrar || ''}
          oninput={(e) => updateField('registrar', (e.target as HTMLInputElement).value)}
          placeholder="Registrar"
        />
      </div>
      <div class="field-row">
        <div class="field">
          <span class="label">Created</span>
          <input 
            type="date" 
            class="nodrag"
            value={data.createdDate || ''}
            oninput={(e) => updateField('createdDate', (e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="field">
          <span class="label">Expires</span>
          <input 
            type="date" 
            class="nodrag"
            value={data.expiryDate || ''}
            oninput={(e) => updateField('expiryDate', (e.target as HTMLInputElement).value)}
          />
        </div>
      </div>
      {#if data.ipAddresses && data.ipAddresses.length > 0}
        <div class="ip-list">
          <span class="label">IPs</span>
          <div class="ips">
            {#each data.ipAddresses as ip}
              <span class="ip-tag">{ip}</span>
            {/each}
          </div>
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
  .domain-node {
    min-width: 240px;
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

  .domain-node.selected {
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
    padding: 4px 6px;
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

  .domain-main {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .domain-input {
    flex: 1;
    padding: 8px 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid #3b82f6;
    border-radius: 4px;
    color: #60a5fa;
    font-size: 14px;
    font-weight: 600;
    outline: none;
  }

  .domain-input:focus {
    background: rgba(59, 130, 246, 0.15);
  }

  .open-btn {
    background: transparent;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    padding: 4px 8px;
    font-size: 14px;
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

  .field-row {
    display: flex;
    gap: 12px;
  }

  .field-row .field {
    flex: 1;
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

  .ip-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ip-tag {
    padding: 2px 8px;
    background: rgba(16, 185, 129, 0.15);
    border-radius: 4px;
    font-size: 10px;
    color: #10b981;
    font-family: 'Monaco', 'Consolas', monospace;
  }
</style>
