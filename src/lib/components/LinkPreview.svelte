<!--
  Hover preview for links to other pages/nodes (Notion/Obsidian style).
  Any element with data-wikilink="ref", or data-preview-canvas="id" (+ optional data-preview-node="id"), gets a preview.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { FileText, Unlink, MousePointerClick } from 'lucide-svelte';
  import { renderMarkdown } from '@mosaicflow/node-sdk';
  import type { IndexedNode } from '@mosaicflow/vault-core';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import CanvasMiniMap from './CanvasMiniMap.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { resolveWikilink, type LinkTarget } from '$lib/services/navigation';
  import { nodeRegistry, getIconComponent } from '$lib/kernel/registries/node-registry';
  import { formatRelativeTime } from '$lib/services/vaultService';

  const SELECTOR = '[data-wikilink], [data-preview-canvas]';
  const SWITCH_DELAY = 120;
  const HIDE_DELAY = 200;
  const WIDTH = 340;
  const EST_HEIGHT = 320;

  let anchor: HTMLElement | null = null;
  let target = $state<LinkTarget | null>(null);
  let missingRef = $state<string | null>(null);
  let visible = $state(false);
  let placement = $state('');
  let card = $state<HTMLDivElement>();
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  let currentCanvasId = $derived(vaultStore.currentCanvas?.id);
  let layout = $derived(visible && target ? knowledge.canvasLayout(target.canvas.id) : []);
  let excerpt = $derived(target?.node ? excerptOf(target.node) : '');

  $effect(() => {
    void currentCanvasId;
    hide();
  });

  function excerptOf(node: IndexedNode): string {
    const field = nodeRegistry.getBodyMapping(node.type).field;
    const raw = typeof node.data[field] === 'string' && node.data[field]
      ? String(node.data[field])
      : node.text.startsWith(node.title) ? node.text.slice(node.title.length) : node.text;
    let text = raw.trim();
    const firstLine = text.split('\n', 1)[0];
    if (/^#{1,6}\s/.test(firstLine) && firstLine.replace(/^#+\s*/, '').trim().toLowerCase() === node.title.toLowerCase()) {
      text = text.slice(firstLine.length).trim();
    }
    return text ? renderMarkdown(text.length > 700 ? `${text.slice(0, 700)}…` : text) : '';
  }

  function resolve(el: HTMLElement): { target: LinkTarget | null; missing: string | null } {
    const ref = el.dataset.wikilink;
    if (ref !== undefined) {
      const hit = resolveWikilink(ref);
      return { target: hit, missing: hit ? null : ref };
    }
    const canvas = vaultStore.canvases.find((c) => c.id === el.dataset.previewCanvas);
    if (!canvas) return { target: null, missing: null };
    const nodeId = el.dataset.previewNode;
    const node = nodeId ? knowledge.index.nodes.find((n) => n.canvasId === canvas.id && n.id === nodeId) ?? null : null;
    return { target: { canvas, node }, missing: null };
  }

  function show(el: HTMLElement) {
    if (!el.isConnected) return;
    const result = resolve(el);
    if (!result.target && !result.missing) return;
    anchor = el;
    target = result.target;
    missingRef = result.missing;

    const rect = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - WIDTH - 8);
    placement = window.innerHeight - rect.bottom > EST_HEIGHT || rect.top < EST_HEIGHT
      ? `left: ${left}px; top: ${rect.bottom + 6}px;`
      : `left: ${left}px; bottom: ${window.innerHeight - rect.top + 6}px;`;
    clearTimeout(hideTimer);
    visible = true;
  }

  function hide() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    visible = false;
    anchor = null;
  }

  function handlePointerOver(e: PointerEvent) {
    const el = e.target as Element | null;
    if (!el) return;
    if (card?.contains(el)) {
      clearTimeout(hideTimer);
      return;
    }
    const link = el.closest<HTMLElement>(SELECTOR);
    if (link && link === anchor) {
      clearTimeout(hideTimer);
      return;
    }
    clearTimeout(showTimer);
    if (link && settings.current.general.hoverPreviews) {
      showTimer = setTimeout(() => show(link), visible ? SWITCH_DELAY : settings.current.general.previewDelay);
    }
    if (visible) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_DELAY);
    }
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('wheel', hide, { capture: true, passive: true });
    document.addEventListener('keydown', onKey, true);
    return () => {
      hide();
      document.removeEventListener('pointerover', handlePointerOver, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('wheel', hide, true);
      document.removeEventListener('keydown', onKey, true);
    };
  });
</script>

{#if visible}
  <div class="page-peek" bind:this={card} style={placement} role="tooltip">
    {#if target}
      {@const node = target.node}
      <header class="lp-crumb">
        <FileText size={12} />
        <span class="lp-canvas">{target.canvas.name}</span>
        {#if node}
          <span class="lp-sep">/</span>
          <span class="lp-crumb-node">{node.title || 'Untitled'}</span>
        {/if}
        {#if target.canvas.id === currentCanvasId}
          <span class="lp-badge">This page</span>
        {/if}
      </header>

      <div class="lp-body">
        {#if node}
          {@const Icon = getIconComponent(node.type)}
          <span class="lp-type"><Icon size={11} />{nodeRegistry.get(node.type)?.label ?? node.type}</span>
          <h4 class="lp-title">{node.title || 'Untitled'}</h4>
          {#if excerpt}
            <div class="lp-excerpt markdown-content">{@html excerpt}</div>
          {/if}
          {#if node.tags.length}
            <div class="lp-tags">
              {#each node.tags.slice(0, 6) as tag (tag)}<span>#{tag}</span>{/each}
            </div>
          {/if}
        {:else}
          <span class="lp-type"><FileText size={11} />Page</span>
          <h4 class="lp-title">{target.canvas.name}</h4>
          {#if target.canvas.description}
            <p class="lp-desc">{target.canvas.description}</p>
          {/if}
        {/if}
      </div>

      {#if layout.length > 0}
        <CanvasMiniMap nodes={layout} highlight={node?.id} class="lp-map" />
      {/if}

      <footer class="lp-footer">
        <span>{layout.length} node{layout.length === 1 ? '' : 's'} · edited {formatRelativeTime(target.canvas.updated_at)}</span>
        <span class="lp-hint"><MousePointerClick size={11} />Click to open</span>
      </footer>
    {:else}
      <div class="lp-missing">
        <Unlink size={13} />
        <span>No page or node named <strong>{missingRef}</strong></span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .page-peek {
    position: fixed;
    z-index: 2000;
    width: 340px;
    overflow: hidden;
    border: 1px solid var(--mf-border-strong);
    border-radius: 10px;
    background: var(--mf-surface-2);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
    animation: lp-in 0.12s ease-out;
  }

  @keyframes lp-in {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: none; }
  }

  .lp-crumb {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    border-bottom: 1px solid var(--mf-border);
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .lp-canvas,
  .lp-crumb-node {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lp-canvas {
    color: var(--mf-text-2);
  }

  .lp-sep {
    opacity: 0.6;
  }

  .lp-badge {
    flex-shrink: 0;
    margin-left: auto;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
    font-size: 10px;
    line-height: 16px;
  }

  .lp-body {
    padding: 10px 12px 8px;
  }

  .lp-type {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: var(--mf-text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .lp-title {
    margin: 2px 0 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .lp-excerpt {
    position: relative;
    max-height: 120px;
    margin-top: 6px;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.5;
    color: var(--mf-text-2);
    mask-image: linear-gradient(to bottom, #000 70%, transparent);
  }

  .lp-excerpt :global(:is(h1, h2, h3, h4)) {
    margin: 4px 0 2px;
    font-size: 12.5px;
    color: var(--mf-text);
  }

  .lp-excerpt :global(p) {
    margin: 0 0 4px;
  }

  .lp-excerpt :global(pre) {
    padding: 6px 8px;
    border-radius: 4px;
    background: var(--mf-surface);
    font-size: 11px;
  }

  .lp-desc {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--mf-text-2);
  }

  .lp-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .lp-tags span {
    padding: 0 6px;
    border-radius: 4px;
    background: var(--mf-active);
    color: var(--mf-text-2);
    font-size: 11px;
    line-height: 18px;
  }

  .page-peek :global(.lp-map) {
    width: calc(100% - 16px);
    height: 120px;
    margin: 2px 8px 0;
  }

  .lp-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 12px 8px;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .lp-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .lp-missing {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    color: var(--mf-text-2);
  }

  .lp-missing strong {
    color: var(--mf-text);
    font-weight: 500;
  }
</style>
