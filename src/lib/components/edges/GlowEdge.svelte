<!--
  GlowEdge - Custom edge component with glow effect on selection
  
  Renders a soft glow behind the edge when selected, keeping the actual
  edge color visible for better UX when editing edge appearance.
-->
<script lang="ts">
  import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/svelte';

  let {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerStart,
    markerEnd,
    selected,
    data,
  }: EdgeProps = $props();

  // Calculate the bezier path
  const pathData = $derived(getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  }));

  const edgePath = $derived(pathData[0]);
  
  // Get edge properties from data
  const strokeWidth = $derived((data?.strokeWidth as number) || 2);
</script>

<g class="glow-edge" class:selected>
  <!-- Glow layer - rendered first (behind) -->
  {#if selected}
    <!-- <path
      class="glow-path"
      d={edgePath}
      fill="none"
      stroke="rgba(59, 130, 246, 0.4)"
      stroke-width={strokeWidth + 12}
      stroke-linecap="round"
    /> -->
    <path
      class="glow-path-inner"
      d={edgePath}
      fill="none"
      stroke="rgba(59, 130, 246, 0.3)"
      stroke-width={strokeWidth + 6}
      stroke-linecap="round"
    />
  {/if}
  
  <!-- Main edge - rendered on top -->
  <BaseEdge
    {id}
    path={edgePath}
    {style}
    {markerStart}
    {markerEnd}
  />
</g>

<style>
  .glow-edge .glow-path {
    filter: blur(4px);
    pointer-events: none;
  }
  
  .glow-edge .glow-path-inner {
    filter: blur(2px);
    pointer-events: none;
  }
</style>
