<!--
  Local label picker, opened by dropping a connection on empty canvas and choosing "Local label".
  Search the labels already on the page, or type a new name and press Enter to create it.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Search, Plus, Tag } from 'lucide-svelte';
  import { netNames } from '$lib/stores/net-hover.svelte';

  interface Props {
    x: number;
    y: number;
    onPick: (name: string) => void;
    onClose: () => void;
  }

  let { x, y, onPick, onClose }: Props = $props();

  const WIDTH = 260;
  const MAX_HEIGHT = 320;

  let query = $state('');
  let active = $state(0);
  let input: HTMLInputElement | undefined = $state();
  let listEl: HTMLDivElement | undefined = $state();

  type Entry = { name: string; count: number; create?: boolean };

  const existing = netNames();
  const entries = $derived.by((): Entry[] => {
    const q = query.trim();
    const lower = q.toLowerCase();
    const matches = lower ? existing.filter((n) => n.name.toLowerCase().includes(lower)) : existing;
    const exact = existing.some((n) => n.name === q);
    return q && !exact ? [...matches, { name: q, count: 0, create: true }] : matches;
  });

  const style = $derived.by(() => {
    const left = Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8));
    return window.innerHeight - y > MAX_HEIGHT + 16
      ? `left: ${left}px; top: ${y + 4}px;`
      : `left: ${left}px; bottom: ${Math.max(8, window.innerHeight - y + 4)}px;`;
  });

  async function move(delta: number) {
    if (entries.length === 0) return;
    active = (active + delta + entries.length) % entries.length;
    await tick();
    listEl?.querySelector('.item.active')?.scrollIntoView({ block: 'nearest' });
  }

  function handleKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = entries[active];
      if (entry) onPick(entry.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  onMount(() => input?.focus());
</script>

<div class="overlay" role="presentation" onpointerdown={onClose} oncontextmenu={(e) => { e.preventDefault(); onClose(); }}></div>

<div class="picker" {style} role="dialog" aria-label="Local label">
  <div class="search">
    <Search size={14} />
    <input
      bind:this={input}
      bind:value={query}
      type="text"
      maxlength="64"
      placeholder="Find or create a label…"
      oninput={() => (active = 0)}
      onkeydown={handleKey}
      aria-label="Label name"
    />
  </div>

  <div class="list" bind:this={listEl} role="listbox">
    {#each entries as entry, i (entry.create ? '+' + entry.name : entry.name)}
      <button
        class="item"
        class:active={i === active}
        role="option"
        aria-selected={i === active}
        onpointerenter={() => (active = i)}
        onclick={() => onPick(entry.name)}
      >
        <span class="icon">
          {#if entry.create}<Plus size={14} />{:else}<Tag size={14} />{/if}
        </span>
        {#if entry.create}
          <span class="label">Create “{entry.name}”</span>
        {:else}
          <span class="label">{entry.name}</span>
          <span class="count">{entry.count}</span>
        {/if}
      </button>
    {:else}
      <p class="empty">No labels on this page yet. Type a name to create one.</p>
    {/each}
  </div>

  <footer>
    <span>Local label</span>
    <span class="keys"><kbd>↵</kbd> attach <kbd>esc</kbd> close</span>
  </footer>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
  }

  .picker {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    width: 260px;
    max-height: 320px;
    overflow: hidden;
    border: 1px solid var(--mf-border-strong);
    border-radius: 10px;
    background: var(--mf-surface-2);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
  }

  .search {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 10px;
    border-bottom: 1px solid var(--mf-border);
    color: var(--mf-text-3);
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mf-text);
    font-size: 13px;
    outline: none;
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
    scrollbar-width: thin;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text);
    font-size: 13px;
    text-align: left;
  }

  .item.active {
    background: var(--mf-hover);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 18px;
    color: var(--mf-text-2);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .empty {
    margin: 0;
    padding: 12px 10px;
    color: var(--mf-text-3);
  }

  footer {
    display: flex;
    flex-shrink: 0;
    justify-content: space-between;
    padding: 6px 10px;
    border-top: 1px solid var(--mf-border);
    font-size: 11px;
    color: var(--mf-text-3);
  }

  kbd {
    padding: 0 3px;
    border: 1px solid var(--mf-border);
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
  }
</style>
