<script lang="ts">
  import ColorPicker from 'svelte-awesome-color-picker';
  import tippy, { type Instance } from 'tippy.js';
  import 'tippy.js/dist/tippy.css';
  import { untrack } from 'svelte';
  
  interface RgbaColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  interface Props {
    value: string;
    onchange?: (color: string, rgba?: RgbaColor) => void;
    label?: string;
    size?: 'sm' | 'md';
    showAlpha?: boolean;
  }

  let { 
    value = $bindable('#000000'), 
    onchange,
    label,
    size = 'sm',
    showAlpha = true
  }: Props = $props();

  let buttonRef: HTMLButtonElement | null = $state(null);
  let pickerRef: HTMLDivElement | null = $state(null);
  let tippyInstance: Instance | null = null;
  let lastExternalValue = value;

  // Parse color - support both hex and rgba
  function parseColor(color: string): { hex: string; rgb: RgbaColor } {
    // Check if it's an rgba string
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]);
      const g = parseInt(rgbaMatch[2]);
      const b = parseInt(rgbaMatch[3]);
      const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      return { hex, rgb: { r, g, b, a } };
    }
    // Assume it's a hex color
    const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (hexMatch) {
      return { 
        hex: color.startsWith('#') ? color : `#${color}`, 
        rgb: { 
          r: parseInt(hexMatch[1], 16), 
          g: parseInt(hexMatch[2], 16), 
          b: parseInt(hexMatch[3], 16), 
          a: 1 
        } 
      };
    }
    return { hex: '#000000', rgb: { r: 0, g: 0, b: 0, a: 1 } };
  }

  const initial = parseColor(value);
  let hex = $state(initial.hex);
  let rgb = $state<RgbaColor>(initial.rgb);

  // Only sync when external value changes (not from our own updates)
  $effect(() => {
    const currentValue = value;
    untrack(() => {
      if (currentValue !== lastExternalValue) {
        const parsed = parseColor(currentValue);
        hex = parsed.hex;
        rgb = parsed.rgb;
        lastExternalValue = currentValue;
      }
    });
  });

  // Initialize tippy when refs are available
  $effect(() => {
    if (buttonRef && pickerRef) {
      if (!tippyInstance) {
        tippyInstance = tippy(buttonRef, {
          content: pickerRef,
          interactive: true,
          trigger: 'click',
          placement: 'bottom-start',
          appendTo: () => document.body,
          theme: 'color-picker',
          arrow: false,
          offset: [0, 4],
          maxWidth: 'none',
        });
      }
    }

    return () => {
      if (tippyInstance) {
        tippyInstance.destroy();
        tippyInstance = null;
      }
    };
  });

  function handleInput(event: { hex: string | null; rgb: RgbaColor | null }) {
    if (event.hex && event.rgb) {
      hex = event.hex;
      rgb = event.rgb;
      
      let newValue: string;
      if (showAlpha && event.rgb.a < 1) {
        newValue = `rgba(${event.rgb.r}, ${event.rgb.g}, ${event.rgb.b}, ${event.rgb.a})`;
      } else {
        newValue = event.hex;
      }
      
      lastExternalValue = newValue;
      value = newValue;
      onchange?.(newValue, event.rgb);
    }
  }

  // Display color for button
  const displayColor = $derived(
    rgb.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})` : hex
  );
</script>

<div class="color-input-wrapper" class:size-sm={size === 'sm'} class:size-md={size === 'md'}>
  {#if label}
    <span class="color-label">{label}</span>
  {/if}
  
  <button 
    type="button"
    class="color-button" 
    style="--color: {displayColor}"
    bind:this={buttonRef}
    title="Click to pick color"
  ></button>
</div>

<!-- Hidden picker content for tippy -->
<div bind:this={pickerRef} class="picker-content" style="display: none;">
  <ColorPicker
    bind:hex
    bind:rgb
    isAlpha={showAlpha}
    isDialog={false}
    onInput={handleInput}
  />
</div>

<style>
  .color-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-label {
    font-size: 11px;
    color: var(--text-muted, #8b949e);
    min-width: 60px;
  }

  .color-button {
    width: 24px;
    height: 24px;
    min-width: 24px;
    min-height: 24px;
    border-radius: 4px;
    border: 1px solid #30363d;
    cursor: pointer;
    padding: 0;
    transition: border-color 0.15s ease;
    /* Checkerboard background for transparency */
    background-image: 
      linear-gradient(45deg, #ccc 25%, transparent 25%), 
      linear-gradient(-45deg, #ccc 25%, transparent 25%), 
      linear-gradient(45deg, transparent 75%, #ccc 75%), 
      linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
    position: relative;
  }

  .color-button::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color);
    border-radius: 3px;
  }

  .color-button:hover {
    border-color: #58a6ff;
  }

  .size-sm .color-button {
    width: 24px;
    height: 24px;
  }

  .size-md .color-button {
    width: 32px;
    height: 32px;
  }

  .picker-content {
    display: block !important;
  }
</style>

<!-- Global tippy theme styles -->
<svelte:head>
  <style>
    .tippy-box[data-theme~='color-picker'] {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .tippy-box[data-theme~='color-picker'] .tippy-content {
      padding: 8px;
    }

    .tippy-box[data-theme~='color-picker'] .wrapper {
      --cp-bg-color: #161b22;
      --cp-border-color: #30363d;
      --cp-input-color: #c9d1d9;
      --cp-button-hover-color: #21262d;
    }

    .tippy-box[data-theme~='color-picker'] input {
      background: #0d1117 !important;
      border: 1px solid #30363d !important;
      color: #c9d1d9 !important;
      border-radius: 4px !important;
      font-family: 'Space Mono', monospace !important;
      font-size: 11px !important;
    }

    .tippy-box[data-theme~='color-picker'] input:focus {
      border-color: #58a6ff !important;
      outline: none !important;
    }

    .tippy-box[data-theme~='color-picker'] .alpha-wrapper,
    .tippy-box[data-theme~='color-picker'] .hue-wrapper {
      border-radius: 4px;
      overflow: hidden;
    }
  </style>
</svelte:head>
