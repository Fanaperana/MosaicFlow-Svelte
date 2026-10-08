<!--
  Host for a plugin sidebar panel: header, resizable width, and the plugin's
  render(container, ctx) / update(ctx) / destroy() lifecycle.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { TriangleAlert, X } from 'lucide-svelte';
  import { getIconByName } from '$lib/kernel/registries/node-registry';
  import type { PanelContext, PanelRegistration } from '$lib/kernel/registries/panel-registry';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { openWikilink } from '$lib/services/navigation';
  import { renderMarkdown } from '@mosaicflow/node-sdk';

  let { panel }: { panel: PanelRegistration } = $props();

  type Handle = { update?: (ctx: PanelContext) => void; destroy?: () => void };

  const WIDTH_KEY = 'mosaicflow:panel-width';
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 640;

  let container = $state<HTMLDivElement>();
  let error = $state<string | null>(null);
  let width = $state(untrack(() => storedWidth(panel)));
  let handle: Handle | undefined;

  let Icon = $derived(getIconByName(panel.iconName ?? 'Puzzle'));

  function storedWidth(p: PanelRegistration): number {
    const saved = Number(localStorage.getItem(`${WIDTH_KEY}:${p.id}`));
    return clamp(saved || p.defaultWidth || 300);
  }

  function clamp(w: number) {
    return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));
  }

  function context(): PanelContext {
    const page = vaultStore.currentCanvas;
    return {
      page: page ? { id: page.id, name: page.name } : null,
      renderMarkdown,
      openWikilink: (ref) => void openWikilink(ref),
      close: () => (ui.openPanel = null),
    };
  }

  function fail(e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`[Plugin panel ${panel.id}]`, e);
  }

  $effect(() => {
    const el = container;
    const render = panel.render;
    if (!el) return;
    untrack(() => {
      error = null;
      try {
        handle = render(el, context()) ?? undefined;
      } catch (e) {
        fail(e);
      }
    });
    return () => {
      try {
        handle?.destroy?.();
      } catch (e) {
        console.error(`[Plugin panel ${panel.id}] destroy failed`, e);
      }
      handle = undefined;
      el.replaceChildren();
    };
  });

  // Page switches and node/edge edits; batched so dragging doesn't update on every frame.
  $effect(() => {
    void vaultStore.currentCanvas?.id;
    void workspace.nodes;
    void workspace.edges;
    const timer = setTimeout(() => {
      try {
        handle?.update?.(context());
      } catch (e) {
        fail(e);
      }
    }, 150);
    return () => clearTimeout(timer);
  });

  function startResize(e: PointerEvent) {
    const startX = e.clientX;
    const startWidth = width;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => (width = clamp(startWidth + startX - ev.clientX));
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      localStorage.setItem(`${WIDTH_KEY}:${panel.id}`, String(width));
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }
</script>

<aside class="plugin-panel" style:width="{width}px" aria-label={panel.label}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="resize" onpointerdown={startResize} ondblclick={() => (width = clamp(panel.defaultWidth ?? 300))}></div>
  <header>
    <span class="title"><Icon size={13} />{panel.label}</span>
    <button class="icon-btn" onclick={() => (ui.openPanel = null)} aria-label="Close {panel.label}"><X size={14} /></button>
  </header>
  {#if error}
    <div class="panel-error"><TriangleAlert size={14} /><span>{error}</span></div>
  {/if}
  <div class="panel-root" bind:this={container} class:hidden={!!error}></div>
</aside>

<style>
  .plugin-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100vh;
    border-left: 1px solid var(--mf-border);
    background: var(--mf-surface);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
  }

  .resize {
    position: absolute;
    left: -3px;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: 6px;
    cursor: col-resize;
  }

  .resize:hover {
    background: var(--mf-accent-soft);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 6px 0 12px;
    border-bottom: 1px solid var(--mf-border);
  }

  .title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--mf-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
    cursor: pointer;
  }

  .icon-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .panel-root {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .panel-root.hidden {
    display: none;
  }

  .panel-error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 12px;
    color: var(--mf-danger);
    font-size: 12px;
    line-height: 1.4;
  }
</style>
