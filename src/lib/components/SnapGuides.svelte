<script lang="ts">
  import { ViewportPortal } from '@xyflow/svelte';
  import type { SnapGuide } from '$lib/utils/snap-guides';
  
  interface Props {
    guides: SnapGuide[];
  }
  
  let { guides }: Props = $props();
</script>

<!--
  Snap alignment guide lines overlay
  Rendered using ViewportPortal to be in the flow's coordinate space
  Uses SVG for smooth line rendering
-->
{#if guides.length > 0}
  <ViewportPortal target="front">
    <svg 
      class="snap-guides-svg"
      style="position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none;"
    >
      {#each guides as guide, i (guide.type + '-' + guide.position.toFixed(1) + '-' + guide.alignType + '-' + i)}
        {#if guide.type === 'vertical'}
          <line
            class="snap-guide"
            class:center-guide={guide.alignType === 'center'}
            x1={guide.position}
            y1={guide.start}
            x2={guide.position}
            y2={guide.end}
          />
          <!-- Small indicator circles at ends -->
          <circle
            class="snap-guide-endpoint"
            class:center-endpoint={guide.alignType === 'center'}
            cx={guide.position}
            cy={guide.start}
            r="3"
          />
          <circle
            class="snap-guide-endpoint"
            class:center-endpoint={guide.alignType === 'center'}
            cx={guide.position}
            cy={guide.end}
            r="3"
          />
        {:else}
          <line
            class="snap-guide"
            class:center-guide={guide.alignType === 'middle'}
            x1={guide.start}
            y1={guide.position}
            x2={guide.end}
            y2={guide.position}
          />
          <!-- Small indicator circles at ends -->
          <circle
            class="snap-guide-endpoint"
            class:center-endpoint={guide.alignType === 'middle'}
            cx={guide.start}
            cy={guide.position}
            r="3"
          />
          <circle
            class="snap-guide-endpoint"
            class:center-endpoint={guide.alignType === 'middle'}
            cx={guide.end}
            cy={guide.position}
            r="3"
          />
        {/if}
      {/each}
    </svg>
  </ViewportPortal>
{/if}

<style>
  :global(.snap-guides-svg .snap-guide) {
    stroke: #3b82f6;
    stroke-width: 1;
    stroke-dasharray: 4, 4;
    opacity: 0.9;
    filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.6));
  }
  
  :global(.snap-guides-svg .snap-guide.center-guide) {
    stroke: #8b5cf6;
    stroke-dasharray: 6, 3;
    filter: drop-shadow(0 0 3px rgba(139, 92, 246, 0.6));
  }
  
  :global(.snap-guides-svg .snap-guide-endpoint) {
    fill: #3b82f6;
    opacity: 0.9;
  }
  
  :global(.snap-guides-svg .snap-guide-endpoint.center-endpoint) {
    fill: #8b5cf6;
  }
</style>
