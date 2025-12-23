<!--
  GlowEdge - Custom edge component with glow effect on selection
  
  Renders a soft glow behind the edge when selected, keeping the actual
  edge color visible for better UX when editing edge appearance.
  Supports all edge path types: bezier, straight, step, smoothstep
-->
<script lang="ts">
  import { BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';

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

  // Get the edge path type from data (default to bezier)
  const pathType = $derived((data?.pathType as string) || 'bezier');

  // Calculate the path based on type
  const pathData = $derived(() => {
    const commonParams = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };

    switch (pathType) {
      case 'straight':
        return getStraightPath(commonParams);
      case 'step':
        return getSmoothStepPath({ ...commonParams, borderRadius: 0 });
      case 'smoothstep':
        return getSmoothStepPath({ ...commonParams, borderRadius: 8 });
      default: // bezier
        return getBezierPath(commonParams);
    }
  });

  const edgePath = $derived(pathData()[0]);
  
  // Get edge properties from data
  const strokeWidth = $derived((data?.strokeWidth as number) || 2);
</script>

<g class="glow-edge" class:selected>
  <!-- Glow layer - rendered first (behind), uses svelte-flow__edge-interaction class to prevent animation on glow -->
  {#if selected}
    <path
      class="glow-path-inner svelte-flow__edge-interaction"
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
  .glow-edge .glow-path-inner {
    filter: blur(2px);
    pointer-events: none;
  }
</style>
