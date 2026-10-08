<!--
  Command palette (Ctrl+P): every command (built in or from plugins), template and layout in one
  searchable list. Plugins reach users through here without needing a button of their own.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { Command, LayoutTemplate, Network, PanelRight, Search } from 'lucide-svelte';
  import { commandRegistry } from '$lib/kernel/registries/command-registry';
  import { layoutRegistry, templateRegistry } from '$lib/kernel/registries/contribution-registry';
  import { keybindings, chordParts } from '$lib/kernel/keybindings.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { applyLayout, insertTemplate } from '$lib/services/contributions';
  import { panels } from '$lib/stores/panels.svelte';

  type Item = {
    key: string;
    label: string;
    detail: string;
    kind: 'command' | 'template' | 'layout' | 'panel';
    shortcut?: string;
    run: () => unknown;
  };

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();
  let version = $state(0);

  const onCanvas = () => vaultStore.appView === 'canvas' && !!vaultStore.currentCanvas;

  let items = $derived.by((): Item[] => {
    void version;
    const out: Item[] = commandRegistry
      .getEnabled()
      .filter((c) => c.id !== 'app.commandPalette')
      .map((c) => ({
        key: `cmd:${c.id}`,
        label: c.label,
        detail: c.category ?? '',
        kind: 'command',
        shortcut: keybindings.get(c.id)[0],
        run: () => commandRegistry.execute(c.id),
      }));
    if (onCanvas()) {
      for (const t of templateRegistry.getAll()) {
        out.push({ key: `tpl:${t.id}`, label: `Insert template: ${t.name}`, detail: t.description ?? 'Template', kind: 'template', run: () => insertTemplate(t.id) });
      }
      for (const l of layoutRegistry.getAll()) {
        out.push({ key: `lay:${l.id}`, label: `Arrange: ${l.name}`, detail: l.description ?? 'Layout', kind: 'layout', run: () => applyLayout(l.id) });
      }
      for (const p of panels.list) {
        out.push({ key: `pnl:${p.id}`, label: `Toggle panel: ${p.label}`, detail: p.description ?? 'Panel', kind: 'panel', run: () => ui.togglePanel(p.id) });
      }
    }
    return out;
  });

  // Every word must appear in the label or category; label matches rank first.
  let results = $derived.by(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items
      .filter((i) => words.every((w) => `${i.label} ${i.detail}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(words[0])) - Number(!b.label.toLowerCase().startsWith(words[0])));
  });

  $effect(() => {
    void query;
    active = 0;
  });

  async function runItem(item: Item | undefined) {
    if (!item) return;
    ui.paletteOpen = false;
    try {
      await item.run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') active = Math.min(results.length - 1, active + 1);
    else if (e.key === 'ArrowUp') active = Math.max(0, active - 1);
    else if (e.key === 'Enter') return runItem(results[active]);
    else if (e.key === 'Escape') ui.paletteOpen = false;
    else return;
    e.preventDefault();
    await tick();
    list?.querySelector('.item.active')?.scrollIntoView({ block: 'nearest' });
  }

  onMount(() => {
    input?.focus();
    const bump = () => version++;
    const offs = [commandRegistry.subscribe(bump), templateRegistry.subscribe(bump), layoutRegistry.subscribe(bump)];
    return () => offs.forEach((off) => off());
  });

  const ICONS = { command: Command, template: LayoutTemplate, layout: Network, panel: PanelRight };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="backdrop" role="presentation" onclick={() => (ui.paletteOpen = false)}>
  <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <label class="search">
      <Search size={15} />
      <input bind:this={input} bind:value={query} placeholder="Type a command, template or layout…" onkeydown={onKey} aria-label="Search commands" />
    </label>
    <div class="list" bind:this={list} role="listbox" aria-label="Results">
      {#each results as item, i (item.key)}
        {@const Icon = ICONS[item.kind]}
        <button
          class="item"
          class:active={i === active}
          role="option"
          aria-selected={i === active}
          onpointermove={() => (active = i)}
          onclick={() => runItem(item)}
        >
          <Icon size={14} />
          <span class="label">{item.label}</span>
          <span class="detail">{item.detail}</span>
          {#if item.shortcut}
            <span class="keys">{#each chordParts(item.shortcut) as part, k (k)}<kbd>{part}</kbd>{/each}</span>
          {/if}
        </button>
      {:else}
        <p class="empty">No command matches "{query}"</p>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1600;
    display: flex;
    justify-content: center;
    padding-top: 12vh;
    background: rgba(0, 0, 0, 0.35);
  }

  .palette {
    display: flex;
    flex-direction: column;
    width: min(620px, calc(100vw - 32px));
    max-height: min(460px, 70vh);
    border: 1px solid var(--mf-border-strong);
    border-radius: 12px;
    background: var(--mf-surface);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    overflow: hidden;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--mf-border);
    color: var(--mf-text-3);
  }

  .search input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--mf-text);
    font: inherit;
    font-size: 14px;
  }

  .list {
    overflow-y: auto;
    padding: 6px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 7px;
    background: transparent;
    color: var(--mf-text-2);
    font-size: 13px;
    text-align: left;
  }

  .item.active {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .item :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail {
    flex-shrink: 0;
    max-width: 40%;
    overflow: hidden;
    font-size: 11.5px;
    color: var(--mf-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .keys {
    display: flex;
    gap: 3px;
  }

  kbd {
    padding: 1px 5px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 4px;
    font-family: inherit;
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .empty {
    margin: 12px;
    font-size: 12.5px;
    color: var(--mf-text-3);
  }
</style>
