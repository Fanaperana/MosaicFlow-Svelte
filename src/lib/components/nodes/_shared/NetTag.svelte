<!-- One net label tag (KiCad-style). Used on node sides and at both ends of edges shown as labels. -->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import type { NetLabelEnd, NetLabelEndSide, NodeSide } from '$lib/types';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    name: string;
    side: NodeSide;
    end?: NetLabelEnd;
    /** Which end gets the shape: away from the node, towards it, or both. */
    endSide?: NetLabelEndSide;
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
    /** No other node carries this label yet: flagged with a red badge. */
    orphan?: boolean;
  }

  let { name, side, end = 'sharp', endSide = 'outer', color, lit = false, selected = false, fontSize = 12, textColor, bgColor, offset = false, orphan = false, class: className = '', ...rest }: Props = $props();

  // Left-side tags point left, so their outer end is the physical left one.
  const outerIsLeft = $derived(side === 'left');
  const shapeLeft = $derived(end !== 'none' && (endSide === 'both' || (endSide === 'outer') === outerIsLeft));
  const shapeRight = $derived(end !== 'none' && (endSide === 'both' || (endSide === 'outer') !== outerIsLeft));
</script>

<div
  class="net-tag side-{side} {className}"
  class:l-sharp={shapeLeft && end === 'sharp'}
  class:r-sharp={shapeRight && end === 'sharp'}
  class:l-round={shapeLeft && end === 'rounded'}
  class:r-round={shapeRight && end === 'rounded'}
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
  {#if shapeLeft && end === 'sharp'}
    <svg class="tip left" viewBox="0 0 10 22" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 0 0.75 L 9.25 11 L 0 21.25" />
    </svg>
  {/if}
  {#if shapeRight && end === 'sharp'}
    <svg class="tip right" viewBox="0 0 10 22" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 0 0.75 L 9.25 11 L 0 21.25" />
    </svg>
  {/if}
  {#if orphan}
    <span class="orphan-badge" class:left={outerIsLeft} aria-label="Needs a pair">!</span>
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
    height: calc(1em + 10px);
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
    height: calc(100% + 3px);
    overflow: visible;
  }

  .tip path {
    fill: var(--bg);
    stroke: var(--c);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }

  .net-tag.r-sharp {
    margin-right: 10px;
    border-right: none;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .tip.right {
    right: -10px;
  }

  .net-tag.l-sharp {
    margin-left: 10px;
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .tip.left {
    left: -10px;
    transform: scaleX(-1);
  }

  .net-tag.r-round {
    border-top-right-radius: 999px;
    border-bottom-right-radius: 999px;
  }

  .net-tag.l-round {
    border-top-left-radius: 999px;
    border-bottom-left-radius: 999px;
  }

  .net-tag.lit,
  .net-tag.selected {
    --bg: var(--fill, color-mix(in srgb, var(--c) 35%, #0d1117));
    box-shadow: 0 0 14px var(--c);
  }

  /* On the outer end, clear of the node and its wire. */
  .orphan-badge {
    position: absolute;
    top: -7px;
    right: -7px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 13px;
    height: 13px;
    border: 1.5px solid #0d1117;
    border-radius: 50%;
    background: var(--mf-danger, #ef6461);
    color: #fff;
    font-family: var(--mf-font-ui);
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
  }

  .orphan-badge.left {
    right: auto;
    left: -7px;
  }

  .net-tag.r-sharp .orphan-badge:not(.left) {
    right: -14px;
  }

  .net-tag.l-sharp .orphan-badge.left {
    left: -14px;
  }
</style>
