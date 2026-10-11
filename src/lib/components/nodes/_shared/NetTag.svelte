<!-- One net label tag (KiCad-style). Used on node sides and at both ends of edges shown as labels. -->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import type { NetLabelEnd, NodeSide } from '$lib/types';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    name: string;
    side: NodeSide;
    end?: NetLabelEnd;
    color: string;
    lit?: boolean;
    selected?: boolean;
    fontSize?: number;
    /** Overrides the text colour derived from `color`. */
    textColor?: string;
    /** Overrides the fill derived from `color`. */
    bgColor?: string;
    /** Shift the tag so its near edge sits on the anchor point (for tags centred on a point, e.g. edge labels). */
    offset?: boolean;
  }

  let { name, side, end = 'sharp', color, lit = false, selected = false, fontSize = 12, textColor, bgColor, offset = false, class: className = '', ...rest }: Props = $props();
</script>

<div
  class="net-tag side-{side} end-{end} {className}"
  class:offset
  class:lit
  class:selected
  style:--c={color}
  style:--text={textColor || null}
  style:--fill={bgColor || null}
  style:font-size="{fontSize}px"
  {...rest}
>
  {name}
  {#if end === 'sharp'}
    <svg class="tip" viewBox="0 0 10 22" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 0 0.75 L 9.25 11 L 0 21.25" />
    </svg>
  {/if}
</div>

<style>
  /* The tag points away from its node: the tip is on the far side. */
  .net-tag {
    --bg: var(--fill, color-mix(in srgb, var(--c) 16%, #0d1117));
    position: relative;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    height: 22px;
    padding: 0 9px;
    border: 1.5px solid var(--c);
    border-radius: 3px;
    background: var(--bg);
    color: var(--text, color-mix(in srgb, var(--c) 70%, #ffffff));
    font-family: var(--mf-font-mono);
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    transition: box-shadow 0.15s, background 0.15s;
  }

  .net-tag.offset.side-right { transform: translateX(50%); }
  .net-tag.offset.side-left { transform: translateX(-50%); }
  .net-tag.offset.side-top { transform: translateY(-50%); }
  .net-tag.offset.side-bottom { transform: translateY(50%); }

  .tip {
    position: absolute;
    top: -1.5px;
    width: 10px;
    height: 22px;
    overflow: visible;
  }

  .tip path {
    fill: var(--bg);
    stroke: var(--c);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }

  .net-tag.end-sharp:not(.side-left) {
    margin-right: 10px;
    border-right: none;
    border-radius: 3px 0 0 3px;
  }

  .net-tag.end-sharp:not(.side-left) .tip {
    right: -10px;
  }

  .net-tag.end-sharp.side-left {
    margin-left: 10px;
    border-left: none;
    border-radius: 0 3px 3px 0;
  }

  .net-tag.end-sharp.side-left .tip {
    left: -10px;
    transform: scaleX(-1);
  }

  .net-tag.end-rounded:not(.side-left) {
    border-radius: 3px 11px 11px 3px;
  }

  .net-tag.end-rounded.side-left {
    border-radius: 11px 3px 3px 11px;
  }

  .net-tag.lit,
  .net-tag.selected {
    --bg: var(--fill, color-mix(in srgb, var(--c) 35%, #0d1117));
    box-shadow: 0 0 14px var(--c);
  }
</style>
