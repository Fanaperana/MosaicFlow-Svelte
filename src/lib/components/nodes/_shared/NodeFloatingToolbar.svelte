<script lang="ts">
  import { NodeToolbar, Position, useSvelteFlow } from '@xyflow/svelte';
  import { Trash2, Palette, ZoomIn, ExternalLink } from 'lucide-svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { workspace } from '$lib/stores/workspace.svelte';

  interface Props {
    nodeId: string;
    selected?: boolean;
    color?: string;
    onColorChange?: (color: string) => void;
  }

  let { nodeId, selected = false, color = '#1e1e1e', onColorChange }: Props = $props();

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

  function handleDelete() {
    workspace.deleteNode(nodeId);
  }

  function handleZoomToFit() {
    fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.5 });
  }

  function handleColorSelect(newColor: string) {
    onColorChange?.(newColor);
    showColorPicker = false;
  }

  function handleEdit() {
    // Open in edit mode or external editor - dispatch event for parent to handle
    const event = new CustomEvent('node-edit', { 
      detail: { nodeId },
      bubbles: true 
    });
    document.dispatchEvent(event);
  }
</script>

<NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
  <div class="floating-toolbar">
    {#if showColorPicker}
      <!-- Color picker row -->
      <div class="color-picker-row">
        <button 
          class="color-back-btn"
          onclick={() => showColorPicker = false}
          type="button"
        >
          <Palette size={14} />
        </button>
        <div class="color-divider"></div>
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
      </div>
    {:else}
      <!-- Default toolbar row -->
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button 
            class="toolbar-btn danger"
            onclick={handleDelete}
            type="button"
          >
            <Trash2 size={14} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">
          <p>Delete</p>
        </Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button 
            class="toolbar-btn"
            onclick={() => showColorPicker = true}
            type="button"
          >
            <Palette size={14} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">
          <p>Change color</p>
        </Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button 
            class="toolbar-btn"
            onclick={handleZoomToFit}
            type="button"
          >
            <ZoomIn size={14} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">
          <p>Zoom to fit</p>
        </Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button 
            class="toolbar-btn"
            onclick={handleEdit}
            type="button"
          >
            <ExternalLink size={14} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">
          <p>Edit</p>
        </Tooltip.Content>
      </Tooltip.Root>
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
</style>
