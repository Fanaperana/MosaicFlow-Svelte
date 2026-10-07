<!--
  Notion/Obsidian-style page tree: switch canvases of the current vault without leaving the canvas.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { FileText, Plus, Search, Pencil, Trash2, ChevronsLeft, LayoutGrid, Clock } from 'lucide-svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { pageNav } from '$lib/stores/pages.svelte';
  import type { CanvasInfo } from '$lib/services/vaultService';
  import VaultSwitcher from './VaultSwitcher.svelte';

  interface Props {
    onSearch: () => void;
    onNewCanvas: () => void;
    onAllPages: () => void;
  }

  let { onSearch, onNewCanvas, onAllPages }: Props = $props();

  let renamingId = $state<string | null>(null);
  let draftName = $state('');
  let renameInput = $state<HTMLInputElement>();

  let currentId = $derived(vaultStore.currentCanvas?.id);
  let recents = $derived(pageNav.recentCanvases.filter((c) => c.id !== currentId).slice(0, 4));

  function open(canvas: CanvasInfo) {
    if (renamingId === canvas.id || canvas.id === currentId) return;
    vaultStore.openCanvas(canvas);
  }

  async function startRename(canvas: CanvasInfo) {
    renamingId = canvas.id;
    draftName = canvas.name;
    await tick();
    renameInput?.select();
  }

  async function commitRename(canvas: CanvasInfo) {
    if (renamingId !== canvas.id) return;
    renamingId = null;
    await pageNav.renameCanvas(canvas, draftName);
  }

  async function remove(canvas: CanvasInfo) {
    if (confirm(`Delete "${canvas.name}"? This cannot be undone.`)) {
      await vaultStore.deleteCanvasById(canvas.path);
    }
  }
</script>

<aside class="pages-sidebar" aria-label="Pages">
  <div class="ps-top">
    <div class="ps-vault"><VaultSwitcher /></div>
    <button class="ps-icon-btn" onclick={() => pageNav.toggleSidebar(false)} title="Close sidebar (Ctrl+\)" aria-label="Close sidebar">
      <ChevronsLeft size={15} />
    </button>
  </div>

  <nav class="ps-actions">
    <button class="ps-row" onclick={onSearch}>
      <Search size={14} /><span class="ps-label">Search</span><kbd>Ctrl K</kbd>
    </button>
    <button class="ps-row" onclick={onAllPages}>
      <LayoutGrid size={14} /><span class="ps-label">All pages</span>
    </button>
  </nav>

  <div class="ps-scroll">
    {#if recents.length > 0}
      <div class="ps-section">
        <div class="ps-heading"><span>Recent</span></div>
        {#each recents as canvas (canvas.id)}
          <button class="ps-row" onclick={() => open(canvas)} title={canvas.name}>
            <Clock size={14} /><span class="ps-label">{canvas.name}</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="ps-section">
      <div class="ps-heading">
        <span>Pages</span>
        <span class="ps-count">{vaultStore.canvases.length}</span>
        <button class="ps-heading-btn" onclick={onNewCanvas} title="New page" aria-label="New page"><Plus size={13} /></button>
      </div>

      {#each vaultStore.canvases as canvas (canvas.id)}
        <div
          class="ps-row page"
          class:active={canvas.id === currentId}
          role="button"
          tabindex="0"
          aria-current={canvas.id === currentId ? 'page' : undefined}
          onclick={() => open(canvas)}
          ondblclick={() => startRename(canvas)}
          onkeydown={(e) => {
            if (renamingId === canvas.id) return;
            if (e.key === 'Enter') open(canvas);
            else if (e.key === 'F2') startRename(canvas);
          }}
        >
          <FileText size={14} />
          {#if renamingId === canvas.id}
            <input
              class="ps-rename"
              bind:this={renameInput}
              bind:value={draftName}
              onclick={(e) => e.stopPropagation()}
              onblur={() => commitRename(canvas)}
              onkeydown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitRename(canvas);
                if (e.key === 'Escape') renamingId = null;
              }}
            />
          {:else}
            <span class="ps-label" title={canvas.name}>{canvas.name}</span>
            <span class="ps-row-actions">
              <button onclick={(e) => { e.stopPropagation(); startRename(canvas); }} title="Rename (F2)" aria-label="Rename {canvas.name}"><Pencil size={12} /></button>
              <button class="danger" onclick={(e) => { e.stopPropagation(); remove(canvas); }} title="Delete" aria-label="Delete {canvas.name}"><Trash2 size={12} /></button>
            </span>
          {/if}
        </div>
      {/each}

      <button class="ps-row muted" onclick={onNewCanvas}>
        <Plus size={14} /><span class="ps-label">New page</span>
      </button>
    </div>
  </div>
</aside>

<style>
  .pages-sidebar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 236px;
    height: 100vh;
    border-right: 1px solid var(--mf-border);
    background: var(--mf-surface);
    color: var(--mf-text-2);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
    user-select: none;
  }

  .ps-top {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 36px;
    padding: 0 6px 0 6px;
    border-bottom: 1px solid var(--mf-border);
  }

  .ps-vault {
    flex: 1;
    min-width: 0;
  }

  .ps-vault :global(.trigger) {
    max-width: 100%;
  }

  .ps-icon-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
  }

  .ps-icon-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .ps-actions {
    display: flex;
    flex-direction: column;
    padding: 6px 6px 4px;
  }

  .ps-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 6px 12px;
    scrollbar-width: thin;
  }

  .ps-section {
    display: flex;
    flex-direction: column;
    padding-top: 8px;
  }

  .ps-heading {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--mf-text-3);
  }

  .ps-count {
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }

  .ps-heading-btn {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin-left: auto;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    opacity: 0;
    transition: opacity 0.12s;
  }

  .ps-section:hover .ps-heading-btn {
    opacity: 1;
  }

  .ps-heading-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .ps-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-2);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
    outline: none;
  }

  .ps-row :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .ps-row:hover,
  .ps-row:focus-visible {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .ps-row.active {
    background: var(--mf-active);
    color: var(--mf-text);
    font-weight: 500;
  }

  .ps-row.active :global(svg) {
    color: var(--mf-accent);
  }

  .ps-row.muted {
    color: var(--mf-text-3);
  }

  .ps-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  kbd {
    flex-shrink: 0;
    font-family: inherit;
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .ps-row-actions {
    display: none;
    align-items: center;
    gap: 1px;
  }

  .ps-row.page:hover .ps-row-actions,
  .ps-row.page:focus-within .ps-row-actions {
    display: flex;
  }

  .ps-row-actions button {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .ps-row-actions button:hover {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .ps-row-actions button.danger:hover {
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
  }

  .ps-rename {
    flex: 1;
    min-width: 0;
    height: 22px;
    padding: 0 6px;
    border: 1px solid var(--mf-accent);
    border-radius: 4px;
    background: var(--mf-surface-2);
    color: var(--mf-text);
    font-size: 12.5px;
  }
</style>
