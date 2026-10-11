<!--
  Net labels on a node's sides, each wired to the side's connection point with a bezier. Labels on one
  side stack with a small gap (columns on left/right, rows on top/bottom); drag a label along its stack
  to reorder. The selected label's connection point can be dragged to another side or another node's
  handle. Hovering lights the whole net and opens the list of its other labels.
-->
<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import { netHover, netMembers, nodeNetLabels } from '$lib/stores/net-hover.svelte';
  import NetTag from './NetTag.svelte';
  import type { NodeNetLabel, NodeSide } from '$lib/types';

  let { nodeId }: { nodeId: string } = $props();

  const SIDES: NodeSide[] = ['left', 'right', 'top', 'bottom'];
  const DRAG_THRESHOLD = 4;
  const NORMAL: Record<NodeSide, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

  const node = $derived(workspace.getNode(nodeId));
  const labels = $derived(nodeNetLabels(node?.data));
  const color = $derived((node?.data.borderColor as string | undefined) || 'var(--mf-accent, #5b8def)');
  const selectedId = $derived(workspace.selectedNetLabel?.nodeId === nodeId ? workspace.selectedNetLabel.labelId : null);
  // Labels whose name no other node carries: a net needs at least a pair.
  const orphans = $derived(new Set(labels.filter((l) => !netMembers(l.name).some((m) => m.nodeId !== nodeId)).map((l) => l.id)));

  let root = $state<HTMLDivElement>();
  let size = $state({ w: 0, h: 0 });
  /** Inner end of each tag (where its wire arrives), in node-local CSS pixels. */
  let anchors = $state<Record<string, { x: number; y: number }>>({});

  let dragging = $state<{ id: string; side: NodeSide; over: number } | null>(null);
  let pending: { id: string; side: NodeSide; at: number; stack: HTMLElement } | null = null;

  /** Moving the selected label's connection point. */
  let rewire = $state<{ id: string; x: number; y: number; target: { nodeId: string; side: NodeSide } | null } | null>(null);

  const along = (side: NodeSide) => (side === 'top' || side === 'bottom' ? 'x' : 'y');

  function sidePoint(side: NodeSide) {
    return { left: { x: 0, y: size.h / 2 }, right: { x: size.w, y: size.h / 2 }, top: { x: size.w / 2, y: 0 }, bottom: { x: size.w / 2, y: size.h } }[side];
  }

  // The grab dot sits a little way out along the wire, like an edge's, so the node's handle stays free.
  function alongWire(side: NodeSide) {
    const p = sidePoint(side);
    const [nx, ny] = NORMAL[side];
    return { x: p.x + nx * 12, y: p.y + ny * 12 };
  }

  function wire(from: { x: number; y: number }, side: NodeSide, to: { x: number; y: number }) {
    const [nx, ny] = NORMAL[side];
    const d = Math.max(14, Math.hypot(to.x - from.x, to.y - from.y) * 0.45);
    return `M ${from.x} ${from.y} C ${from.x + nx * d} ${from.y + ny * d} ${to.x - nx * d} ${to.y - ny * d} ${to.x} ${to.y}`;
  }

  function scaleOf(el: HTMLElement) {
    return el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
  }

  function measure() {
    if (!root) return;
    const rr = root.getBoundingClientRect();
    const scale = scaleOf(root);
    const out: Record<string, { x: number; y: number }> = {};
    for (const el of root.querySelectorAll<HTMLElement>('[data-label-id]')) {
      const r = el.getBoundingClientRect();
      const side = el.dataset.side as NodeSide;
      const x = side === 'right' ? r.left : side === 'left' ? r.right : r.left + r.width / 2;
      const y = side === 'bottom' ? r.top : side === 'top' ? r.bottom : r.top + r.height / 2;
      out[el.dataset.labelId!] = { x: (x - rr.left) / scale, y: (y - rr.top) / scale };
    }
    size = { w: root.offsetWidth, h: root.offsetHeight };
    anchors = out;
  }

  $effect(() => {
    void labels;
    void node?.width;
    void node?.height;
    if (!root || !labels.length) return;
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    for (const el of root.querySelectorAll('[data-label-id]')) observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });

  function onPointerDown(e: PointerEvent, label: NodeNetLabel) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const axis = along(label.side);
    pending = { id: label.id, side: label.side, at: axis === 'x' ? e.clientX : e.clientY, stack: (e.currentTarget as HTMLElement).parentElement! };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function onPointerMove(e: PointerEvent) {
    if (!pending || workspace.locked) return;
    const horizontal = along(pending.side) === 'x';
    const at = horizontal ? e.clientX : e.clientY;
    if (!dragging && Math.abs(at - pending.at) < DRAG_THRESHOLD) return;
    netHover.close();
    // The slot whose middle is before the pointer along the stack.
    const tags = [...pending.stack.children] as HTMLElement[];
    const over = tags.filter((t) => {
      const r = t.getBoundingClientRect();
      return (horizontal ? r.left + r.width / 2 : r.top + r.height / 2) < at;
    }).length;
    dragging = { id: pending.id, side: pending.side, over };
  }

  function startRewire(e: PointerEvent, id: string) {
    if (e.button !== 0 || workspace.locked || !root) return;
    e.stopPropagation();
    e.preventDefault();
    netHover.close();
    const move = (ev: PointerEvent) => {
      if (!root) return;
      const rr = root.getBoundingClientRect();
      const scale = scaleOf(root);
      const x = (ev.clientX - rr.left) / scale;
      const y = (ev.clientY - rr.top) / scale;
      const handle = document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => el.classList.contains('svelte-flow__handle')) as HTMLElement | undefined;
      const other = handle?.dataset.nodeid && handle.dataset.nodeid !== nodeId ? handle : undefined;
      const nearest = SIDES.reduce((best, s) => {
        const p = sidePoint(s);
        return Math.hypot(p.x - x, p.y - y) < Math.hypot(sidePoint(best).x - x, sidePoint(best).y - y) ? s : best;
      }, SIDES[0]);
      rewire = {
        id,
        x,
        y,
        target: other ? { nodeId: other.dataset.nodeid!, side: other.dataset.handlepos as NodeSide } : { nodeId, side: nearest },
      };
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      const done = rewire;
      rewire = null;
      if (done?.target) moveLabel(done.id, done.target.nodeId, done.target.side);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  function moveLabel(id: string, toNode: string, side: NodeSide) {
    const label = labels.find((l) => l.id === id);
    if (!label || (toNode === nodeId && label.side === side)) return;
    workspace.saveToHistory();
    const rest = labels.filter((l) => l.id !== id);
    if (toNode === nodeId) {
      workspace.setNetLabels(nodeId, [...rest, { ...label, side }]);
      return;
    }
    const target = nodeNetLabels(workspace.getNode(toNode)?.data);
    workspace.setNetLabels(nodeId, rest);
    if (!target.some((l) => l.name === label.name && l.side === side)) workspace.setNetLabels(toNode, [...target, { ...label, side }]);
    workspace.selectNetLabel(toNode, id);
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    const drag = dragging;
    const clicked = pending?.id;
    pending = null;
    dragging = null;
    if (!drag) {
      if (clicked) workspace.selectNetLabel(nodeId, clicked);
      return;
    }
    const side = labels.filter((l) => l.side === drag.side);
    const from = side.findIndex((l) => l.id === drag.id);
    const moved = side[from];
    const reordered = side.filter((l) => l.id !== drag.id);
    reordered.splice(drag.over > from ? drag.over - 1 : drag.over, 0, moved);
    if (reordered.every((l, i) => l.id === side[i].id)) return;
    workspace.saveToHistory();
    workspace.setNetLabels(nodeId, [...labels.filter((l) => l.side !== drag.side), ...reordered]);
  }
</script>

{#if labels.length}
  <div class="net-root" bind:this={root}>
    <svg class="net-wires" aria-hidden="true">
      {#each labels as label (label.id)}
        {@const a = anchors[label.id]}
        {#if a && size.w}
          {@const from = rewire?.id === label.id ? { x: rewire.x, y: rewire.y } : sidePoint(label.side)}
          <path
            class:lit={netHover.name === label.name}
            class:moving={rewire?.id === label.id}
            style:--c={label.color || color}
            d={wire(from, rewire?.id === label.id ? (rewire.target?.nodeId === nodeId ? rewire.target.side : label.side) : label.side, a)}
          />
        {/if}
      {/each}
      {#each SIDES as side (side)}
        {#if size.w && labels.some((l) => l.side === side)}
          {@const p = sidePoint(side)}
          <circle class="port" cx={p.x} cy={p.y} r="3" style:--c={color} />
        {/if}
      {/each}
      {#each labels as label (label.id)}
        {@const a = anchors[label.id]}
        {#if a}
          <circle class="label-port" cx={a.x} cy={a.y} r="2.5" style:--c={label.color || color} />
        {/if}
      {/each}
      {#if rewire?.target?.nodeId === nodeId}
        {@const p = sidePoint(rewire.target.side)}
        <circle class="port-target" cx={p.x} cy={p.y} r="7" />
      {/if}
    </svg>

    {#each SIDES as side (side)}
      {@const stack = labels.filter((l) => l.side === side)}
      {#if stack.length}
        <div class="net-stack side-{side} nodrag nopan">
          {#each stack as label, i (label.id)}
            <NetTag
              name={label.name}
              {side}
              end={label.end}
              endSide={label.endSide}
              color={label.color || color}
              textColor={label.textColor}
              bgColor={label.bgColor}
              fontSize={label.fontSize}
              lit={netHover.name === label.name}
              selected={selectedId === label.id}
              orphan={orphans.has(label.id)}
              data-label-id={label.id}
              data-side={side}
              class="{dragging?.id === label.id ? 'dragging' : ''} {dragging && dragging.side === side && dragging.over === i ? 'drop-before' : ''} {dragging && dragging.side === side && dragging.over === stack.length && i === stack.length - 1 ? 'drop-after' : ''}"
              onpointerdown={(e) => onPointerDown(e, label)}
              onclick={(e) => e.stopPropagation()}
              onmouseenter={(e) => !dragging && !rewire && netHover.enter(label.name, `node:${nodeId}:${label.id}`, e.currentTarget)}
              onmouseleave={() => netHover.leave()}
              title={orphans.has(label.id) ? 'No other node has this label yet: add it to another node to link them' : 'Click to edit, drag to reorder'}
            />
          {/each}
        </div>
      {/if}
    {/each}

    {#if selectedId && size.w && !workspace.locked}
      {@const label = labels.find((l) => l.id === selectedId)}
      {#if label}
        {@const p = rewire?.id === label.id ? { x: rewire.x, y: rewire.y } : alongWire(label.side)}
        <button
          type="button"
          class="rewire-dot nodrag nopan"
          style:left="{p.x}px"
          style:top="{p.y}px"
          onpointerdown={(e) => startRewire(e, label.id)}
          onclick={(e) => e.stopPropagation()}
          title="Drag to another side or another node's connection point"
          aria-label="Move label connection"
        ></button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .net-root {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  .net-wires {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .net-wires path {
    fill: none;
    stroke: var(--c);
    stroke-width: 1.5px;
    transition: filter 0.15s;
  }

  .net-wires path.lit {
    filter: drop-shadow(0 0 4px var(--c));
  }

  .net-wires path.moving {
    stroke-dasharray: 5 4;
  }

  .port {
    fill: var(--c);
  }

  .port-target {
    fill: none;
    stroke: var(--mf-accent, #5b8def);
    stroke-width: 2px;
  }

  /* Each stack sits outside its side, leaving room for the wires. */
  .net-stack {
    position: absolute;
    display: flex;
    gap: 2px;
    pointer-events: auto;
  }

  .side-right {
    left: calc(100% + 36px);
    top: 50%;
    transform: translateY(-50%);
    flex-direction: column;
    align-items: flex-start;
  }

  .side-left {
    right: calc(100% + 36px);
    top: 50%;
    transform: translateY(-50%);
    flex-direction: column;
    align-items: flex-end;
  }

  .side-top {
    bottom: calc(100% + 36px);
    left: 50%;
    transform: translateX(-50%);
    flex-direction: row;
    align-items: flex-end;
  }

  .side-bottom {
    top: calc(100% + 36px);
    left: 50%;
    transform: translateX(-50%);
    flex-direction: row;
    align-items: flex-start;
  }

  .label-port {
    fill: var(--c);
  }

  /* Same look as an edge's reconnect handle. */
  .rewire-dot {
    position: absolute;
    z-index: 2;
    width: 10px;
    height: 10px;
    padding: 0;
    border: 2px solid var(--mf-accent, #5b8def);
    border-radius: 50%;
    background: var(--mf-surface, #111318);
    box-shadow: 0 0 0 3px rgba(91, 141, 239, 0.25);
    transform: translate(-50%, -50%);
    cursor: grab;
    pointer-events: auto;
    transition: transform 0.1s;
  }

  .rewire-dot:hover {
    transform: translate(-50%, -50%) scale(1.3);
  }

  .rewire-dot:active {
    cursor: grabbing;
  }

  .net-stack :global(.net-tag.dragging) {
    opacity: 0.5;
  }

  .net-stack :global(.net-tag.drop-before) {
    box-shadow: 0 -2px 0 0 var(--mf-accent, #5b8def);
  }

  .net-stack :global(.net-tag.drop-after) {
    box-shadow: 0 2px 0 0 var(--mf-accent, #5b8def);
  }

  .side-top :global(.net-tag.drop-before),
  .side-bottom :global(.net-tag.drop-before) {
    box-shadow: -2px 0 0 0 var(--mf-accent, #5b8def);
  }

  .side-top :global(.net-tag.drop-after),
  .side-bottom :global(.net-tag.drop-after) {
    box-shadow: 2px 0 0 0 var(--mf-accent, #5b8def);
  }
</style>
