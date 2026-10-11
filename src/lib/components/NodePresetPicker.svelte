<!--
  Node colour presets (Notion-style): the trigger shows the current preset; the popover is a compact
  grid of diagonal swatches (text colour over fill) with the name on hover. "+" saves the node's
  current colours as a named preset of your own; double-click one of yours to rename it, hover to delete.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { Check, ChevronDown, Plus, X } from 'lucide-svelte';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import NodePresetSwatch from './NodePresetSwatch.svelte';
  import { nodePresets, type NodePreset } from '$lib/stores/node-presets.svelte';

  interface Props {
    data: Record<string, unknown>;
    disabled?: boolean;
    onApply: (preset: NodePreset) => void;
    onSave: (name: string) => void;
  }

  let { data, disabled = false, onApply, onSave }: Props = $props();

  let open = $state(false);
  /** Naming a new preset (id null) or renaming one of yours. */
  let naming = $state<{ id: string | null; name: string } | null>(null);
  let nameInput = $state<HTMLInputElement>();

  $effect(() => {
    if (!open) naming = null;
  });

  async function startNaming(id: string | null, name: string) {
    naming = { id, name };
    await tick();
    nameInput?.select();
  }

  function commitName() {
    if (!naming) return;
    const name = naming.name.trim() || nodePresets.nextName();
    if (naming.id) nodePresets.rename(naming.id, name);
    else onSave(name);
    naming = null;
  }

  const current = $derived(nodePresets.all.find((p) => nodePresets.matches(p, data)) ?? null);
  const builtIn = $derived(nodePresets.all.filter((p) => !p.custom));
  const custom = $derived(nodePresets.all.filter((p) => p.custom));
  const own = $derived({
    fill: (data.color as string) || '#1e1e1e',
    border: (data.borderColor as string) || '#333333',
    text: (data.textColor as string) || '#e0e0e0',
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger {disabled} class="preset-trigger" aria-label="Style preset">
    <NodePresetSwatch {...(current ?? own)} size={16} />
    <span class="name" class:muted={!current}>{current?.name ?? 'Custom'}</span>
    <ChevronDown size={12} class="chev" />
  </Popover.Trigger>

  <Popover.Content class="w-auto p-2">
    <div class="heading">Presets</div>
    <div class="grid">
      {#each builtIn as preset (preset.id)}
        {@render tile(preset)}
      {/each}
    </div>

    <div class="heading">Yours</div>
    <div class="grid">
      {#each custom as preset (preset.id)}
        {@render tile(preset)}
      {/each}
      <Tooltip.Root>
        <Tooltip.Trigger class="tile add" onclick={() => startNaming(null, nodePresets.nextName())} aria-label="Save current colours as a preset">
          <Plus size={13} />
        </Tooltip.Trigger>
        <Tooltip.Content>Save current colours</Tooltip.Content>
      </Tooltip.Root>
    </div>

    {#if naming}
      <form class="naming" onsubmit={(e) => { e.preventDefault(); commitName(); }}>
        {#if !naming.id}<NodePresetSwatch {...own} size={18} />{/if}
        <input
          bind:this={nameInput}
          bind:value={naming.name}
          maxlength="32"
          placeholder="Preset name"
          aria-label="Preset name"
          onkeydown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); naming = null; }
          }}
        />
        <button type="submit" class="save">{naming.id ? 'Rename' : 'Save'}</button>
      </form>
    {/if}
  </Popover.Content>
</Popover.Root>

{#snippet tile(preset: NodePreset)}
  <span class="tile-wrap">
    <Tooltip.Root>
      <Tooltip.Trigger
        class="tile {current?.id === preset.id ? 'active' : ''}"
        onclick={() => onApply(preset)}
        ondblclick={() => preset.custom && startNaming(preset.id, preset.name)}
        aria-label="{preset.name} preset"
        aria-pressed={current?.id === preset.id}
      >
        <NodePresetSwatch fill={preset.fill} border={preset.border} text={preset.text} />
        {#if current?.id === preset.id}
          <span class="tick" style:color={preset.text}><Check size={11} strokeWidth={3} /></span>
        {/if}
      </Tooltip.Trigger>
      <Tooltip.Content>{preset.name}{preset.custom ? ' · double-click to rename' : ''}</Tooltip.Content>
    </Tooltip.Root>
    {#if preset.custom}
      <button type="button" class="remove" onclick={() => nodePresets.remove(preset.id)} aria-label="Delete {preset.name}"><X size={8} strokeWidth={3} /></button>
    {/if}
  </span>
{/snippet}

<style>
  :global(.preset-trigger) {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    height: 24px;
    padding: 0 6px 0 4px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }

  :global(.preset-trigger:hover),
  :global(.preset-trigger[data-state='open']) {
    background: var(--mf-active);
  }

  :global(.preset-trigger:disabled) {
    cursor: default;
    opacity: 0.6;
  }

  :global(.preset-trigger .chev) {
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

  .heading {
    padding: 2px 2px 5px;
    font-size: 11px;
    font-weight: 500;
    color: var(--mf-text-3);
  }

  .heading:not(:first-child) {
    margin-top: 6px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(6, 26px);
    gap: 4px;
  }

  .tile-wrap {
    position: relative;
  }

  :global(.tile) {
    position: relative;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--mf-text-3);
    cursor: pointer;
  }

  :global(.tile:hover) {
    background: var(--mf-hover);
  }

  :global(.tile.active) {
    box-shadow: 0 0 0 1.5px var(--mf-accent);
  }

  :global(.tile.add) {
    border: 1px dashed var(--mf-border-strong);
  }

  :global(.tile.add:hover) {
    color: var(--mf-text);
  }

  .tick {
    position: absolute;
    right: 4px;
    bottom: 3px;
    display: grid;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
  }

  .remove {
    position: absolute;
    top: -4px;
    right: -4px;
    z-index: 1;
    display: none;
    place-items: center;
    width: 13px;
    height: 13px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--mf-danger);
    color: #fff;
    cursor: pointer;
  }

  .tile-wrap:hover .remove {
    display: grid;
  }

  .naming {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--mf-border);
  }

  .naming input {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 5px;
    background: var(--mf-surface);
    color: var(--mf-text);
    font: inherit;
    font-size: 12px;
    outline: none;
  }

  .naming input:focus {
    border-color: var(--mf-accent);
  }

  .save {
    height: 24px;
    padding: 0 9px;
    border: none;
    border-radius: 5px;
    background: var(--mf-accent);
    color: #fff;
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
</style>
