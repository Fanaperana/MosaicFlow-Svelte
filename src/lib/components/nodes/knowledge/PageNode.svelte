<!-- Page link: a card that opens another page (canvas) of the vault, with a live outline of it. -->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import { FileText, ArrowUpRight, RefreshCw } from 'lucide-svelte';
  import NodeWrapper from '../_shared/NodeWrapper.svelte';
  import CanvasMiniMap from '$lib/components/CanvasMiniMap.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { formatRelativeTime, type CanvasInfo } from '$lib/services/vaultService';
  import type { BaseNodeData } from '$lib/types';

  type PageData = BaseNodeData & { canvasId?: string; page?: string };
  let { data, selected, id }: NodeProps<Node<PageData, 'page'>> = $props();

  let picking = $state(false);

  // Prefer the stable id; fall back to the name so links survive vault imports.
  let target = $derived(
    vaultStore.canvases.find((c) => c.id === data.canvasId) ??
      vaultStore.canvases.find((c) => !!data.page && c.name.toLowerCase() === data.page.toLowerCase())
  );
  let choices = $derived(vaultStore.canvases.filter((c) => c.id !== vaultStore.currentCanvas?.id));
  let layout = $derived(target ? knowledge.canvasLayout(target.id) : []);

  function choose(canvas: CanvasInfo) {
    picking = false;
    workspace.updateNodeData(id, { canvasId: canvas.id, page: canvas.name, title: canvas.name });
  }

  function open() {
    if (target && target.id !== vaultStore.currentCanvas?.id) vaultStore.openCanvas(target);
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="page">
  {#if target && !picking}
    <div class="page">
      <button class="page-head nodrag" data-nav onclick={open} data-preview-canvas={target.id} title="Open page">
        <FileText size={16} />
        <span class="name">{target.name}</span>
        <ArrowUpRight size={14} class="go" />
      </button>
      {#if layout.length > 0}
        <CanvasMiniMap nodes={layout} class="page-map" />
      {/if}
      <div class="meta">
        <span>{layout.length} node{layout.length === 1 ? '' : 's'} · edited {formatRelativeTime(target.updated_at)}</span>
        <button class="relink nodrag" onclick={() => (picking = true)} title="Link a different page"><RefreshCw size={11} /></button>
      </div>
    </div>
  {:else}
    <div class="picker nodrag nowheel">
      <p class="picker-title">{data.page && !target ? `"${data.page}" was not found. Link a page:` : 'Link to a page'}</p>
      {#each choices as canvas (canvas.id)}
        <button class="choice" onclick={() => choose(canvas)}>
          <FileText size={13} /><span>{canvas.name}</span>
        </button>
      {:else}
        <p class="empty">Create another page first.</p>
      {/each}
    </div>
  {/if}
</NodeWrapper>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
  }

  .page-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 6px;
    border-radius: 6px;
    background: transparent;
    color: var(--mf-text);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
  }

  .page-head:hover {
    background: var(--mf-hover);
  }

  .page-head :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .page-head :global(.go) {
    margin-left: auto;
    opacity: 0;
  }

  .page-head:hover :global(.go) {
    opacity: 1;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: underline;
    text-decoration-color: var(--mf-border-strong);
    text-underline-offset: 3px;
  }

  .page :global(.page-map) {
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .relink {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .relink:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .picker {
    display: flex;
    flex-direction: column;
    gap: 1px;
    height: 100%;
    overflow-y: auto;
  }

  .picker-title,
  .empty {
    margin: 0;
    padding: 2px 6px 6px;
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 6px;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-2);
    font-size: 12.5px;
    text-align: left;
  }

  .choice:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .choice span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
