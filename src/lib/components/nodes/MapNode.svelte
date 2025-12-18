<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { MapNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { MapPin, Map, Globe } from 'lucide-svelte';

  type MapNode = Node<MapNodeData, 'map'>;

  let { data, selected, id }: NodeProps<MapNode> = $props();

  function updateField(field: keyof MapNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openInMaps() {
    if (data.latitude && data.longitude) {
      window.open(`https://www.google.com/maps?q=${data.latitude},${data.longitude}`, '_blank');
    }
  }

  function openOSM() {
    if (data.latitude && data.longitude) {
      window.open(`https://www.openstreetmap.org/?mlat=${data.latitude}&mlon=${data.longitude}&zoom=${data.zoom || 15}`, '_blank');
    }
  }

  const hasCoords = $derived(data.latitude !== undefined && data.longitude !== undefined && 
                             data.latitude !== 0 && data.longitude !== 0);

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
  class="map-node"
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
    <span class="node-icon"><Map size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    {#if hasCoords}
      <button class="action-btn" onclick={openInMaps} title="Open in Google Maps"><Map size={12} strokeWidth={1.5} /></button>
      <button class="action-btn" onclick={openOSM} title="Open in OpenStreetMap"><Globe size={12} strokeWidth={1.5} /></button>
    {/if}
  </div>
  
  <div class="node-content">
    <div class="map-preview">
      {#if hasCoords}
        <img 
          src="https://static-maps.yandex.ru/1.x/?ll={data.longitude},{data.latitude}&z={data.zoom || 12}&size=400,200&l=map"
          alt="Map preview"
          onerror={(e) => (e.target as HTMLImageElement).style.display = 'none'}
        />
        <div class="coords-display">
          <MapPin size={12} strokeWidth={1.5} /> {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
        </div>
      {:else}
        <div class="no-coords">
          <span class="icon"><MapPin size={16} strokeWidth={1.5} /></span>
          <span>Enter coordinates below</span>
        </div>
      {/if}
    </div>

    <div class="fields">
      <div class="field-row">
        <div class="field">
          <span class="label">Latitude</span>
          <input 
            type="number" 
            step="any"
            class="nodrag"
            value={data.latitude || 0}
            oninput={(e) => updateField('latitude', parseFloat((e.target as HTMLInputElement).value) || 0)}
            placeholder="Lat"
          />
        </div>
        <div class="field">
          <span class="label">Longitude</span>
          <input 
            type="number" 
            step="any"
            class="nodrag"
            value={data.longitude || 0}
            oninput={(e) => updateField('longitude', parseFloat((e.target as HTMLInputElement).value) || 0)}
            placeholder="Lng"
          />
        </div>
      </div>
      <div class="field">
        <span class="label">Address</span>
        <input 
          type="text" 
          class="nodrag"
          value={data.address || ''}
          oninput={(e) => updateField('address', (e.target as HTMLInputElement).value)}
          placeholder="Address or location name"
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
  .map-node {
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

  .map-node.selected {
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
    padding: 8px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .map-preview {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    overflow: hidden;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .map-preview img {
    width: 100%;
    height: auto;
    max-height: 120px;
    object-fit: cover;
  }

  .coords-display {
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.5);
    font-size: 10px;
    color: #10b981;
    font-family: 'Monaco', 'Consolas', monospace;
  }

  .no-coords {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #666;
    font-size: 11px;
  }

  .no-coords .icon {
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

  .field-row {
    display: flex;
    gap: 8px;
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
</style>
