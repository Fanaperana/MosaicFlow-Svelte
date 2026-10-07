<!--
  Preview a .mosaic package and choose what to import: which pages, how to handle
  name clashes, and whether to add them to this vault or create a new one.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { Package, FileText, X, FolderOpen, Loader2, TriangleAlert, Vault, FolderPlus } from 'lucide-svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import {
    importPackageAsNewVault,
    importPackagePages,
    reportImport,
    type ConflictPolicy,
    type PackagePreview,
  } from '$lib/services/packageService';

  interface Props {
    preview: PackagePreview;
    onClose: () => void;
  }

  let { preview, onClose }: Props = $props();

  const CONFLICTS: { id: ConflictPolicy; label: string; hint: string }[] = [
    { id: 'keep', label: 'Keep both', hint: 'Imported copies get a number, e.g. "Name (2)".' },
    { id: 'replace', label: 'Replace', hint: 'Existing pages with the same name are deleted first. Links to them keep working.' },
    { id: 'skip', label: 'Skip', hint: 'Pages that already exist are left as they are.' },
  ];

  let selected = $state(untrack(() => new Set(preview.pages.map((p) => p.index))));
  // A whole vault from elsewhere most likely belongs in its own vault; pages go into this one.
  let target = $state<'current' | 'new'>(untrack(() =>
    !vaultStore.currentVault ||
      (preview.manifest?.kind === 'vault' && preview.manifest.vault?.name !== vaultStore.currentVault.name)
      ? 'new'
      : 'current'
  ));
  let conflict = $state<ConflictPolicy>('keep');
  let newVaultName = $state(untrack(() => preview.vaultName));
  let parentPath = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  let chosen = $derived(preview.pages.filter((p) => selected.has(p.index)));
  let clashes = $derived(target === 'current' ? chosen.filter((p) => p.exists).length : 0);
  let kindLabel = $derived(
    preview.manifest?.kind === 'vault'
      ? `Vault${preview.manifest.vault?.name ? ` · ${preview.manifest.vault.name}` : ''}`
      : preview.pages.length === 1 ? 'Page' : `${preview.pages.length} pages`
  );
  let canImport = $derived(chosen.length > 0 && !busy && (target === 'current' || (!!parentPath && newVaultName.trim() !== '')));

  function toggle(index: number) {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    selected = next;
  }

  function toggleAll() {
    selected = selected.size === preview.pages.length ? new Set() : new Set(preview.pages.map((p) => p.index));
  }

  async function pickParent() {
    const picked = await open({ directory: true, multiple: false, title: 'Where should the new vault be created?' });
    if (typeof picked === 'string') parentPath = picked;
  }

  async function run() {
    busy = true;
    error = null;
    try {
      const pages = chosen.map((p) => p.index);
      const outcome = target === 'new'
        ? await importPackageAsNewVault(preview, parentPath!, newVaultName.trim(), pages)
        : await importPackagePages(preview, { pages, conflict });
      reportImport(outcome);
      onClose();
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
  <div class="dialog" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="pkg-import-title" onclick={(e) => e.stopPropagation()}>
    <header>
      <Package size={16} />
      <div class="title">
        <h2 id="pkg-import-title">Import {preview.fileName}</h2>
        <span class="sub">
          {kindLabel}
          {#if preview.manifest?.createdAt} · exported {new Date(preview.manifest.createdAt).toLocaleDateString()}{/if}
        </span>
      </div>
      <button class="icon-btn" onclick={onClose} disabled={busy} aria-label="Close"><X size={15} /></button>
    </header>

    <div class="body">
      <div class="field">
        <span class="label">Import into</span>
        <div class="seg">
          <button class:active={target === 'current'} disabled={!vaultStore.currentVault} onclick={() => (target = 'current')}>
            <Vault size={13} />{vaultStore.currentVault ? `This vault (${vaultStore.currentVault.name})` : 'No vault open'}
          </button>
          <button class:active={target === 'new'} onclick={() => (target = 'new')}>
            <FolderPlus size={13} />New vault
          </button>
        </div>
      </div>

      {#if target === 'new'}
        <div class="new-vault">
          <input type="text" bind:value={newVaultName} placeholder="Vault name" aria-label="New vault name" />
          <button class="ghost" onclick={pickParent}>
            <FolderOpen size={13} />{parentPath ? 'Change location' : 'Choose location…'}
          </button>
          {#if parentPath}<span class="path" title={parentPath}>{parentPath}</span>{/if}
        </div>
      {/if}

      <div class="list-head">
        <label class="check-all">
          <input type="checkbox" class="check" checked={selected.size === preview.pages.length} indeterminate={selected.size > 0 && selected.size < preview.pages.length} onchange={toggleAll} />
          <span>Pages</span>
        </label>
        <span class="count">{chosen.length} of {preview.pages.length} selected</span>
      </div>

      <div class="list">
        {#each preview.pages as page (page.index)}
          <label class="row">
            <input type="checkbox" class="check" checked={selected.has(page.index)} onchange={() => toggle(page.index)} />
            <FileText size={14} />
            <span class="name">{page.name}</span>
            {#if target === 'current' && page.exists}<span class="badge">Exists</span>{/if}
            <span class="meta">{page.nodes} nodes · {page.edges} links</span>
          </label>
        {/each}
      </div>

      {#if clashes > 0}
        <div class="field">
          <span class="label">{clashes} page{clashes === 1 ? '' : 's'} already exist{clashes === 1 ? 's' : ''}</span>
          <div class="seg">
            {#each CONFLICTS as c (c.id)}
              <button class:active={conflict === c.id} onclick={() => (conflict = c.id)}>{c.label}</button>
            {/each}
          </div>
          <p class="hint">{CONFLICTS.find((c) => c.id === conflict)?.hint}</p>
        </div>
      {/if}

      {#if preview.warnings.length}
        <p class="warn"><TriangleAlert size={13} />{preview.warnings.length} warning{preview.warnings.length === 1 ? '' : 's'}: {preview.warnings[0]}</p>
      {/if}
      {#if error}
        <p class="warn error"><TriangleAlert size={13} />{error}</p>
      {/if}
    </div>

    <footer>
      <span class="note">Links between imported pages are updated automatically.</span>
      <button class="ghost" onclick={onClose} disabled={busy}>Cancel</button>
      <button class="primary" onclick={run} disabled={!canImport}>
        {#if busy}<Loader2 size={14} class="animate-spin" />{/if}
        Import {chosen.length} page{chosen.length === 1 ? '' : 's'}
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
    width: min(520px, calc(100vw - 32px));
    max-height: min(640px, calc(100vh - 64px));
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    gap: 12px;
    min-height: 0;
    padding: 12px 14px;
    overflow-y: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--mf-text-2);
  }

  .seg {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--mf-border);
    border-radius: var(--mf-radius);
    background: var(--mf-surface-2);
  }

  .seg button {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    height: 26px;
    padding: 0 8px;
    overflow: hidden;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    font-size: 12px;
    white-space: nowrap;
  }

  .seg button:hover:not(:disabled) {
    color: var(--mf-text);
  }

  .seg button.active {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .hint {
    margin: 0;
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .new-vault {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .new-vault input {
    flex: 1;
    min-width: 160px;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--mf-border-strong);
    border-radius: var(--mf-radius);
    background: var(--mf-surface-2);
    color: var(--mf-text);
    font-size: 12.5px;
  }

  .path {
    flex-basis: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mf-font-mono);
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: -6px;
    padding: 0 6px;
  }

  .check-all {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--mf-text-2);
    cursor: pointer;
  }

  .count {
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .list {
    display: flex;
    flex-direction: column;
    max-height: 260px;
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
    color: var(--mf-text);
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
    flex-shrink: 0;
    padding: 0 6px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.14);
    color: #f5b041;
    font-size: 10.5px;
    line-height: 17px;
  }

  .meta {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--mf-text-3);
    font-variant-numeric: tabular-nums;
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

  .check:checked,
  .check:indeterminate {
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

  .check:indeterminate::after {
    content: '';
    width: 7px;
    height: 1.5px;
    background: #fff;
  }

  .warn {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
    font-size: 11.5px;
    color: #f5b041;
    word-break: break-word;
  }

  .warn.error {
    color: var(--mf-danger);
  }

  .warn :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
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
