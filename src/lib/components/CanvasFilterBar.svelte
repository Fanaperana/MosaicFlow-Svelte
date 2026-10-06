<script lang="ts">
  import { Filter, X, Bookmark, BookmarkCheck, Tags } from 'lucide-svelte';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';

  let open = $state(false);
  let input = $state<HTMLInputElement | null>(null);

  const canvasId = $derived(vaultStore.currentCanvas?.id);
  const matches = $derived(knowledge.matchingNodeIds(canvasId));
  const tags = $derived(canvasId ? knowledge.index.tagCounts(canvasId).slice(0, 12) : []);
  const saved = $derived(workspace.settings.savedFilters ?? []);
  const isSaved = $derived(saved.includes(knowledge.filter.trim()));

  // Fade every node that does not match; groups stay visible as context.
  const css = $derived.by(() => {
    if (!matches) return '';
    const ids = [...matches].map((id) => `[data-id="${CSS.escape(id)}"]`).join(',');
    return `.svelte-flow .svelte-flow__node:not(.svelte-flow__node-group)${ids ? `:not(${ids})` : ''}{opacity:.15;transition:opacity .2s}` +
      (ids ? `.svelte-flow :is(${ids}).svelte-flow__node{filter:drop-shadow(0 0 10px rgba(91,141,239,.5))}` : '');
  });

  $effect(() => {
    if (knowledge.filter) open = true;
  });

  function toggleSaved() {
    const q = knowledge.filter.trim();
    if (!q) return;
    const next = isSaved ? saved.filter((s) => s !== q) : [...saved, q];
    workspace.settings = { ...workspace.settings, savedFilters: next };
    workspace.saveWorkspaceManifest();
  }

  function close() {
    knowledge.filter = '';
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  }

  function toggleOpen() {
    open = !open;
    if (open) requestAnimationFrame(() => input?.focus());
    else knowledge.filter = '';
  }
</script>

<svelte:head>
  {#if css}
    {@html `<style id="mf-filter">${css}</style>`}
  {/if}
</svelte:head>

<div class="filter-bar" class:open>
  <button class="icon-btn" onclick={toggleOpen} title="Filter nodes by text or #tag" aria-label="Filter nodes">
    <Filter size={14} />
  </button>
  {#if open}
    <input
      bind:this={input}
      bind:value={knowledge.filter}
      onkeydown={onKeydown}
      placeholder="Filter: words or #tag"
      spellcheck="false"
    />
    {#if knowledge.filter}
      <span class="count">{matches?.size ?? 0}</span>
      <button class="icon-btn" onclick={toggleSaved} title={isSaved ? 'Remove saved filter' : 'Save filter'} aria-label="Save filter">
        {#if isSaved}<BookmarkCheck size={14} />{:else}<Bookmark size={14} />{/if}
      </button>
      <button class="icon-btn" onclick={close} title="Clear filter (Esc)" aria-label="Clear filter"><X size={14} /></button>
    {/if}
  {/if}
</div>

{#if open && (saved.length > 0 || tags.length > 0)}
  <div class="chips">
    {#each saved as q (q)}
      <button class="chip saved" class:active={knowledge.filter.trim() === q} onclick={() => (knowledge.filter = knowledge.filter.trim() === q ? '' : q)}>
        <Bookmark size={11} />{q}
      </button>
    {/each}
    {#if tags.length > 0}
      <span class="chips-label"><Tags size={11} /></span>
      {#each tags as { tag, count } (tag)}
        <button class="chip" class:active={knowledge.activeTag === tag} onclick={() => knowledge.toggleTag(tag)}>
          #{tag}<span class="chip-count">{count}</span>
        </button>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .filter-bar {
    position: absolute;
    top: 52px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--mf-surface);
    border: 1px solid var(--mf-border-strong);
    font-family: var(--mf-font-ui);
  }

  .filter-bar input {
    width: 190px;
    height: 24px;
    padding: 0 6px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--mf-text);
    font-size: 12.5px;
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--mf-text-2);
    cursor: pointer;
  }

  .icon-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .count {
    font-size: 11px;
    color: var(--mf-text-3);
    padding: 0 4px;
  }

  .chips {
    position: absolute;
    top: 90px;
    right: 12px;
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
    max-width: 420px;
    font-family: var(--mf-font-ui);
  }

  .chips-label {
    display: grid;
    place-items: center;
    color: var(--mf-text-3);
    padding: 0 2px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid var(--mf-border-strong);
    background: var(--mf-surface);
    color: var(--mf-text-2);
    font-size: 11.5px;
    cursor: pointer;
  }

  .chip:hover,
  .chip.active {
    color: var(--mf-text);
    border-color: rgba(91, 141, 239, 0.6);
    background: var(--mf-accent-soft);
  }

  .chip.saved {
    color: #c4b5fd;
  }

  .chip-count {
    color: var(--mf-text-3);
    font-size: 10.5px;
  }
</style>
