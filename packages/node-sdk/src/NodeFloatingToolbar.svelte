<script lang="ts">
  import { NodeToolbar, Position, useSvelteFlow } from '@xyflow/svelte';
  import { Trash2, Palette, ZoomIn, Settings2, Copy, Lock, Unlock, Pipette } from 'lucide-svelte';
  import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import ColorPicker from 'svelte-awesome-color-picker';

  interface Props {
    nodeId: string;
    selected?: boolean;
    color?: string;
    bgOpacity?: number;
    onColorChange?: (color: string) => void;
    onBgOpacityChange?: (opacity: number) => void;
  }

  let { nodeId, selected = false, color = '#1e1e1e', bgOpacity = 1, onColorChange, onBgOpacityChange }: Props = $props();

  const { fitView } = useSvelteFlow();

  // Preset colors matching the Obsidian canvas style
  const presetColors = [
    { color: '#6b7280', name: 'Gray' },
    { color: '#ef4444', name: 'Red' },
    { color: '#f59e0b', name: 'Orange' },
    { color: '#eab308', name: 'Yellow' },
    { color: '#22c55e', name: 'Green' },
    { color: '#06b6d4', name: 'Cyan' },
    { color: '#3b82f6', name: 'Blue' },
    { color: '#8b5cf6', name: 'Purple' },
  ];

  let showColorPicker = $state(false);
  let showCustomColorPicker = $state(false);
  let customHex = $state('#3b82f6');
  let localOpacity = $state(1);

  // Get current node to check locked state
  const currentNode = $derived(workspace.getNode(nodeId));
  const isLocked = $derived(currentNode?.data?.locked ?? false);

  // Sync local opacity with prop
  $effect(() => {
    localOpacity = bgOpacity;
  });

  // Sync custom color when opening picker
  $effect(() => {
    if (showCustomColorPicker) {
      customHex = color;
    }
  });

  function handleDelete() {
    workspace.deleteNode(nodeId);
  }

  function handleZoomToFit() {
    fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.5 });
  }

  function handleColorSelect(newColor: string) {
    onColorChange?.(newColor);
    showColorPicker = false;
    showCustomColorPicker = false;
  }

  function handleCustomColorInput(event: { hex: string | null }) {
    if (event.hex) {
      customHex = event.hex;
      onColorChange?.(event.hex);
    }
  }

  function handleMoreProperties() {
    // Select the node and open properties panel
    workspace.setSelectedNodes([nodeId]);
    workspace.propertiesPanelOpen = true;
  }

  function handleDuplicate() {
    workspace.duplicateNodes([nodeId]);
  }

  function handleToggleLock() {
    workspace.updateNodeData(nodeId, { locked: !isLocked });
  }

  function openCustomColorPicker() {
    customHex = color;
    showCustomColorPicker = true;
  }

  function closeColorPicker() {
    showColorPicker = false;
    showCustomColorPicker = false;
  }
</script>

<NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
  <div class="floating-toolbar">
    {#if showColorPicker}
      <!-- Color picker row -->
      <div class="color-picker-row">
        <button 
          class="color-back-btn"
          onclick={closeColorPicker}
          type="button"
          title="Back"
        >
          <Palette size={14} />
        </button>
        <div class="color-divider"></div>
        {#if showCustomColorPicker}
          <div class="custom-color-picker nodrag">
            <ColorPicker 
              bind:hex={customHex}
              isAlpha={false}
              isDialog={false}
              onInput={handleCustomColorInput}
              --picker-height="100px"
              --picker-width="120px"
              --slider-width="12px"
              --picker-indicator-size="10px"
              --focus-color="#3b82f6"
              --cp-bg-color="#1e1e1e"
              --cp-border-color="#3a3a3a"
              --cp-text-color="#e5e7eb"
              --cp-input-color="#2d2d2d"
              --cp-button-hover-color="#3a3a3a"
            />
            {#if onBgOpacityChange}
              <div class="opacity-slider">
                <span class="opacity-label">Opacity: {Math.round(localOpacity * 100)}%</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  bind:value={localOpacity}
                  oninput={() => onBgOpacityChange?.(localOpacity)}
                  class="opacity-range"
                  aria-label="Background opacity"
                />
              </div>
            {/if}
            <button 
              class="apply-color-btn"
              onclick={() => handleColorSelect(customHex)}
              type="button"
            >
              Apply
            </button>
          </div>
        {:else}
          {#each presetColors as preset}
            <button
              class="color-swatch"
              class:active={color === preset.color}
              style="background-color: {preset.color}"
              onclick={() => handleColorSelect(preset.color)}
              title={preset.name}
              type="button"
            ></button>
          {/each}
          <div class="color-divider"></div>
          <button
            class="color-swatch custom-picker-btn"
            onclick={openCustomColorPicker}
            title="Custom color"
            type="button"
          >
            <Pipette size={12} />
          </button>
        {/if}
      </div>
    {:else}
      <!-- Default toolbar row -->
      <SimpleTooltip text="Delete" position="top">
        <button 
          class="toolbar-btn danger"
          onclick={handleDelete}
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </SimpleTooltip>

      <SimpleTooltip text="Duplicate" position="top">
        <button 
          class="toolbar-btn"
          onclick={handleDuplicate}
          type="button"
        >
          <Copy size={14} />
        </button>
      </SimpleTooltip>

      <SimpleTooltip text="Change color" position="top">
        <button 
          class="toolbar-btn"
          onclick={() => showColorPicker = true}
          type="button"
        >
          <Palette size={14} />
        </button>
      </SimpleTooltip>

      <SimpleTooltip text={isLocked ? 'Unlock' : 'Lock'} position="top">
        <button 
          class="toolbar-btn"
          onclick={handleToggleLock}
          type="button"
        >
          {#if isLocked}
            <Lock size={14} />
          {:else}
            <Unlock size={14} />
          {/if}
        </button>
      </SimpleTooltip>

      <SimpleTooltip text="Zoom to fit" position="top">
        <button 
          class="toolbar-btn"
          onclick={handleZoomToFit}
          type="button"
        >
          <ZoomIn size={14} />
        </button>
      </SimpleTooltip>

      <SimpleTooltip text="More properties" position="top">
        <button 
          class="toolbar-btn"
          onclick={handleMoreProperties}
          type="button"
        >
          <Settings2 size={14} />
        </button>
      </SimpleTooltip>
    {/if}
  </div>
</NodeToolbar>

<style>
  .floating-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    background: #1e1e1e;
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toolbar-btn:hover {
    background: #2d2d2d;
    color: #e5e7eb;
  }

  .toolbar-btn.danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  /* Color picker styles */
  .color-picker-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .color-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: #2d2d2d;
    border: 1px solid #4a4a4a;
    border-radius: 4px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .color-back-btn:hover {
    background: #3d3d3d;
    color: #e5e7eb;
  }

  .color-divider {
    width: 1px;
    height: 20px;
    background: #3a3a3a;
    margin: 0 4px;
  }

  .color-swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .color-swatch:hover {
    transform: scale(1.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .color-swatch.active {
    border-color: #fff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
  }

  .custom-picker-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
    color: #1e1e1e;
  }

  .custom-picker-btn:hover {
    color: #fff;
  }

  /* Custom color picker container */
  .custom-color-picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    background: #1e1e1e;
    border-radius: 6px;
  }

  /* Opacity slider */
  .opacity-slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }

  .opacity-label {
    font-size: 10px;
    color: #9ca3af;
    text-align: center;
  }

  .opacity-range {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(to right, transparent, #3b82f6);
    border-radius: 3px;
    cursor: pointer;
  }

  .opacity-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 2px solid #3b82f6;
    border-radius: 50%;
    cursor: pointer;
  }

  .opacity-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #fff;
    border: 2px solid #3b82f6;
    border-radius: 50%;
    cursor: pointer;
  }

  .apply-color-btn {
    padding: 5px 10px;
    background: #3b82f6;
    border: none;
    border-radius: 4px;
    color: #fff;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .apply-color-btn:hover {
    background: #2563eb;
  }
</style>
