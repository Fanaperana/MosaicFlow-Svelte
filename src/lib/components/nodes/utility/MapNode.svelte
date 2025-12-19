<!--
  MapNode - Utility Category
  
  Geographic location marker.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { MapNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { MapPin, Navigation, ExternalLink } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type MapNodeType = Node<MapNodeData, 'map'>;

  let { data, selected, id }: NodeProps<MapNodeType> = $props();

  function updateField(field: keyof MapNodeData, value: string | number) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openInMaps() {
    if (data.latitude && data.longitude) {
      const url = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
      window.open(url, '_blank');
    } else if (data.address) {
      const url = `https://www.google.com/maps/search/${encodeURIComponent(data.address)}`;
      window.open(url, '_blank');
    }
  }

  const hasCoordinates = $derived(data.latitude !== undefined && data.longitude !== undefined);
</script>

<NodeWrapper {data} {selected} {id} nodeType="map" class="map-node">
  {#snippet header()}
    <span class="node-icon"><MapPin size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.label || data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <button class="node-action-btn" onclick={openInMaps} title="Open in Google Maps">
      <ExternalLink size={14} strokeWidth={1.5} />
    </button>
  {/snippet}
  
  <div class="map-icon">
    <MapPin size={32} strokeWidth={1} />
  </div>
  
  <NodeField 
    label="Location Name"
    value={data.label || ''}
    placeholder="Place name"
    oninput={(v) => updateField('label', v)}
  />
  
  <NodeField 
    label="Address"
    value={data.address || ''}
    placeholder="Full address..."
    oninput={(v) => updateField('address', v)}
  />
  
  <div class="coordinates-row">
    <div class="coord-field">
      <label for="map-lat">Latitude</label>
      <input
        id="map-lat"
        type="number"
        class="coord-input nodrag"
        value={data.latitude || ''}
        step="0.000001"
        placeholder="0.000000"
        oninput={(e) => updateField('latitude', parseFloat((e.target as HTMLInputElement).value))}
      />
    </div>
    <div class="coord-field">
      <label for="map-lng">Longitude</label>
      <input
        id="map-lng"
        type="number"
        class="coord-input nodrag"
        value={data.longitude || ''}
        step="0.000001"
        placeholder="0.000000"
        oninput={(e) => updateField('longitude', parseFloat((e.target as HTMLInputElement).value))}
      />
    </div>
  </div>
  
  {#if hasCoordinates}
    <div class="coord-display">
      <Navigation size={12} />
      <span>{data.latitude?.toFixed(6)}, {data.longitude?.toFixed(6)}</span>
    </div>
  {/if}
</NodeWrapper>

<style>
  .map-icon {
    display: flex;
    justify-content: center;
    padding: 12px;
    color: #ef4444;
  }

  .coordinates-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }

  .coord-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .coord-field label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .coord-input {
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    font-family: monospace;
    outline: none;
  }

  .coord-input:focus {
    border-color: #3b82f6;
  }

  .coord-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
    padding: 8px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    color: #60a5fa;
  }
</style>
