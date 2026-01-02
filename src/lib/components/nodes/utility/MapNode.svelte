<!--
  MapNode - Utility Category
  
  Interactive geographic location marker with MapLibre GL integration.
  Built with svelte-maplibre-gl for beautiful, accessible map components.
  Features address autocomplete using OpenStreetMap Nominatim API.
  @see https://mapcn.vercel.app/ for the design inspiration
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { MapNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { MapPin, Navigation, ExternalLink, ZoomIn, ZoomOut, Loader2, Search } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';
  import { MapLibre, Marker, NavigationControl } from 'svelte-maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  type MapNodeType = Node<MapNodeData, 'map'>;

  // Nominatim search result type
  interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    importance: number;
  }

  let { data, selected, id }: NodeProps<MapNodeType> = $props();

  // Default coordinates (New York City) if none provided
  const defaultLat = 40.7128;
  const defaultLng = -74.006;
  const defaultZoom = 12;

  // Reactive state for map position
  let currentLat = $derived(data.latitude ?? defaultLat);
  let currentLng = $derived(data.longitude ?? defaultLng);
  let currentZoom = $derived(data.zoom ?? defaultZoom);

  // Address autocomplete state
  let addressInput = $state('');
  let suggestions = $state<NominatimResult[]>([]);
  let isSearching = $state(false);
  let showSuggestions = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasInitialized = $state(false);

  function updateField(field: keyof MapNodeData, value: string | number) {
    workspace.updateNodeData(id, { [field]: value });
  }

  // Sync addressInput with data.address
  $effect(() => {
    // Initialize on first run or sync when address changes externally
    if (!hasInitialized || (data.address !== addressInput && !showSuggestions)) {
      addressInput = data.address || '';
      hasInitialized = true;
    }
  });

  // Debounced search for address autocomplete using Nominatim
  async function searchAddress(query: string) {
    if (query.length < 3) {
      suggestions = [];
      showSuggestions = false;
      return;
    }

    isSearching = true;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'MosaicFlow/1.0'
          }
        }
      );
      
      if (response.ok) {
        const results: NominatimResult[] = await response.json();
        suggestions = results;
        showSuggestions = results.length > 0;
      }
    } catch (error) {
      console.error('Address search failed:', error);
      suggestions = [];
    } finally {
      isSearching = false;
    }
  }

  function handleAddressInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    addressInput = value;
    updateField('address', value);

    // Debounce the search
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      searchAddress(value);
    }, 300);
  }

  function selectSuggestion(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    // Update all fields
    addressInput = result.display_name;
    updateField('address', result.display_name);
    updateField('latitude', lat);
    updateField('longitude', lng);
    
    // Hide suggestions
    suggestions = [];
    showSuggestions = false;
  }

  function handleAddressFocus() {
    if (suggestions.length > 0) {
      showSuggestions = true;
    }
  }

  function handleAddressBlur() {
    // Delay hiding to allow click on suggestion
    setTimeout(() => {
      showSuggestions = false;
    }, 200);
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

  function handleMarkerDragEnd(event: { target: { getLngLat: () => { lat: number; lng: number } } }) {
    const lngLat = event.target.getLngLat();
    updateField('latitude', lngLat.lat);
    updateField('longitude', lngLat.lng);
  }

  function handleZoomIn() {
    const newZoom = Math.min((data.zoom ?? defaultZoom) + 1, 18);
    updateField('zoom', newZoom);
  }

  function handleZoomOut() {
    const newZoom = Math.max((data.zoom ?? defaultZoom) - 1, 1);
    updateField('zoom', newZoom);
  }

  const hasCoordinates = $derived(data.latitude !== undefined && data.longitude !== undefined);
  
  // Map style - using CartoDB Voyager (free, no API key required)
  const mapStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
</script>

<NodeWrapper {data} {selected} {id} nodeType="map" class="map-node">
  {#snippet header()}
    <span class="node-icon"><MapPin size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.label || data.title || 'Location'}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <button class="node-action-btn" onclick={handleZoomOut} title="Zoom Out">
      <ZoomOut size={14} strokeWidth={1.5} />
    </button>
    <button class="node-action-btn" onclick={handleZoomIn} title="Zoom In">
      <ZoomIn size={14} strokeWidth={1.5} />
    </button>
    <button class="node-action-btn" onclick={openInMaps} title="Open in Google Maps">
      <ExternalLink size={14} strokeWidth={1.5} />
    </button>
  {/snippet}
  
  <!-- Interactive Map Display -->
  <div class="map-container nodrag nowheel">
    <MapLibre
      class="map-display"
      style={mapStyle}
      zoom={currentZoom}
      center={{ lng: currentLng, lat: currentLat }}
      attributionControl={false}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <Marker 
        lnglat={{ lng: currentLng, lat: currentLat }}
        draggable={true}
        color="#ef4444"
        ondragend={handleMarkerDragEnd}
      />
    </MapLibre>
  </div>
  
  <NodeField 
    label="Location Name"
    value={data.label || ''}
    placeholder="Place name"
    oninput={(v) => updateField('label', v)}
  />
  
  <!-- Address Autocomplete Field -->
  <div class="address-field">
    <label class="address-label" for="address-input-{id}">
      Address
      {#if isSearching}
        <Loader2 size={10} class="animate-spin" />
      {/if}
    </label>
    <div class="address-input-wrapper">
      <Search size={12} class="address-search-icon" />
      <input
        id="address-input-{id}"
        type="text"
        class="address-input nodrag"
        value={addressInput}
        placeholder="Search for an address..."
        oninput={handleAddressInput}
        onfocus={handleAddressFocus}
        onblur={handleAddressBlur}
      />
    </div>
    
    {#if showSuggestions && suggestions.length > 0}
      <div class="suggestions-dropdown nodrag">
        {#each suggestions as suggestion (suggestion.place_id)}
          <button
            type="button"
            class="suggestion-item"
            onclick={() => selectSuggestion(suggestion)}
          >
            <MapPin size={12} class="suggestion-icon" />
            <span class="suggestion-text">{suggestion.display_name}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  
  <div class="coordinates-section">
    <div class="coordinates-header">
      <span class="coordinates-label">Or enter coordinates manually</span>
    </div>
    <div class="coordinates-row">
      <div class="coord-field">
        <label for="map-lat-{id}">Latitude</label>
        <input
          id="map-lat-{id}"
          type="number"
          class="coord-input nodrag"
          value={data.latitude ?? ''}
          step="0.000001"
          placeholder="0.000000"
          oninput={(e) => updateField('latitude', parseFloat((e.target as HTMLInputElement).value))}
        />
      </div>
      <div class="coord-field">
        <label for="map-lng-{id}">Longitude</label>
        <input
          id="map-lng-{id}"
          type="number"
          class="coord-input nodrag"
          value={data.longitude ?? ''}
          step="0.000001"
          placeholder="0.000000"
          oninput={(e) => updateField('longitude', parseFloat((e.target as HTMLInputElement).value))}
        />
      </div>
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
  .map-container {
    width: 100%;
    height: 180px;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 8px;
    border: 1px solid #333;
  }

  :global(.map-display) {
    width: 100%;
    height: 100%;
  }

  /* Address Autocomplete Styles */
  .address-field {
    position: relative;
    margin-top: 8px;
  }

  .address-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .address-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.address-search-icon) {
    position: absolute;
    left: 8px;
    color: #666;
    pointer-events: none;
  }

  .address-input {
    width: 100%;
    padding: 8px 8px 8px 28px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }

  .address-input:focus {
    border-color: #3b82f6;
  }

  .address-input::placeholder {
    color: #666;
  }

  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .suggestion-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: #e0e0e0;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
  }

  .suggestion-item:hover {
    background: rgba(59, 130, 246, 0.15);
  }

  .suggestion-item:not(:last-child) {
    border-bottom: 1px solid #2a2a2a;
  }

  :global(.suggestion-icon) {
    flex-shrink: 0;
    margin-top: 2px;
    color: #ef4444;
  }

  .suggestion-text {
    line-height: 1.4;
    word-break: break-word;
  }

  /* Coordinates Section */
  .coordinates-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #333;
  }

  .coordinates-header {
    margin-bottom: 8px;
  }

  .coordinates-label {
    font-size: 10px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .coordinates-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
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

  /* Animate spin for loader */
  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
