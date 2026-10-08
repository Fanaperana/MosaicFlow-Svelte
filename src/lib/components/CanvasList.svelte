<script lang="ts">
  import { tick, onMount } from 'svelte';
  import { vaultStore, samePath } from '$lib/stores/vault.svelte';
  import { pageNav } from '$lib/stores/pages.svelte';
  import { formatRelativeTime, isValidVault, type CanvasInfo } from '$lib/services/vaultService';
  import {
    Plus,
    Trash2,
    FileText,
    Loader2,
    Pencil,
    PackageOpen,
    FolderInput,
    FolderOpen,
    Archive,
    Search,
    LayoutGrid,
    ChevronDown,
    X,
  } from 'lucide-svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { open } from '@tauri-apps/plugin-dialog';
  import { confirmDanger } from '$lib/utils/confirm';
  import { importDropped, importFileDialog, importMarkdownFolderDialog } from '$lib/services/interopService';
  import { packageDialogs } from '$lib/stores/packages.svelte';
  import { settings } from '$lib/stores/settings.svelte';

  type SortMode = 'recent' | 'name';

  let isImporting = $state(false);
  let dropActive = $state(false);
  let query = $state('');
  let sortMode = $state<SortMode>('recent');

  let isCreating = $state(false);
  let newCanvasName = $state('');
  let showCreateInput = $state(false);
  let renamingId = $state<string | null>(null);
  let draftName = $state('');
  let renameInput = $state<HTMLInputElement>();

  let pages = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? vaultStore.canvases.filter((c) => c.name.toLowerCase().includes(q) || c.tags?.some((t) => t.toLowerCase().includes(q)))
      : [...vaultStore.canvases];
    return sortMode === 'name'
      ? list.sort((a, b) => a.name.localeCompare(b.name))
      : list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  });

  async function runImport(task: () => Promise<unknown>) {
    isImporting = true;
    try {
      await task();
    } finally {
      isImporting = false;
    }
  }

  // OS file drops: .mosaic/.zip/.canvas/.json/.mmd files, or folders of markdown notes.
  onMount(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    import('@tauri-apps/api/webview').then(async ({ getCurrentWebview }) => {
      const off = await getCurrentWebview().onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === 'enter' || p.type === 'over') dropActive = true;
        else if (p.type === 'leave') dropActive = false;
        else if (p.type === 'drop') {
          dropActive = false;
          if (p.paths.length) runImport(() => importDropped(p.paths));
        }
      });
      if (disposed) off();
      else unlisten = off;
    }).catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  async function handleCreateCanvas() {
    if (!newCanvasName.trim()) return;
    isCreating = true;
    try {
      await vaultStore.createCanvas(newCanvasName.trim());
      newCanvasName = '';
      showCreateInput = false;
    } catch (error) {
      console.error('Failed to create canvas:', error);
    } finally {
      isCreating = false;
    }
  }

  function openPage(canvas: CanvasInfo) {
    if (renamingId === canvas.id) return;
    vaultStore.openCanvas(canvas);
  }

  async function handleDeleteCanvas(canvas: CanvasInfo) {
    if (
      !settings.current.general.confirmDelete ||
      (await confirmDanger(`Delete "${canvas.name}"?\n\nThis permanently deletes the page and all its nodes and edges.`, 'Delete page'))
    ) {
      await vaultStore.deleteCanvasById(canvas.path);
    }
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

  function handleFilterKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && pages[0]) openPage(pages[0]);
    if (e.key === 'Escape') query = '';
  }

  // Vault sidebar: clicking a vault browses its pages; the last page stays one Esc away.
  let switchingPath = $state<string | null>(null);
  let vaultError = $state<string | null>(null);
  let vaultList = $state<HTMLElement>();
  let lastPage = $derived(vaultStore.lastCanvas);
  // Recent vaults whose folder is gone (moved, renamed or deleted).
  const missing = new SvelteSet<string>();

  onMount(() => {
    for (const v of vaultStore.recentVaults) {
      if (!samePath(v.path, vaultStore.currentVault?.path)) {
        isValidVault(v.path).then((ok) => { if (!ok) missing.add(v.path); }).catch(() => {});
      }
    }
  });

  function hueFor(name: string): number {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  async function browseVault(path: string) {
    if (switchingPath || samePath(path, vaultStore.currentVault?.path)) return;
    switchingPath = path;
    vaultError = null;
    query = '';
    const vault = await vaultStore.switchVault(path, { openPage: false });
    switchingPath = null;
    if (vault) {
      missing.delete(path);
    } else if (!(await isValidVault(path).catch(() => false))) {
      missing.add(path);
    } else {
      vaultError = vaultStore.error ?? "Couldn't open that vault";
    }
  }

  async function forgetVault(vault: { name: string; path: string }) {
    const ok = missing.has(vault.path) || (await confirmDanger(
      `Remove "${vault.name}" from the list?\n\nThe vault's files stay on disk at:\n${vault.path}`,
      'Remove vault from list',
      'Remove'
    ));
    if (!ok) return;
    vaultStore.removeFromRecent(vault.path);
    missing.delete(vault.path);
  }

  async function locateVault(vault: { name: string; path: string }) {
    const selected = await open({ directory: true, multiple: false, title: `Locate "${vault.name}"` });
    if (typeof selected !== 'string') return;
    await browseVault(selected);
    if (samePath(vaultStore.currentVault?.path, selected)) {
      vaultStore.removeFromRecent(vault.path);
      missing.delete(vault.path);
    }
  }

  // Resizable vault sidebar; double-click the divider to reset.
  const RAIL_KEY = 'mosaicflow:vault-rail-width';
  const RAIL_DEFAULT = 220;
  const clampRail = (w: number) => Math.min(420, Math.max(160, Math.round(w)));
  let railWidth = $state(clampRail(Number(localStorage.getItem(RAIL_KEY)) || RAIL_DEFAULT));
  let resizingRail = $state(false);

  function startRailResize(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = railWidth;
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released; the drag still works while the cursor stays on the handle.
    }
    resizingRail = true;
    const move = (ev: PointerEvent) => (railWidth = clampRail(startWidth + ev.clientX - startX));
    const end = () => {
      resizingRail = false;
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      localStorage.setItem(RAIL_KEY, String(railWidth));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function resetRail() {
    railWidth = RAIL_DEFAULT;
    localStorage.setItem(RAIL_KEY, String(railWidth));
  }

  function handleRailKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    if (e.key === 'ArrowLeft') railWidth = clampRail(railWidth - step);
    else if (e.key === 'ArrowRight') railWidth = clampRail(railWidth + step);
    else return;
    e.preventDefault();
    localStorage.setItem(RAIL_KEY, String(railWidth));
  }

  let importMenuOpen = $state(false);
  let importMenu = $state<HTMLElement>();

  function chooseImport(task: () => Promise<unknown>) {
    importMenuOpen = false;
    runImport(task);
  }

  async function openVaultFolder() {
    const selected = await open({ directory: true, multiple: false, title: 'Open MosaicVault' });
    if (typeof selected === 'string') await browseVault(selected);
  }

  function handleWindowKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && importMenuOpen) {
      importMenuOpen = false;
      return;
    }
    if (e.key !== 'Escape' || e.defaultPrevented || !lastPage) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (showCreateInput || renamingId || document.querySelector('[role="dialog"]')) return;
    e.preventDefault();
    vaultStore.openCanvas(lastPage);
  }

  $effect(() => {
    const focusVaults = () => vaultList?.querySelector<HTMLElement>('.vault-item')?.focus();
    window.addEventListener('mosaicflow:openVaultSwitcher', focusVaults);
    return () => window.removeEventListener('mosaicflow:openVaultSwitcher', focusVaults);
  });
</script>

<svelte:window
  onkeydown={handleWindowKey}
  onpointerdown={(e) => { if (importMenuOpen && !importMenu?.contains(e.target as Node)) importMenuOpen = false; }}
/>

<div class="cl-page" class:resizing={resizingRail}>
  {#if dropActive}
    <div class="drop-overlay">
      <PackageOpen size={28} />
      <p>Drop to import</p>
      <span>.mosaic · .zip · Obsidian .canvas · .json · Mermaid · folders of .md notes</span>
    </div>
  {/if}

  <aside class="vault-rail" aria-label="Vaults" style="width: {railWidth}px">
    <div class="rail-title">Vaults</div>
    <nav class="rail-list" bind:this={vaultList}>
      {#each vaultStore.recentVaults as vault (vault.path)}
        {@const current = samePath(vault.path, vaultStore.currentVault?.path)}
        {@const gone = missing.has(vault.path)}
        <div
          class="vault-item"
          class:current
          class:gone
          role="button"
          tabindex="0"
          title={gone ? `Folder not found: ${vault.path}` : vault.path}
          aria-current={current ? 'true' : undefined}
          onclick={() => (gone ? locateVault(vault) : browseVault(vault.path))}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              if (gone) locateVault(vault);
              else browseVault(vault.path);
            }
            else if (e.key === 'Delete' && !current) forgetVault(vault);
            else if (e.key === 'ArrowDown') (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
            else if (e.key === 'ArrowUp') (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
          }}
        >
          <span class="avatar" style="--hue: {hueFor(vault.name)}">{(vault.name.trim()[0] ?? '?').toUpperCase()}</span>
          <span class="vault-text">
            <span class="vault-name">{vault.name}</span>
            {#if gone}<span class="vault-missing">Folder not found · click to locate</span>{/if}
          </span>
          {#if switchingPath === vault.path}
            <Loader2 size={12} class="animate-spin vault-meta" />
          {:else if current}
            <span class="vault-meta">{vaultStore.canvases.length}</span>
          {:else}
            <button
              class="vault-remove"
              onclick={(e) => { e.stopPropagation(); forgetVault(vault); }}
              title="Remove from list (files stay on disk)"
              aria-label="Remove {vault.name} from the list"
            ><X size={12} /></button>
          {/if}
        </div>
      {/each}
    </nav>
    {#if vaultError}
      <p class="rail-error">
        <span>{vaultError}</span>
        <button onclick={() => (vaultError = null)} aria-label="Dismiss"><X size={12} /></button>
      </p>
    {/if}
    <div class="rail-actions">
      <button onclick={openVaultFolder}><FolderOpen size={14} />Open vault…</button>
      <button onclick={() => vaultStore.closeVault()}><LayoutGrid size={14} />Manage vaults</button>
    </div>
  </aside>

  <!-- A focusable separator is the ARIA "window splitter" pattern. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="rail-divider"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize vault list"
    aria-valuenow={railWidth}
    aria-valuemin={160}
    aria-valuemax={420}
    tabindex="0"
    title="Drag to resize · double-click to reset"
    onpointerdown={startRailResize}
    ondblclick={resetRail}
    onkeydown={handleRailKey}
  ></div>

  <div class="cl-main">
  <div class="cl-wrap">
    <header class="cl-head">
      <span class="cl-vault">{vaultStore.currentVault?.name ?? 'Vault'}</span>
      <div class="cl-spacer"></div>
      <button class="ghost-btn" onclick={() => packageDialogs.openExport('all')} disabled={isImporting || vaultStore.canvases.length === 0} title="Export pages or the whole vault as a .mosaic package">
        <Archive size={14} /><span>Export</span>
      </button>
      <div class="import-menu" bind:this={importMenu}>
        <button class="ghost-btn" onclick={() => (importMenuOpen = !importMenuOpen)} disabled={isImporting} aria-haspopup="menu" aria-expanded={importMenuOpen}>
          {#if isImporting}<Loader2 size={14} class="animate-spin" />{:else}<PackageOpen size={14} />{/if}<span>Import</span><ChevronDown size={12} />
        </button>
        {#if importMenuOpen}
          <div class="menu" role="menu">
            <button role="menuitem" onclick={() => chooseImport(importFileDialog)}>
              <PackageOpen size={15} />
              <span class="menu-text"><span class="menu-title">File…</span><span class="menu-desc">.mosaic package, Obsidian .canvas, MosaicFlow JSON or Mermaid</span></span>
            </button>
            <button role="menuitem" onclick={() => chooseImport(importMarkdownFolderDialog)}>
              <FolderInput size={15} />
              <span class="menu-text"><span class="menu-title">Markdown notes folder…</span><span class="menu-desc">e.g. an Obsidian vault: each note becomes a node, [[wikilinks]] become edges</span></span>
            </button>
          </div>
        {/if}
      </div>
      <button class="primary-btn" onclick={() => (showCreateInput = true)}>
        <Plus size={14} /><span>New page</span>
      </button>
    </header>

    <div class="cl-title">
      <h1>Pages</h1>
      <span class="cl-count">{vaultStore.canvases.length}</span>
      {#if lastPage}
        <button class="resume" onclick={() => lastPage && vaultStore.openCanvas(lastPage)} title="Back to the page you last had open (Esc)">
          <kbd>Esc</kbd>
          <span class="resume-label">Continue</span>
          <span class="resume-name">{lastPage.name}</span>
        </button>
      {/if}
    </div>

    <div class="cl-toolbar">
      <label class="cl-search">
        <Search size={13} />
        <input type="text" bind:value={query} placeholder="Filter pages…" onkeydown={handleFilterKey} />
      </label>
      <div class="seg" role="group" aria-label="Sort pages">
        <button class:active={sortMode === 'recent'} onclick={() => (sortMode = 'recent')}>Recent</button>
        <button class:active={sortMode === 'name'} onclick={() => (sortMode = 'name')}>Name</button>
      </div>
    </div>

    <div class="cl-list">
      <div class="cl-row cl-columns" aria-hidden="true">
        <span class="col-name">Name</span>
        <span class="col-date">Edited</span>
        <span class="col-actions"></span>
      </div>

      {#if showCreateInput}
        <div class="cl-row creating">
          <FileText size={15} />
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="cl-input"
            type="text"
            bind:value={newCanvasName}
            placeholder="Untitled page"
            autofocus
            onkeydown={(e) => {
              if (e.key === 'Enter') handleCreateCanvas();
              if (e.key === 'Escape') { showCreateInput = false; newCanvasName = ''; }
            }}
            onblur={() => { if (!newCanvasName.trim()) showCreateInput = false; }}
          />
          {#if isCreating}<Loader2 size={14} class="animate-spin" />{:else}<kbd>Enter</kbd>{/if}
        </div>
      {/if}

      {#each pages as canvas (canvas.id)}
        <div
          class="cl-row page"
          role="button"
          tabindex="0"
          onclick={() => openPage(canvas)}
          ondblclick={() => startRename(canvas)}
          onkeydown={(e) => {
            if (renamingId === canvas.id) return;
            if (e.key === 'Enter') openPage(canvas);
            else if (e.key === 'F2') startRename(canvas);
          }}
        >
          <span class="col-name">
            <FileText size={15} />
            {#if renamingId === canvas.id}
              <input
                class="cl-input"
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
              <span class="name">{canvas.name}</span>
              {#if canvas.description}<span class="desc">{canvas.description}</span>{/if}
            {/if}
          </span>
          <span class="col-date">{formatRelativeTime(canvas.updated_at)}</span>
          <span class="col-actions">
            <button onclick={(e) => { e.stopPropagation(); startRename(canvas); }} title="Rename (F2)" aria-label="Rename {canvas.name}"><Pencil size={13} /></button>
            <button class="danger" onclick={(e) => { e.stopPropagation(); handleDeleteCanvas(canvas); }} title="Delete" aria-label="Delete {canvas.name}"><Trash2 size={13} /></button>
          </span>
        </div>
      {/each}

      {#if pages.length === 0 && query}
        <p class="cl-empty">No pages match "{query}"</p>
      {/if}

      <button class="cl-row new-row" onclick={() => (showCreateInput = true)}>
        <Plus size={15} /><span>New page</span>
      </button>
    </div>

    {#if vaultStore.canvases.length === 0}
      <div class="empty-state">
        <FileText size={36} strokeWidth={1.25} />
        <h3>No pages yet</h3>
        <p>Create your first page to start mapping.</p>
      </div>
    {/if}
  </div>
  </div>
</div>

<style>
  .drop-overlay {
    position: fixed;
    inset: 12px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 2px dashed rgba(91, 141, 239, 0.7);
    border-radius: 14px;
    background: rgba(13, 17, 23, 0.85);
    color: #93b4f5;
    pointer-events: none;
  }

  .drop-overlay p {
    font-size: 16px;
    font-weight: 600;
    color: var(--mf-text);
  }

  .drop-overlay span {
    font-size: 12px;
    color: var(--mf-text-2);
  }

  .cl-page {
    display: flex;
    height: 100vh;
    background: var(--mf-bg);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 13px;
  }

  .vault-rail {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    padding: 14px 8px;
    background: var(--mf-surface);
  }

  .rail-divider {
    position: relative;
    flex-shrink: 0;
    width: 1px;
    background: var(--mf-border);
    cursor: col-resize;
    outline: none;
  }

  /* Wider invisible grab area around the 1px line. */
  .rail-divider::before {
    content: '';
    position: absolute;
    inset: 0 -4px;
    z-index: 1;
  }

  .rail-divider:hover,
  .rail-divider:focus-visible,
  .resizing .rail-divider {
    background: var(--mf-accent);
    box-shadow: 0 0 0 1px var(--mf-accent);
  }

  .cl-page.resizing {
    cursor: col-resize;
    user-select: none;
  }

  .vault-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .vault-item.gone .vault-name {
    color: var(--mf-text-3);
    text-decoration: line-through;
  }

  .vault-item.gone .avatar {
    filter: grayscale(1);
    opacity: 0.6;
  }

  .vault-item.gone .vault-remove {
    display: grid;
  }

  .vault-missing {
    overflow: hidden;
    font-size: 10.5px;
    color: #f59e0b;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vault-item.gone {
    height: auto;
    min-height: 30px;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .rail-title {
    padding: 6px 8px 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--mf-text-3);
  }

  .rail-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .vault-item {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 8px;
    border-radius: var(--mf-radius);
    color: var(--mf-text-2);
    cursor: pointer;
    outline: none;
  }

  .vault-item:hover,
  .vault-item:focus-visible {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .vault-item.current {
    background: var(--mf-active);
    color: var(--mf-text);
    font-weight: 500;
  }

  .avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    background: hsl(var(--hue) 55% 45% / 0.25);
    color: hsl(var(--hue) 80% 75%);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
  }

  .vault-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vault-item :global(.vault-meta),
  .vault-meta {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--mf-text-3);
    font-variant-numeric: tabular-nums;
  }

  .vault-remove {
    display: none;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .vault-item:hover .vault-remove {
    display: grid;
  }

  .vault-remove:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .rail-error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 6px 8px;
    font-size: 11.5px;
    color: #f87171;
    overflow-wrap: anywhere;
  }

  .rail-error button {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
  }

  .rail-error button:hover {
    background: var(--mf-hover);
  }

  .import-menu {
    position: relative;
  }

  .import-menu .menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    width: 300px;
    padding: 4px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 8px;
    background: var(--mf-surface-2);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .import-menu .menu button {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    background: transparent;
    color: var(--mf-text);
    text-align: left;
  }

  .import-menu .menu button:hover {
    background: var(--mf-hover);
  }

  .import-menu .menu :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
    color: var(--mf-text-3);
  }

  .menu-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-title {
    font-size: 12.5px;
    font-weight: 500;
  }

  .menu-desc {
    font-size: 11.5px;
    color: var(--mf-text-3);
    line-height: 1.35;
  }

  .rail-actions {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-top: 8px;
    border-top: 1px solid var(--mf-border);
  }

  .rail-actions button {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-2);
    font-size: 12.5px;
  }

  .rail-actions button:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .rail-actions :global(svg) {
    color: var(--mf-text-3);
  }

  .cl-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
  }

  .cl-wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 14px 24px 48px;
  }

  .cl-head {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 36px;
  }

  .cl-vault {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cl-spacer {
    flex: 1;
  }

  .resume {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 50%;
    height: 28px;
    margin-left: auto;
    padding: 0 10px 0 5px;
    border: 1px solid var(--mf-border);
    border-radius: var(--mf-radius);
    background: var(--mf-surface);
    color: var(--mf-text-2);
    font-size: 12.5px;
    align-self: center;
  }

  .resume:hover {
    border-color: var(--mf-border-strong);
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .resume :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .resume-label {
    color: var(--mf-text-3);
  }

  .resume-name {
    overflow: hidden;
    color: var(--mf-text);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .resume kbd {
    padding: 1px 5px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 4px;
    font-family: inherit;
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .ghost-btn,
  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px;
    border-radius: var(--mf-radius);
    font-size: 12.5px;
  }

  .ghost-btn {
    background: transparent;
    color: var(--mf-text-2);
  }

  .ghost-btn :global(svg) {
    color: var(--mf-text-3);
  }

  .ghost-btn:hover:not(:disabled) {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .primary-btn {
    margin-left: 4px;
    padding: 0 10px;
    background: var(--mf-accent);
    color: #fff;
    font-weight: 500;
  }

  .primary-btn:hover {
    filter: brightness(1.1);
  }

  .cl-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 36px 0 12px;
  }

  .cl-title h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .cl-count {
    font-size: 13px;
    color: var(--mf-text-3);
    font-variant-numeric: tabular-nums;
  }

  .cl-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .cl-search {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--mf-border);
    border-radius: var(--mf-radius);
    background: var(--mf-surface);
    color: var(--mf-text-3);
    cursor: text;
  }

  .cl-search:focus-within {
    border-color: var(--mf-accent);
  }

  .cl-search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mf-text);
    font-size: 12.5px;
  }

  .seg {
    display: inline-flex;
    gap: 1px;
    padding: 2px;
    border: 1px solid var(--mf-border);
    border-radius: var(--mf-radius);
    background: var(--mf-surface);
  }

  .seg button {
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    font-size: 12px;
  }

  .seg button:hover {
    color: var(--mf-text);
  }

  .seg button.active {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .cl-list {
    display: flex;
    flex-direction: column;
  }

  .cl-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 110px 52px;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 8px;
    border-bottom: 1px solid var(--mf-border);
    color: var(--mf-text);
    text-align: left;
    outline: none;
  }

  .cl-columns {
    min-height: 28px;
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .cl-row.page {
    cursor: pointer;
    border-radius: 0;
  }

  .cl-row.page:hover,
  .cl-row.page:focus-visible {
    background: var(--mf-hover);
  }

  .col-name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .col-name :global(svg),
  .creating :global(svg),
  .new-row :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .name {
    flex-shrink: 0;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .desc {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--mf-text-3);
    font-size: 12px;
  }

  .col-date {
    font-size: 12px;
    color: var(--mf-text-3);
    white-space: nowrap;
  }

  .col-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1px;
    opacity: 0;
  }

  .cl-row.page:hover .col-actions,
  .cl-row.page:focus-within .col-actions {
    opacity: 1;
  }

  .col-actions button {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .col-actions button:hover {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .col-actions button.danger:hover {
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
  }

  .creating {
    display: flex;
    background: var(--mf-hover);
  }

  .creating kbd {
    font-family: inherit;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .cl-input {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--mf-accent);
    border-radius: 4px;
    background: var(--mf-surface-2);
    color: var(--mf-text);
    font-size: 13px;
  }

  .new-row {
    display: flex;
    width: 100%;
    border-bottom: none;
    background: transparent;
    color: var(--mf-text-3);
    cursor: pointer;
  }

  .new-row:hover {
    background: var(--mf-hover);
    color: var(--mf-text-2);
  }

  .cl-empty {
    margin: 0;
    padding: 12px 8px;
    color: var(--mf-text-3);
    font-size: 12.5px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 48px 16px;
    text-align: center;
    color: var(--mf-text-3);
  }

  .empty-state h3 {
    margin: 4px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--mf-text-2);
  }

  .empty-state p {
    margin: 0;
    font-size: 12.5px;
  }

  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
