<!-- Choose which pages go into a .mosaic file: this page, a selection, or the whole vault. -->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { Package, FileText, X, Loader2, TriangleAlert } from 'lucide-svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { exportPagesDialog } from '$lib/services/packageService';

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

  async function run() {
    busy = true;
    error = null;
    try {
      const path = await exportPagesDialog(chosen);
      if (path) {
        toast.success(`Exported ${chosen.length} page${chosen.length === 1 ? '' : 's'}`, { description: path });
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
