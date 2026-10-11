<!--
  Net labels on a node's sides. Several labels on one side stack with a small gap; drag a label up or
  down in its stack to reorder. Hovering lights the whole net and opens the list of its other labels.
-->
<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import { netHover, nodeNetLabels } from '$lib/stores/net-hover.svelte';
  import NetTag from './NetTag.svelte';
  import type { NodeNetLabel, NodeSide } from '$lib/types';

  let { nodeId }: { nodeId: string } = $props();

  const SIDES: NodeSide[] = ['left', 'right', 'top', 'bottom'];
  const DRAG_THRESHOLD = 4;

  const node = $derived(workspace.getNode(nodeId));
  const labels = $derived(nodeNetLabels(node?.data));
  const color = $derived((node?.data.borderColor as string | undefined) || 'var(--mf-accent, #5b8def)');

  let dragging = $state<{ id: string; side: NodeSide; over: number } | null>(null);
  let pending: { id: string; side: NodeSide; y: number; stack: HTMLElement } | null = null;

  function onPointerDown(e: PointerEvent, label: NodeNetLabel) {
    if (workspace.locked || e.button !== 0) return;
    e.stopPropagation();
    pending = { id: label.id, side: label.side, y: e.clientY, stack: (e.currentTarget as HTMLElement).parentElement! };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function onPointerMove(e: PointerEvent) {
    if (!pending) return;
    if (!dragging && Math.abs(e.clientY - pending.y) < DRAG_THRESHOLD) return;
    netHover.close();
    // The slot whose middle is above the pointer: tags are stacked top to bottom on every side.
    const tags = [...pending.stack.children] as HTMLElement[];
    const over = tags.filter((t) => {
      const r = t.getBoundingClientRect();
      return r.top + r.height / 2 < e.clientY;
    }).length;
    dragging = { id: pending.id, side: pending.side, over };
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    const drag = dragging;
    pending = null;
    dragging = null;
    if (!drag) return;
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

{#each SIDES as side (side)}
  {@const stack = labels.filter((l) => l.side === side)}
  {#if stack.length}
    <div class="net-stack side-{side} nodrag nopan" style="--c: {color}">
      {#each stack as label, i (label.id)}
        <NetTag
          name={label.name}
          {side}
          end={label.end}
          {color}
          lit={netHover.name === label.name}
          class="{dragging?.id === label.id ? 'dragging' : ''} {dragging && dragging.side === side && dragging.over === i ? 'drop-before' : ''} {dragging && dragging.side === side && dragging.over === stack.length && i === stack.length - 1 ? 'drop-after' : ''}"
          onpointerdown={(e) => onPointerDown(e, label)}
          onmouseenter={(e) => !dragging && netHover.enter(label.name, `node:${nodeId}:${label.id}`, e.currentTarget)}
          onmouseleave={() => netHover.leave()}
          title="Drag to reorder"
        />
      {/each}
    </div>
  {/if}
{/each}

<style>
  /* Each stack sits just outside its side, joined to the node by a short stub. */
  .net-stack {
    position: absolute;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .net-stack::before {
    content: '';
    position: absolute;
    background: var(--c);
  }

  .side-right {
    left: calc(100% + 14px);
    top: 50%;
    transform: translateY(-50%);
    align-items: flex-start;
  }

  .side-right::before {
    left: -14px;
    top: 50%;
    width: 14px;
    height: 1.5px;
  }

  .side-left {
    right: calc(100% + 14px);
    top: 50%;
    transform: translateY(-50%);
    align-items: flex-end;
  }

  .side-left::before {
    right: -14px;
    top: 50%;
    width: 14px;
    height: 1.5px;
  }

  .side-top {
    bottom: calc(100% + 14px);
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
  }

  .side-top::before {
    bottom: -14px;
    left: 50%;
    width: 1.5px;
    height: 14px;
  }

  .side-bottom {
    top: calc(100% + 14px);
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
  }

  .side-bottom::before {
    top: -14px;
    left: 50%;
    width: 1.5px;
    height: 14px;
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
</style>
