<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { RouterNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Radio, Globe } from 'lucide-svelte';

  type RouterNode = Node<RouterNodeData, 'router'>;

  let { data, selected, id }: NodeProps<RouterNode> = $props();

  function updateField(field: keyof RouterNodeData, value: unknown) {
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
  minHeight={150} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="router-node"
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
    <span class="node-icon"><Radio size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  </div>
  
  <div class="node-content">
    <div class="router-icon">
      <span><Globe size={24} strokeWidth={1.5} /></span>
    </div>

    <div class="fields">
      <div class="field">
        <span class="label">Name</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.name || ''}
          oninput={(e) => updateField('name', (e.target as HTMLInputElement).value)}
          placeholder="Device name"
        />
      </div>
      <div class="field">
        <span class="label">IP Address</span>
        <input 
          type="text" 
          class="nodrag ip-input"
          value={data.ipAddress || ''}
          oninput={(e) => updateField('ipAddress', (e.target as HTMLInputElement).value)}
          placeholder="192.168.1.1"
        />
      </div>
      <div class="field">
        <span class="label">MAC Address</span>
        <input 
          type="text" 
          class="nodrag mac-input"
          value={data.macAddress || ''}
          oninput={(e) => updateField('macAddress', (e.target as HTMLInputElement).value)}
          placeholder="AA:BB:CC:DD:EE:FF"
        />
      </div>
      <div class="field-row">
        <div class="field">
          <span class="label">Manufacturer</span>
          <input 
            type="text" 
            class="nodrag"
            value={data.manufacturer || ''}
            oninput={(e) => updateField('manufacturer', (e.target as HTMLInputElement).value)}
            placeholder="Cisco, TP-Link..."
          />
        </div>
        <div class="field">
          <span class="label">Model</span>
          <input 
            type="text" 
            class="nodrag"
            value={data.model || ''}
            oninput={(e) => updateField('model', (e.target as HTMLInputElement).value)}
            placeholder="Model"
          />
        </div>
      </div>
    </div>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .router-node {
    min-width: 220px;
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

  .router-node.selected {
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

  .router-icon {
    display: flex;
    justify-content: center;
    padding: 8px;
  }

  .router-icon span {
    font-size: 32px;
    opacity: 0.7;
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

  .ip-input,
  .mac-input {
    font-family: 'Monaco', 'Consolas', monospace;
    color: #10b981;
  }
</style>
