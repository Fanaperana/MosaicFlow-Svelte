<script lang="ts">
  import PropertiesPanel from './PropertiesPanel.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';

  let { onClose }: { onClose: () => void } = $props();

  const WIDTH = 288;
  const GAP = 12;
  const MARGIN = 8;

  const target = $derived(
    workspace.selectedNodeIds.length === 1
      ? { id: workspace.selectedNodeIds[0], edge: false }
      : workspace.selectedEdgeIds.length === 1
        ? { id: workspace.selectedEdgeIds[0], edge: true }
        : null,
  );

  let pos = $state<{ left: number; top: number } | null>(null);

  // Follows the selection while the canvas pans, zooms or the node moves.
  $effect(() => {
    void workspace.viewport;
    void workspace.nodes;
    const t = target;
    if (!t) {
      pos = null;
      return;
    }
    const frame = requestAnimationFrame(() => {
      const kind = t.edge ? 'edge' : 'node';
      const el = document.querySelector(`.svelte-flow__${kind}[data-id="${CSS.escape(t.id)}"]`);
      if (!el) {
        pos = null;
        return;
      }
      const r = el.getBoundingClientRect();
      let left = r.right + GAP;
      if (left + WIDTH > window.innerWidth - MARGIN) left = r.left - GAP - WIDTH;
      if (left < MARGIN) left = window.innerWidth - WIDTH - MARGIN;
      const top = Math.min(Math.max(MARGIN, r.top), window.innerHeight - 240);
      pos = { left, top };
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

{#if pos}
  <div class="properties-popover" style="left: {pos.left}px; top: {pos.top}px; max-height: calc(100vh - {pos.top + MARGIN}px)">
    <PropertiesPanel {onClose} variant="popover" />
  </div>
{/if}

<style>
  .properties-popover {
    position: fixed;
    z-index: 30;
    display: flex;
  }
</style>
