<!-- Outline of a canvas: node boxes scaled to fit, with an optional highlighted node. -->
<script lang="ts">
  import type { MiniNode } from '$lib/stores/knowledge.svelte';

  interface Props {
    nodes: MiniNode[];
    highlight?: string | null;
    class?: string;
  }

  let { nodes, highlight = null, class: className = '' }: Props = $props();

  let viewBox = $derived.by(() => {
    if (nodes.length === 0) return '0 0 100 60';
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));
    const pad = Math.max(maxX - minX, maxY - minY) * 0.06 + 20;
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  });
</script>

<svg class="mini-map {className}" {viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  {#each nodes as n (n.id)}
    <rect
      x={n.x}
      y={n.y}
      width={n.width}
      height={n.height}
      rx="6"
      class:group={n.type === 'group'}
      class:hit={n.id === highlight}
      style={n.color && n.id !== highlight ? `stroke: ${n.color}` : ''}
      vector-effect="non-scaling-stroke"
    />
  {/each}
</svg>

<style>
  .mini-map {
    display: block;
    border: 1px solid var(--mf-border);
    border-radius: 6px;
    background:
      radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px) 0 0 / 10px 10px,
      var(--mf-bg);
  }

  rect {
    fill: rgba(255, 255, 255, 0.07);
    stroke: rgba(255, 255, 255, 0.16);
    stroke-width: 1;
  }

  rect.group {
    fill: rgba(59, 130, 246, 0.04);
    stroke-dasharray: 3 2;
  }

  rect.hit {
    fill: var(--mf-accent-soft);
    stroke: var(--mf-accent);
    stroke-width: 2;
  }
</style>
