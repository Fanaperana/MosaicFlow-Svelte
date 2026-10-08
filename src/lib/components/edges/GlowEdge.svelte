<!--
  GlowEdge - Custom edge component with glow effect on selection
  
  Renders a soft glow behind the edge when selected, keeping the actual
  edge color visible for better UX when editing edge appearance.
  Supports all edge path types: bezier, straight, step, smoothstep
-->
<script lang="ts">
  import { BaseEdge, EdgeLabel, EdgeReconnectAnchor, getBezierPath, getStraightPath, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
  import { workspace } from '$lib/stores/workspace.svelte';

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
    type,
  }: EdgeProps = $props();

  // Extract label styling from data for reactive updates
  const labelColor = $derived((data?.labelColor as string) || '#e0e0e0');
  const labelFontSize = $derived((data?.labelFontSize as number) || 12);
  const labelBgColor = $derived((data?.labelBgColor as string) || '#1a1d21');

  // data.pathType wins; otherwise the edge type itself ('default' means bezier)
  const pathType = $derived((data?.pathType as string) || (type && type !== 'default' ? type : 'bezier'));

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

  // Either end of a selected edge can be dragged onto another handle.
  let reconnecting = $state(false);
  const canReconnect = $derived(!!selected && !workspace.locked);

  // Grab dots sit a little way along the edge so they don't cover the handle.
  const ANCHOR_OFFSET = 10;
  const DIRECTIONS: Record<string, [number, number]> = {
    top: [0, -1],
    bottom: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };

  function anchorPoint(x: number, y: number, side: string, otherX: number, otherY: number) {
    let [dx, dy] = DIRECTIONS[side] ?? [0, 0];
    if (pathType === 'straight') {
      const len = Math.hypot(otherX - x, otherY - y) || 1;
      [dx, dy] = [(otherX - x) / len, (otherY - y) / len];
    }
    return { x: x + dx * ANCHOR_OFFSET, y: y + dy * ANCHOR_OFFSET };
  }

  const sourceAnchor = $derived(anchorPoint(sourceX, sourceY, sourcePosition, targetX, targetY));
  const targetAnchor = $derived(anchorPoint(targetX, targetY, targetPosition, sourceX, sourceY));
</script>

<g class="glow-edge" class:selected class:reconnecting>
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
{#if label && !reconnecting}
  <EdgeLabel x={labelX} y={labelY} style={labelStyle}>
    <div 
      class="edge-label-content"
      style="background: {labelBgColor}; color: {labelColor}; font-size: {labelFontSize}px;"
    >
      {label}
    </div>
  </EdgeLabel>
{/if}

{#if canReconnect}
  <EdgeReconnectAnchor bind:reconnecting type="source" position={sourceAnchor} size={18} title="Drag to another connection point">
    <span class="reconnect-dot"></span>
  </EdgeReconnectAnchor>
  <EdgeReconnectAnchor bind:reconnecting type="target" position={targetAnchor} size={18} title="Drag to another connection point">
    <span class="reconnect-dot"></span>
  </EdgeReconnectAnchor>
{/if}

<style>
  .glow-edge.reconnecting {
    opacity: 0;
  }

  /* Centred absolutely: the anchor inherits the edge-label padding. */
  .reconnect-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border-radius: 50%;
    background: var(--mf-surface, #111318);
    border: 2px solid var(--mf-accent, #5b8def);
    box-shadow: 0 0 0 3px rgba(91, 141, 239, 0.25);
    cursor: grab;
    transition: transform 0.1s;
  }

  .reconnect-dot:hover {
    transform: scale(1.3);
  }

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
