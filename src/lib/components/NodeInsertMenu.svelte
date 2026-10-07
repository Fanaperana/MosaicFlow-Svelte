<!--
  Notion-style block picker: type to filter, arrows to move, Enter to insert.
  Opened with "/" or a double-click on the canvas, the toolbar "+", or by dropping a connection.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Search } from 'lucide-svelte';
  import {
    nodeRegistry,
    NODE_CATEGORIES,
    ICON_COMPONENTS,
    type NodeTypeRegistration,
  } from '$lib/kernel/registries/node-registry';

  interface Props {
    x: number;
    y: number;
    heading?: string;
    filter?: (reg: NodeTypeRegistration) => boolean;
    onPick: (type: string) => void;
    onClose: () => void;
  }

  let { x, y, heading = 'Insert block', filter, onPick, onClose }: Props = $props();

  const RECENT_KEY = 'mosaicflow:recent-node-types';
  const WIDTH = 320;
  const MAX_HEIGHT = 400;
  const SECTION_LABELS: Record<string, string> = {
    content: 'Basic blocks',
    entity: 'People & organizations',
    data: 'Research data',
    utility: 'Layout & embeds',
    custom: 'Plugins',
  };

  type Entry = { reg: NodeTypeRegistration; section: string };

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let listEl = $state<HTMLDivElement>();
  let version = $state(0);

  onMount(() => nodeRegistry.subscribe(() => version++));

  let available = $derived.by(() => {
    void version;
    return nodeRegistry.getAll().filter((r) => !filter || filter(r));
  });

  let recent = $derived.by(() => {
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    } catch {
      // ignore malformed history
    }
    return ids.map((t) => available.find((r) => r.type === t)).filter((r): r is NodeTypeRegistration => !!r).slice(0, 4);
  });

  let entries = $derived.by((): Entry[] => {
    const q = query.trim().toLowerCase();
    if (q) {
      return available
        .map((reg) => ({ reg, score: score(reg, q) }))
        .filter((e) => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ reg }) => ({ reg, section: 'Results' }));
    }
    const out: Entry[] = recent.map((reg) => ({ reg, section: 'Recent' }));
    const order = NODE_CATEGORIES.map((c) => c.id as string);
    const sorted = [...available].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    for (const reg of sorted) out.push({ reg, section: SECTION_LABELS[reg.category] ?? reg.category });
    return out;
  });

  let style = $derived.by(() => {
    const left = Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8));
    const below = window.innerHeight - y > MAX_HEIGHT + 16;
    return below
      ? `left: ${left}px; top: ${y + 4}px;`
      : `left: ${left}px; bottom: ${Math.max(8, window.innerHeight - y + 4)}px;`;
  });

  function score(reg: NodeTypeRegistration, q: string): number {
    const label = reg.label.toLowerCase();
    if (label === q) return 100;
    if (label.startsWith(q)) return 80;
    if (label.split(/\s+/).some((w) => w.startsWith(q))) return 60;
    if (reg.keywords?.some((k) => k.toLowerCase().includes(q))) return 50;
    if (label.includes(q) || reg.type.toLowerCase().includes(q)) return 40;
    if (reg.description.toLowerCase().includes(q)) return 20;
    return 0;
  }

  function pick(type: string) {
    try {
      const ids = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
      localStorage.setItem(RECENT_KEY, JSON.stringify([type, ...ids.filter((t) => t !== type)].slice(0, 8)));
    } catch {
      // history is optional
    }
    onPick(type);
  }

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
      if (entries[active]) pick(entries[active].reg.type);
    } else if (e.key === 'Escape' || (e.key === 'Backspace' && query === '')) {
      e.preventDefault();
      onClose();
    }
  }

  onMount(() => {
    input?.focus();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="insert-overlay" role="presentation" onpointerdown={onClose} oncontextmenu={(e) => { e.preventDefault(); onClose(); }}></div>

<div class="insert-menu" {style} role="dialog" aria-label={heading}>
  <div class="search">
    <Search size={14} />
    <input
      bind:this={input}
      bind:value={query}
      type="text"
      placeholder="Search blocks…"
      oninput={() => (active = 0)}
      onkeydown={handleKey}
      aria-label="Search blocks"
    />
  </div>

  <div class="list" bind:this={listEl} role="listbox">
    {#each entries as entry, i (entry.section + entry.reg.type)}
      {@const Icon = ICON_COMPONENTS[entry.reg.iconName]}
      {#if i === 0 || entries[i - 1].section !== entry.section}
        <div class="section">{entry.section}</div>
      {/if}
      <button
        class="item"
        class:active={i === active}
        role="option"
        aria-selected={i === active}
        onpointerenter={() => (active = i)}
        onclick={() => pick(entry.reg.type)}
      >
        <span class="tile">
          {#if Icon}<Icon size={16} strokeWidth={1.6} />{:else}{entry.reg.colors.icon}{/if}
        </span>
        <span class="text">
          <span class="label">{entry.reg.label}</span>
          {#if entry.reg.description}<span class="desc">{entry.reg.description}</span>{/if}
        </span>
      </button>
    {:else}
      <p class="empty">No blocks match "{query}"</p>
    {/each}
  </div>

  <footer>
    <span>{heading}</span>
    <span class="keys"><kbd>↑↓</kbd> move <kbd>↵</kbd> insert <kbd>esc</kbd> close</span>
  </footer>
</div>

<style>
  .insert-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
  }

  .insert-menu {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    width: 320px;
    max-height: 400px;
    overflow: hidden;
    border: 1px solid var(--mf-border-strong);
    border-radius: 10px;
    background: var(--mf-surface-2);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
    animation: menu-in 0.1s ease-out;
  }

  @keyframes menu-in {
    from { opacity: 0; transform: translateY(-2px) scale(0.99); }
    to { opacity: 1; transform: none; }
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 10px;
    border-bottom: 1px solid var(--mf-border);
    color: var(--mf-text-3);
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
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

  .section {
    padding: 8px 8px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--mf-text-3);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 4px 6px;
    border-radius: 6px;
    background: transparent;
    color: var(--mf-text);
    text-align: left;
  }

  .item.active {
    background: var(--mf-hover);
  }

  .tile {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 6px;
    background: var(--mf-surface);
    color: var(--mf-text-2);
    font-size: 16px;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .label {
    font-size: 13px;
  }

  .desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .empty {
    margin: 0;
    padding: 12px 10px;
    color: var(--mf-text-3);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-top: 1px solid var(--mf-border);
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .keys {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  kbd {
    padding: 0 4px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
    line-height: 15px;
  }
</style>
