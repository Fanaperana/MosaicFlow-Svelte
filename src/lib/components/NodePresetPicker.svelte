<!--
  Notion-style combobox for node colour presets: the trigger shows the current preset; the menu
  filters as you type, applies with click or Enter, and saves the node's current colours as a new preset.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { Check, ChevronDown, Plus, Search, X } from 'lucide-svelte';
  import { nodePresets, type NodePreset } from '$lib/stores/node-presets.svelte';

  interface Props {
    data: Record<string, unknown>;
    disabled?: boolean;
    onApply: (preset: NodePreset) => void;
    onSave: (name: string) => void;
  }

  let { data, disabled = false, onApply, onSave }: Props = $props();

  const WIDTH = 232;
  const MAX_HEIGHT = 320;

  let open = $state(false);
  let query = $state('');
  let active = $state(0);
  let naming = $state(false);
  let newName = $state('');
  let trigger = $state<HTMLButtonElement>();
  let input = $state<HTMLInputElement>();
  let listEl = $state<HTMLDivElement>();
  let pos = $state({ left: 0, top: 0, up: false });

  const current = $derived(nodePresets.all.find((p) => nodePresets.matches(p, data)) ?? null);
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return q ? nodePresets.all.filter((p) => p.name.toLowerCase().includes(q)) : nodePresets.all;
  });
  const builtIn = $derived(filtered.filter((p) => !p.custom));
  const custom = $derived(filtered.filter((p) => p.custom));
  // Keyboard order: built-ins, then the user's presets, then the save row.
  const rows = $derived([...builtIn, ...custom]);

  async function show() {
    if (disabled || !trigger) return;
    const r = trigger.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < MAX_HEIGHT + 12 && r.top > window.innerHeight - r.bottom;
    pos = { left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)), top: up ? r.top - 4 : r.bottom + 4, up };
    query = '';
    naming = false;
    active = Math.max(0, rows.findIndex((p) => p.id === current?.id));
    open = true;
    await tick();
    input?.focus();
  }

  function hide() {
    open = false;
    naming = false;
    trigger?.focus();
  }

  function choose(preset: NodePreset) {
    onApply(preset);
    hide();
  }

  async function startSave() {
    naming = true;
    newName = '';
    await tick();
    listEl?.querySelector<HTMLInputElement>('.name-input')?.focus();
  }

  function commitSave() {
    onSave(newName);
    naming = false;
    query = '';
    active = rows.length - 1;
  }

  async function move(delta: number) {
    const count = rows.length + 1;
    active = (active + delta + count) % count;
    await tick();
    listEl?.querySelector('.row.active')?.scrollIntoView({ block: 'nearest' });
  }

  function onKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active === rows.length) startSave();
      else if (rows[active]) choose(rows[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  }
</script>

<button
  bind:this={trigger}
  type="button"
  class="trigger"
  class:open
  {disabled}
  onclick={() => (open ? hide() : show())}
  aria-haspopup="listbox"
  aria-expanded={open}
>
  {#if current}
    <span class="swatch" style:background={current.fill} style:border-color={current.border} style:color={current.text}>Aa</span>
    <span class="name">{current.name}</span>
  {:else}
    <span class="swatch" style:background={(data.color as string) || '#1e1e1e'} style:border-color={(data.borderColor as string) || '#333'} style:color={(data.textColor as string) || '#e0e0e0'}>Aa</span>
    <span class="name muted">Custom</span>
  {/if}
  <ChevronDown size={12} class="chev" />
</button>

{#if open}
  <div class="overlay" role="presentation" onpointerdown={hide}></div>
  <div
    class="menu"
    class:up={pos.up}
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    style:width="{WIDTH}px"
    role="dialog"
    aria-label="Style presets"
  >
    <div class="search">
      <Search size={13} />
      <input bind:this={input} bind:value={query} placeholder="Search presets…" oninput={() => (active = 0)} onkeydown={onKey} aria-label="Search presets" />
    </div>
    <div class="list" bind:this={listEl} role="listbox">
      {#if builtIn.length}<div class="section">Presets</div>{/if}
      {#each builtIn as preset, i (preset.id)}
        {@render row(preset, i)}
      {/each}
      {#if custom.length}<div class="section">Your presets</div>{/if}
      {#each custom as preset, i (preset.id)}
        {@render row(preset, builtIn.length + i)}
      {/each}
      {#if !rows.length}<p class="empty">No preset matches "{query}"</p>{/if}

      <div class="divider"></div>
      {#if naming}
        <div class="row naming">
          <Plus size={13} />
          <input
            class="name-input"
            bind:value={newName}
            maxlength="32"
            placeholder="Preset name"
            onkeydown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); commitSave(); }
              else if (e.key === 'Escape') { e.preventDefault(); naming = false; input?.focus(); }
            }}
          />
        </div>
      {:else}
        <button type="button" class="row save" class:active={active === rows.length} onpointerenter={() => (active = rows.length)} onclick={startSave}>
          <Plus size={13} />
          <span class="label">Save as preset</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

{#snippet row(preset: NodePreset, index: number)}
  <div
    class="row"
    class:active={active === index}
    role="option"
    tabindex="-1"
    aria-selected={current?.id === preset.id}
    onpointerenter={() => (active = index)}
    onclick={() => choose(preset)}
    onkeydown={() => {}}
  >
    <span class="swatch" style:background={preset.fill} style:border-color={preset.border} style:color={preset.text}>Aa</span>
    <span class="label">{preset.name}</span>
    {#if current?.id === preset.id}<Check size={13} class="check" />{/if}
    {#if preset.custom}
      <button
        type="button"
        class="remove"
        onclick={(e) => { e.stopPropagation(); nodePresets.remove(preset.id); }}
        title="Delete preset"
        aria-label="Delete {preset.name}"
      ><X size={11} /></button>
    {/if}
  </div>
{/snippet}

<style>
  .trigger {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    height: 26px;
    padding: 0 6px 0 3px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text);
    font: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }

  .trigger:hover,
  .trigger.open {
    background: var(--mf-active);
  }

  .trigger:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .trigger :global(.chev) {
    margin-left: auto;
    color: var(--mf-text-3);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    color: var(--mf-text-2);
  }

  .swatch {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 22px;
    height: 18px;
    border: 1.5px solid;
    border-radius: 4px;
    font-size: 9.5px;
    font-weight: 600;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
  }

  .menu {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    max-height: 320px;
    overflow: hidden;
    border: 1px solid var(--mf-border-strong);
    border-radius: 9px;
    background: var(--mf-surface-2);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3);
    color: var(--mf-text);
    font-size: 12.5px;
  }

  .menu.up {
    transform: translateY(-100%);
  }

  .search {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 10px;
    border-bottom: 1px solid var(--mf-border);
    color: var(--mf-text-3);
  }

  .search input,
  .name-input {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mf-text);
    font: inherit;
    outline: none;
  }

  .list {
    overflow-y: auto;
    padding: 4px;
    scrollbar-width: thin;
  }

  .section {
    padding: 6px 8px 3px;
    font-size: 11px;
    font-weight: 500;
    color: var(--mf-text-3);
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .row.active {
    background: var(--mf-hover);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row :global(.check) {
    color: var(--mf-accent);
  }

  .remove {
    display: none;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    cursor: pointer;
  }

  .row:hover .remove {
    display: grid;
  }

  .remove:hover {
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
  }

  .save,
  .naming {
    color: var(--mf-text-2);
  }

  .naming {
    cursor: text;
    background: var(--mf-hover);
  }

  .divider {
    height: 1px;
    margin: 4px 2px;
    background: var(--mf-border);
  }

  .empty {
    margin: 0;
    padding: 8px 10px;
    color: var(--mf-text-3);
  }
</style>
