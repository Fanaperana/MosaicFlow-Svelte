<!--
  GlowEdge - Custom edge component with glow effect on selection
  
  Renders a soft glow behind the edge when selected, keeping the actual
  edge color visible for better UX when editing edge appearance.
  Supports all edge path types: bezier, straight, step, smoothstep
-->
<script lang="ts">
  import { BaseEdge, EdgeLabel, EdgeReconnectAnchor, getBezierPath, getStraightPath, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { edgeObstacles } from '$lib/stores/edge-obstacles.svelte';
  import { netHover, netNameOf } from '$lib/stores/net-hover.svelte';
  import { netLabelRects } from '$lib/stores/net-label-rects.svelte';
  import NetTag from '$lib/components/nodes/_shared/NetTag.svelte';
  import type { NetLabelEnd, NetLabelEndSide, NodeSide } from '$lib/types';
  import { hitsObstacle, roundedPath, routeOrthogonal, sampleBezier, sampleLine, type Point, type Side } from '@mosaicflow/vault-core';

  let {
    id,
    source,
    target,
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

  // Net-label mode: no line, just a short stub and a named tag at each end (KiCad-style local label).
  const asLabels = $derived(data?.display === 'label');
  const netName = $derived(netNameOf(label));
  const labelEnd = $derived((data?.labelEnd as string) || 'sharp');
  const NET_STUB = 22;

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

  // Smart routing: step edges always go around nodes; curved and straight edges only when they would cross one.
  // Computed after the canvas settles (not every drag frame); until then the plain path is drawn.
  const ROUTE_DELAY = 120;
  let routed = $state<{ path: string; mid: Point } | null>(null);
  let routedFor = '';

  function route(): { path: string; mid: Point } | null {
    const obstacles = [...edgeObstacles.rects].filter(([nodeId]) => nodeId !== source && nodeId !== target).map(([, r]) => r);
    const s = { x: sourceX, y: sourceY };
    const t = { x: targetX, y: targetY };
    const sSide = sourcePosition as Side;
    const tSide = targetPosition as Side;
    const orthogonal = pathType === 'step' || pathType === 'smoothstep';
    if (!orthogonal) {
      const samples = pathType === 'straight' ? sampleLine(s, t) : sampleBezier(s, sSide, t, tSide);
      if (!hitsObstacle(samples, obstacles)) return null;
    }
    const points = routeOrthogonal(s, sSide, t, tSide, obstacles);
    return points ? roundedPath(points, pathType === 'step' ? 0 : 10) : null;
  }

  $effect(() => {
    const key = [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, pathType].join();
    void edgeObstacles.rects;
    if (settings.current.canvas.edgeRouting !== 'smart' || asLabels) {
      routed = null;
      return;
    }
    // A moved end makes the old route wrong; other changes keep it until the new one is ready.
    if (key !== routedFor) routed = null;
    const timer = setTimeout(() => {
      routed = route();
      routedFor = key;
    }, ROUTE_DELAY);
    return () => clearTimeout(timer);
  });

  const edgePath = $derived(asLabels ? stubPath() : (routed?.path ?? pathResult[0]));
  const labelX = $derived(routed?.mid.x ?? pathResult[1]);
  const labelY = $derived(routed?.mid.y ?? pathResult[2]);

  // Node net labels win: a line's label slides along its path (or steps aside) until it clears them.
  const LABEL_GAP = 6;
  let measurer: SVGPathElement | undefined;
  const labelPos = $derived.by(() => {
    const base = { x: labelX, y: labelY };
    const tags = netLabelRects.absolute;
    if (!label || asLabels || !tags.length) return base;
    const w = String(label).length * labelFontSize * 0.62 + 18;
    const h = labelFontSize + 10;
    const clear = (p: { x: number; y: number }) =>
      !tags.some((r) =>
        p.x - w / 2 < r.x + r.width + LABEL_GAP && r.x - LABEL_GAP < p.x + w / 2 &&
        p.y - h / 2 < r.y + r.height + LABEL_GAP && r.y - LABEL_GAP < p.y + h / 2);
    if (clear(base)) return base;
    measurer ??= document.createElementNS('http://www.w3.org/2000/svg', 'path');
    measurer.setAttribute('d', edgePath);
    const length = measurer.getTotalLength();
    for (const t of [0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) {
      const p = measurer.getPointAtLength(length * t);
      if (clear(p)) return { x: p.x, y: p.y };
    }
    for (let step = 1; step <= 4; step++) {
      for (const dir of [1, -1]) {
        const p = { x: base.x, y: base.y + dir * step * (h + LABEL_GAP) };
        if (clear(p)) return p;
      }
    }
    return base;
  });

  function stubEnd(x: number, y: number, side: string) {
    const [dx, dy] = DIRECTIONS[side] ?? [0, 0];
    return { x: x + dx * NET_STUB, y: y + dy * NET_STUB };
  }

  function stubPath() {
    const s = stubEnd(sourceX, sourceY, sourcePosition);
    const t = stubEnd(targetX, targetY, targetPosition);
    return `M ${sourceX} ${sourceY} L ${s.x} ${s.y} M ${targetX} ${targetY} L ${t.x} ${t.y}`;
  }

  const netTags = $derived(
    asLabels
      ? [
          { key: 'source', side: sourcePosition as string, ...stubEnd(sourceX, sourceY, sourcePosition) },
          { key: 'target', side: targetPosition as string, ...stubEnd(targetX, targetY, targetPosition) },
        ]
      : []
  );
  const netLit = $derived(asLabels && netHover.name === netName);
  
  // Get edge properties from data
  const strokeWidth = $derived((data?.strokeWidth as number) || 2);

  // Arrowheads are drawn here rather than by xyflow: its marker ids embed the colour ("color=#8b5cf6&..."),
  // which WebKit (macOS/Linux webviews) may fail to resolve in url(#...), so arrows vanish there.
  const markerColor = $derived((data?.color as string) || '#555555');
  const shapeOf = (shape: unknown, fallback: unknown): string => {
    if (typeof shape === 'string') return shape;
    const ref = typeof fallback === 'string' ? fallback : '';
    return ref.includes('type=arrowclosed') ? 'arrowclosed' : ref.includes('type=arrow') ? 'arrow' : 'none';
  };
  const startShape = $derived(shapeOf(data?.markerStart, markerStart));
  const endShape = $derived(shapeOf(data?.markerEnd, markerEnd));
  const markerBase = $derived(`mf-arrow-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`);
  const markerStartUrl = $derived(startShape === 'none' || asLabels ? undefined : `url(#${markerBase}-start)`);
  const markerEndUrl = $derived(endShape === 'none' || asLabels ? undefined : `url(#${markerBase}-end)`);

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

<g class="glow-edge" class:selected class:reconnecting class:net-lit={netLit}>
  {#if markerStartUrl || markerEndUrl}
    <defs>
      {#each [['start', startShape, '5,-4 0,0 5,4'], ['end', endShape, '-5,-4 0,0 -5,4']] as [end, shape, points] (end)}
        {#if shape !== 'none'}
          <!-- orient="auto" with a pre-mirrored start arrow: older WebKit lacks auto-start-reverse -->
          <marker id="{markerBase}-{end}" markerWidth="20" markerHeight="20" viewBox="-10 -10 20 20" markerUnits="strokeWidth" orient="auto" refX="0" refY="0">
            <polyline
              points={shape === 'arrowclosed' ? `${points} ${points.split(' ')[0]}` : points}
              stroke={markerColor}
              fill={shape === 'arrowclosed' ? markerColor : 'none'}
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </marker>
        {/if}
      {/each}
    </defs>
  {/if}
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
    markerStart={markerStartUrl}
    markerEnd={markerEndUrl}
    {interactionWidth}
  />
</g>

<!-- Edge label using EdgeLabel for proper positioning -->
{#if label && !reconnecting && !asLabels}
  <EdgeLabel x={labelPos.x} y={labelPos.y} style={labelStyle} class="mf-edge-label" selectEdgeOnClick>
    <div 
      class="edge-label-content"
      style="background: {labelBgColor}; color: {labelColor}; font-size: {labelFontSize}px;"
    >
      {label}
    </div>
  </EdgeLabel>
{/if}

{#if !reconnecting}
  {#each netTags as tag (tag.key)}
    <EdgeLabel x={tag.x} y={tag.y} class="mf-net-label" selectEdgeOnClick>
      <NetTag
        name={netName}
        side={tag.side as NodeSide}
        end={labelEnd as NetLabelEnd}
        endSide={data?.labelEndSide as NetLabelEndSide | undefined}
        color={markerColor}
        lit={netLit}
        {selected}
        fontSize={labelFontSize}
        textColor={data?.labelColor as string | undefined}
        bgColor={data?.labelBgColor as string | undefined}
        offset
        onmouseenter={(e) => netHover.enter(netName, `edge:${id}:${tag.key}`, e.currentTarget)}
        onmouseleave={() => netHover.leave()}
      />
    </EdgeLabel>
  {/each}
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

  /* xyflow sets the label's z-index to the edge's, which puts it under nodes nested in groups.
     Selected edges and nodes are lifted by 1000, so labels sit above that, and grab dots above labels. */
  :global(.svelte-flow__edge-label.mf-edge-label) {
    z-index: 2000 !important;
  }

  :global(.svelte-flow__edge-label.svelte-flow__edgeupdater) {
    z-index: 2001 !important;
  }

  .edge-label-content {
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #1e1e1e;
  }

  .glow-edge.net-lit :global(.svelte-flow__edge-path) {
    filter: drop-shadow(0 0 4px var(--mf-accent, #5b8def));
  }

  :global(.svelte-flow__edge-label.mf-net-label) {
    z-index: 2000 !important;
    padding: 0 !important;
    background: transparent !important;
    /* The wrapper stays centred on the stub end while the tag is shifted outward; only the tag takes the pointer, so the handle stays draggable. */
    pointer-events: none !important;
  }

  :global(.svelte-flow__edge-label.mf-net-label .net-tag) {
    pointer-events: auto;
  }
</style>
