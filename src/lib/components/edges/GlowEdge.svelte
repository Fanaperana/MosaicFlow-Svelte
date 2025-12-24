<!--
  GlowEdge - Custom edge component with glow effect on selection
  
  Renders a soft glow behind the edge when selected, keeping the actual
  edge color visible for better UX when editing edge appearance.
  Supports all edge path types: bezier, straight, step, smoothstep
-->
<script lang="ts">
  import { BaseEdge, EdgeLabel, getBezierPath, getStraightPath, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';

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
    label,
    labelStyle,
    interactionWidth,
  }: EdgeProps = $props();

  // Extract label styling from data for reactive updates
  const labelColor = $derived((data?.labelColor as string) || '#e0e0e0');
  const labelFontSize = $derived((data?.labelFontSize as number) || 12);
  const labelBgColor = $derived((data?.labelBgColor as string) || '#1a1d21');

  // Get the edge path type from data (default to bezier)
  const pathType = $derived((data?.pathType as string) || 'bezier');

  // Calculate the path and label position based on type
  const commonParams = $derived({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get path data based on path type - returns [path, labelX, labelY, offsetX, offsetY]
  const bezierResult = $derived(getBezierPath(commonParams));
  const straightResult = $derived(getStraightPath(commonParams));
  const stepResult = $derived(getSmoothStepPath({ ...commonParams, borderRadius: 0 }));
  const smoothStepResult = $derived(getSmoothStepPath({ ...commonParams, borderRadius: 8 }));

  // Select the appropriate result based on path type
  const pathResult = $derived.by(() => {
    switch (pathType) {
      case 'straight':
        return straightResult;
      case 'step':
        return stepResult;
      case 'smoothstep':
        return smoothStepResult;
      default: // bezier
        return bezierResult;
    }
  });

  const edgePath = $derived(pathResult[0]);
  const labelX = $derived(pathResult[1]);
  const labelY = $derived(pathResult[2]);
  
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
    {interactionWidth}
  />
</g>

<!-- Edge label using EdgeLabel for proper positioning -->
{#if label}
  <EdgeLabel x={labelX} y={labelY} style={labelStyle}>
    <div 
      class="edge-label-content"
      style="background: {labelBgColor}; color: {labelColor}; font-size: {labelFontSize}px;"
    >
      {label}
    </div>
  </EdgeLabel>
{/if}

<style>
  .glow-edge .glow-path-inner {
    filter: blur(2px);
    pointer-events: none;
  }

  .edge-label-content {
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #1e1e1e;
  }
</style>
