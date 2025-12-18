<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { HashNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Lock, Copy, Search } from 'lucide-svelte';

  type HashNode = Node<HashNodeData, 'hash'>;

  let { data, selected, id }: NodeProps<HashNode> = $props();

  function updateField(field: keyof HashNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function lookupVirusTotal() {
    if (data.hash) {
      window.open(`https://www.virustotal.com/gui/search/${data.hash}`, '_blank');
    }
  }

  function copyHash() {
    if (data.hash) {
      navigator.clipboard.writeText(data.hash);
    }
  }

  const threatColors: Record<string, string> = {
    unknown: '#888',
    safe: '#10b981',
    suspicious: '#f59e0b',
    malicious: '#ef4444',
  };

  const threatLabels: Record<string, string> = {
    unknown: 'Unknown',
    safe: 'Safe',
    suspicious: 'Suspicious',
    malicious: 'Malicious',
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
  minHeight={150} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="hash-node"
  class:selected
  style="
    --threat-color: {threatColors[data.threatLevel || 'unknown']};
    background: {backgroundColor};
    border-color: {data.borderColor || '#333'};
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
    color: {data.textColor || '#e0e0e0'};
  "
>
  <div class="node-header">
    <span class="node-icon"><Lock size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    <span class="threat-badge" style="background: {threatColors[data.threatLevel || 'unknown']}">
      {threatLabels[data.threatLevel || 'unknown']}
    </span>
  </div>
  
  <div class="node-content">
    <div class="hash-main">
      <input 
        type="text" 
        class="hash-input nodrag"
        value={data.hash || ''}
        oninput={(e) => updateField('hash', (e.target as HTMLInputElement).value)}
        placeholder="Enter hash..."
      />
      <div class="hash-actions">
        <button onclick={copyHash} title="Copy"><Copy size={14} strokeWidth={1.5} /></button>
        <button onclick={lookupVirusTotal} title="VirusTotal"><Search size={14} strokeWidth={1.5} /></button>
      </div>
    </div>

    <div class="fields">
      <div class="field-row">
        <div class="field">
          <span class="label">Algorithm</span>
          <select 
            class="nodrag"
            value={data.algorithm || 'sha256'}
            onchange={(e) => updateField('algorithm', (e.target as HTMLSelectElement).value)}
          >
            <option value="md5">MD5</option>
            <option value="sha1">SHA-1</option>
            <option value="sha256">SHA-256</option>
            <option value="sha512">SHA-512</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="field">
          <span class="label">Threat Level</span>
          <select 
            class="nodrag"
            value={data.threatLevel || 'unknown'}
            onchange={(e) => updateField('threatLevel', (e.target as HTMLSelectElement).value)}
          >
            <option value="unknown">Unknown</option>
            <option value="safe">Safe</option>
            <option value="suspicious">Suspicious</option>
            <option value="malicious">Malicious</option>
          </select>
        </div>
      </div>
      <div class="field">
        <span class="label">Filename</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.filename || ''}
          oninput={(e) => updateField('filename', (e.target as HTMLInputElement).value)}
          placeholder="Associated filename..."
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
  .hash-node {
    min-width: 280px;
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

  .hash-node.selected {
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

  .threat-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #fff;
  }

  .node-content {
    padding: 12px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .hash-main {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .hash-input {
    flex: 1;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #79c0ff;
    font-size: 11px;
    font-family: 'Monaco', 'Consolas', monospace;
    outline: none;
  }

  .hash-input:focus {
    border-color: #3b82f6;
  }

  .hash-actions {
    display: flex;
    gap: 4px;
  }

  .hash-actions button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .hash-actions button:hover {
    background: rgba(255, 255, 255, 0.1);
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

  .field input,
  .field select {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
  }

  .field input:focus,
  .field select:focus {
    border-color: #3b82f6;
  }
</style>
