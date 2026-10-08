<!-- Choose which pages go into a .mosaic file: this page, a selection, or the whole vault. -->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { Package, FileText, X, Loader2, TriangleAlert, Puzzle } from 'lucide-svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { exportPagesDialog, pluginUsage } from '$lib/services/packageService';

  interface Props {
    preselect: 'current' | 'all';
    onClose: () => void;
  }

  let { preselect, onClose }: Props = $props();

  const currentId = vaultStore.currentCanvas?.id;
  let selected = $state(untrack(() =>
    new Set(
      preselect === 'current' && currentId ? [currentId] : vaultStore.canvases.map((c) => c.id)
    )
  ));
  let busy = $state(false);
  let error = $state<string | null>(null);

  let total = $derived(vaultStore.canvases.length);
  let chosen = $derived(vaultStore.canvases.filter((c) => selected.has(c.id)));
  let summary = $derived(
    chosen.length === total && total > 1
      ? `The whole vault (${total} pages). Import it elsewhere as a new vault or merge it into another.`
      : chosen.length === 1
        ? `One page: "${chosen[0].name}".`
        : `${chosen.length} pages in one file.`
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function selectAll(on: boolean) {
    selected = new Set(on ? vaultStore.canvases.map((c) => c.id) : []);
  }

  // Custom node types used by the chosen pages, from the search index (the export re-reads the files).
  let includePlugins = $state(true);
  let usage = $derived.by(() => {
    const ids = new Set(chosen.map((c) => c.id));
    return pluginUsage(new Set(knowledge.index.nodes.filter((n) => ids.has(n.canvasId)).map((n) => n.type)));
  });

  onMount(() => {
    void knowledge.loadVault();
  });

  async function run() {
    busy = true;
    error = null;
    try {
      const result = await exportPagesDialog(chosen, { includePlugins });
      if (result) {
        const extra = result.plugins.length ? ` with ${result.plugins.length} plugin${result.plugins.length === 1 ? '' : 's'} (${result.plugins.join(', ')})` : '';
        toast.success(`Exported ${chosen.length} page${chosen.length === 1 ? '' : 's'}${extra}`, { description: result.path });
        if (result.missingTypes.length) {
          toast.warning('Some nodes need plugins you don\'t have installed', { description: `Not included: ${result.missingTypes.join(', ')}` });
        }
        onClose();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="backdrop" role="presentation" onclick={() => !busy && onClose()}>
  <div class="dialog" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="pkg-export-title" onclick={(e) => e.stopPropagation()}>
    <header>
      <Package size={16} />
      <div class="title">
        <h2 id="pkg-export-title">Export as .mosaic</h2>
        <span class="sub">{vaultStore.currentVault?.name}</span>
      </div>
      <button class="icon-btn" onclick={onClose} disabled={busy} aria-label="Close"><X size={15} /></button>
    </header>

    <div class="body">
      <div class="quick">
        {#if currentId}
          <button class:active={chosen.length === 1 && selected.has(currentId)} onclick={() => (selected = new Set([currentId]))}>This page</button>
        {/if}
        <button class:active={chosen.length === total} onclick={() => selectAll(true)}>Whole vault</button>
        <button onclick={() => selectAll(false)}>Clear</button>
      </div>

      <div class="list">
        {#each vaultStore.canvases as canvas (canvas.id)}
          <label class="row">
            <input type="checkbox" class="check" checked={selected.has(canvas.id)} onchange={() => toggle(canvas.id)} />
            <FileText size={14} />
            <span class="name">{canvas.name}</span>
            {#if canvas.id === currentId}<span class="badge">Open</span>{/if}
          </label>
        {/each}
      </div>

      <p class="summary">{chosen.length ? summary : 'Choose at least one page.'}</p>

      {#if usage.plugins.length}
        <div class="plugins">
          <label class="plugins-head">
            <input type="checkbox" class="check" bind:checked={includePlugins} />
            <Puzzle size={13} />
            <span>Include the custom plugin{usage.plugins.length === 1 ? '' : 's'} these pages use</span>
          </label>
          <ul>
            {#each usage.plugins as { plugin, nodeTypes } (plugin.manifest.id)}
              <li>
                <strong>{plugin.manifest.name}</strong> <span class="ver">v{plugin.manifest.version}</span>
                {#if plugin.manifest.author}<span class="by">by {plugin.manifest.author}</span>{/if}
                <span class="types">{nodeTypes.join(', ')}</span>
              </li>
            {/each}
          </ul>
          <p class="plugins-note">
            {includePlugins
              ? 'Whoever imports the file is asked before the plugins are installed.'
              : 'Without them, these nodes show as placeholders until the plugin is installed.'}
          </p>
        </div>
      {/if}
      {#if usage.missing.length}
        <p class="error"><TriangleAlert size={13} />Some nodes use plugins that aren't installed here, so they can't be included: {usage.missing.join(', ')}</p>
      {/if}
      {#if error}<p class="error"><TriangleAlert size={13} />{error}</p>{/if}
    </div>

    <footer>
      <span class="note">Includes notes, links, images and attachments.</span>
      <button class="ghost" onclick={onClose} disabled={busy}>Cancel</button>
      <button class="primary" onclick={run} disabled={busy || chosen.length === 0}>
        {#if busy}<Loader2 size={14} class="animate-spin" />{/if}
        Export {chosen.length} page{chosen.length === 1 ? '' : 's'}…
      </button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.45);
    animation: fade 0.12s ease-out;
  }

  @keyframes fade {
    from { opacity: 0; }
  }

  .dialog {
    display: flex;
    flex-direction: column;
    width: min(460px, calc(100vw - 32px));
    max-height: min(600px, calc(100vh - 64px));
    border: 1px solid var(--mf-border-strong);
    border-radius: 12px;
    background: var(--mf-surface);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 8px 8px 8px 14px;
    border-bottom: 1px solid var(--mf-border);
    color: var(--mf-text-2);
  }

  .title {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--mf-text);
  }

  .sub {
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    padding: 12px 14px;
    overflow-y: auto;
  }

  .quick {
    display: flex;
    gap: 4px;
  }

  .quick button {
    height: 24px;
    padding: 0 10px;
    border: 1px solid var(--mf-border);
    border-radius: 999px;
    background: transparent;
    color: var(--mf-text-2);
    font-size: 12px;
  }

  .quick button:hover {
    border-color: var(--mf-border-strong);
    color: var(--mf-text);
  }

  .quick button.active {
    border-color: transparent;
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
  }

  .list {
    display: flex;
    flex-direction: column;
    max-height: 300px;
    overflow-y: auto;
    padding: 2px;
    border: 1px solid var(--mf-border);
    border-radius: 8px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 6px;
    border-radius: 5px;
    cursor: pointer;
  }

  .row:hover {
    background: var(--mf-hover);
  }

  .row :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
    font-size: 10.5px;
    line-height: 17px;
  }

  .check {
    appearance: none;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    margin: 0;
    padding: 0;
    border: 1px solid var(--mf-border-strong);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
  }

  .check:checked {
    border-color: var(--mf-accent);
    background: var(--mf-accent);
  }

  .check:checked::after {
    content: '';
    width: 7px;
    height: 4px;
    border-left: 1.5px solid #fff;
    border-bottom: 1.5px solid #fff;
    transform: translateY(-1px) rotate(-45deg);
  }

  .summary {
    margin: 0;
    font-size: 12px;
    color: var(--mf-text-2);
  }

  .plugins {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--mf-border);
    border-radius: 8px;
    background: var(--mf-surface-2);
  }

  .plugins-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--mf-text);
    cursor: pointer;
  }

  .plugins-head :global(svg) {
    color: var(--mf-accent);
  }

  .plugins ul {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
    padding: 0 0 0 24px;
    list-style: none;
  }

  .plugins li {
    font-size: 12px;
    color: var(--mf-text-2);
  }

  .ver,
  .by {
    color: var(--mf-text-3);
  }

  .types {
    display: block;
    font-family: var(--mf-font-mono);
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .plugins-note {
    margin: 0;
    padding-left: 24px;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
    font-size: 11.5px;
    color: var(--mf-danger);
  }

  footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid var(--mf-border);
  }

  .note {
    flex: 1;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .ghost,
  .primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--mf-radius);
    font-size: 12.5px;
  }

  .ghost {
    background: transparent;
    color: var(--mf-text-2);
  }

  .ghost:hover:not(:disabled) {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .primary {
    background: var(--mf-accent);
    color: #fff;
    font-weight: 500;
  }

  .primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }
</style>
