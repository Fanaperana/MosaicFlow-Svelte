<script lang="ts">
  import { tick } from 'svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { vaultStore, samePath } from '$lib/stores/vault.svelte';
  import { keybindings } from '$lib/kernel/keybindings.svelte';
  import { formatRelativeTime } from '$lib/services/vaultService';
  import { confirmDanger } from '$lib/utils/confirm';
  import { ChevronsUpDown, Check, FolderOpen, Plus, Search, X, Loader2, CircleAlert } from 'lucide-svelte';

  interface Props {
    size?: 'sm' | 'lg';
  }

  let { size = 'sm' }: Props = $props();

  let isOpen = $state(false);
  let query = $state('');
  let activeIndex = $state(0);
  let switchingPath = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let root = $state<HTMLDivElement>();
  let searchInput = $state<HTMLInputElement>();

  let current = $derived(vaultStore.currentVault);
  let others = $derived(vaultStore.recentVaults.filter((v) => !samePath(v.path, current?.path)));
  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return others;
    return others.filter((v) => v.name.toLowerCase().includes(q) || v.path.toLowerCase().includes(q));
  });

  $effect(() => {
    if (activeIndex >= filtered.length) activeIndex = Math.max(0, filtered.length - 1);
  });

  function hueFor(name: string): number {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  function initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  async function setOpen(next: boolean) {
    isOpen = next;
    if (!next) return;
    query = '';
    activeIndex = 0;
    errorMessage = null;
    await tick();
    searchInput?.focus();
  }

  async function switchTo(path: string) {
    if (switchingPath) return;
    switchingPath = path;
    errorMessage = null;
    const vault = await vaultStore.switchVault(path);
    switchingPath = null;
    if (vault) isOpen = false;
    else errorMessage = vaultStore.error ?? "Couldn't open that vault";
  }

  async function openFolder() {
    const selected = await open({ directory: true, multiple: false, title: 'Open MosaicVault' });
    if (typeof selected === 'string') await switchTo(selected);
  }

  function manageVaults() {
    isOpen = false;
    vaultStore.closeVault();
  }

  function handleMenuKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      isOpen = false;
    } else if (e.key === 'ArrowDown' && filtered.length) {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % filtered.length;
    } else if (e.key === 'ArrowUp' && filtered.length) {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      switchTo(filtered[activeIndex].path);
    }
  }

  function handleWindowPointer(e: PointerEvent) {
    if (isOpen && root && !root.contains(e.target as Node)) isOpen = false;
  }

  let shortcut = $derived(keybindings.label('vault.switch'));

  $effect(() => {
    const toggle = () => setOpen(!isOpen);
    window.addEventListener('mosaicflow:openVaultSwitcher', toggle);
    return () => window.removeEventListener('mosaicflow:openVaultSwitcher', toggle);
  });
</script>

<svelte:window onpointerdown={handleWindowPointer} />

<div class="vault-switcher {size}" bind:this={root}>
  <button
    class="trigger"
    class:open={isOpen}
    onclick={() => setOpen(!isOpen)}
    title={shortcut ? `Switch vault (${shortcut})` : 'Switch vault'}
    aria-haspopup="menu"
    aria-expanded={isOpen}
  >
    <span class="avatar" style="--hue: {hueFor(current?.name ?? 'Vault')}">{initial(current?.name ?? 'Vault')}</span>
    <span class="trigger-name">{current?.name || 'Vault'}</span>
    <ChevronsUpDown size={size === 'lg' ? 16 : 12} class="trigger-chevron" />
  </button>

  {#if isOpen}
    <div class="menu" role="menu" tabindex="-1" onkeydown={handleMenuKey}>
      {#if current}
        <div class="current">
          <span class="avatar lg" style="--hue: {hueFor(current.name)}">{initial(current.name)}</span>
          <div class="current-text">
            <span class="current-name">{current.name}</span>
            <span class="current-path" title={current.path}>{current.path}</span>
          </div>
          <Check size={14} class="current-check" />
        </div>
      {/if}

      {#if others.length > 0}
        <div class="search">
          <Search size={13} />
          <input
            bind:this={searchInput}
            bind:value={query}
            type="text"
            placeholder="Switch to…"
            oninput={() => (activeIndex = 0)}
          />
        </div>

        <div class="list">
          {#each filtered as vault, i (vault.path)}
            <div
              class="item"
              class:active={i === activeIndex}
              role="menuitem"
              tabindex="-1"
              onpointerenter={() => (activeIndex = i)}
              onclick={() => switchTo(vault.path)}
              onkeydown={(e) => e.key === 'Enter' && switchTo(vault.path)}
              title={vault.path}
            >
              <span class="avatar" style="--hue: {hueFor(vault.name)}">{initial(vault.name)}</span>
              <span class="item-name">{vault.name}</span>
              {#if switchingPath === vault.path}
                <Loader2 size={13} class="animate-spin item-meta" />
              {:else}
                <span class="item-meta">{formatRelativeTime(vault.last_opened)}</span>
                <button
                  class="item-remove"
                  onclick={async (e) => {
                    e.stopPropagation();
                    if (await confirmDanger(`Remove "${vault.name}" from the list?\n\nThe vault's files stay on disk at:\n${vault.path}`, 'Remove vault from list', 'Remove')) {
                      vaultStore.removeFromRecent(vault.path);
                    }
                  }}
                  aria-label="Remove {vault.name} from recent vaults"
                  title="Remove from list"
                ><X size={12} /></button>
              {/if}
            </div>
          {:else}
            <p class="empty">No vault matches "{query}"</p>
          {/each}
        </div>
      {/if}

      {#if errorMessage}
        <p class="error"><CircleAlert size={13} />{errorMessage}</p>
      {/if}

      <div class="divider"></div>
      <button class="action" onclick={openFolder} role="menuitem">
        <FolderOpen size={14} />Open another vault…
      </button>
      <button class="action" onclick={manageVaults} role="menuitem">
        <Plus size={14} />Create or manage vaults…
      </button>
      {#if shortcut}<div class="footer">{#each shortcut.split('+') as part}<kbd>{part}</kbd>{/each} to switch vaults</div>{/if}
    </div>
  {/if}
</div>

<style>
  .vault-switcher {
    position: relative;
    display: inline-flex;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    height: 24px;
    padding: 0 6px 0 4px;
    border: none;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-2);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .trigger:hover,
  .trigger.open {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .trigger :global(.trigger-chevron) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .trigger-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lg .trigger {
    max-width: 420px;
    height: 40px;
    padding: 0 10px 0 6px;
    gap: 10px;
    color: var(--mf-text);
    font-size: 1.5rem;
    font-weight: 600;
  }

  .lg .trigger .avatar {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    font-size: 14px;
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

  .avatar.lg {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    font-size: 13px;
  }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 1000;
    width: 290px;
    padding: 4px;
    border: 1px solid var(--mf-border-strong);
    border-radius: 10px;
    background: var(--mf-surface-2);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
    font-weight: 400;
    outline: none;
  }

  .current {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 8px;
  }

  .current-text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .current-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .current-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: left;
    font-family: var(--mf-font-mono);
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .current :global(.current-check) {
    flex-shrink: 0;
    color: var(--mf-accent);
  }

  .search {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    margin: 0 2px 4px;
    padding: 0 8px;
    border: 1px solid var(--mf-border);
    border-radius: var(--mf-radius);
    background: var(--mf-surface);
    color: var(--mf-text-3);
  }

  .search:focus-within {
    border-color: var(--mf-accent);
  }

  .search input {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12.5px;
    outline: none;
  }

  .search input::placeholder {
    color: var(--mf-text-3);
  }

  .list {
    display: flex;
    flex-direction: column;
    max-height: 260px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 6px;
    border-radius: var(--mf-radius);
    color: var(--mf-text-2);
    cursor: pointer;
  }

  .item.active {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-meta,
  .item :global(.item-meta) {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .item-remove {
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

  .item.active .item-remove {
    display: grid;
  }

  .item.active .item-meta {
    display: none;
  }

  .item-remove:hover {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .empty {
    margin: 0;
    padding: 6px 8px;
    font-size: 12px;
    color: var(--mf-text-3);
  }

  .error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 4px 2px 0;
    padding: 6px 8px;
    border-radius: var(--mf-radius);
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
    font-size: 11.5px;
    line-height: 1.4;
    word-break: break-all;
  }

  .error :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .divider {
    height: 1px;
    margin: 4px 2px;
    background: var(--mf-border);
  }

  .action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 30px;
    padding: 0 6px;
    border: none;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-2);
    font-family: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }

  .action:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .action :global(svg) {
    color: var(--mf-text-3);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 6px 6px 2px;
    border-top: 1px solid var(--mf-border);
    margin-top: 4px;
    font-size: 11px;
    color: var(--mf-text-3);
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
