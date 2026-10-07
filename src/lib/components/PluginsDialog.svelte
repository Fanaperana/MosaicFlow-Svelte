<!--
  Manage user plugins from {APP_DATA}/plugins: enable/disable, see errors, open the folder, rescan.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Puzzle, FolderOpen, RefreshCw, X, TriangleAlert, ShieldAlert, Loader2 } from 'lucide-svelte';
  import { pluginStore } from '$lib/stores/plugins.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  onMount(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={onClose}>
  <div class="dialog" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="plugins-title" onclick={(e) => e.stopPropagation()}>
    <header>
      <Puzzle size={16} />
      <h2 id="plugins-title">Plugins</h2>
      <span class="count">{pluginStore.activeCount} active</span>
      <button class="icon-btn" onclick={() => pluginStore.rescan()} disabled={pluginStore.busy} title="Rescan the plugins folder" aria-label="Rescan">
        {#if pluginStore.busy}<Loader2 size={14} class="animate-spin" />{:else}<RefreshCw size={14} />{/if}
      </button>
      <button class="icon-btn" onclick={onClose} aria-label="Close"><X size={15} /></button>
    </header>

    <div class="notice">
      <ShieldAlert size={14} />
      <p>Plugins run with the same access as MosaicFlow, including your vault files. Only enable plugins you trust.</p>
    </div>

    <div class="list">
      {#each pluginStore.plugins as plugin (plugin.manifest.id)}
        {@const m = plugin.manifest}
        <div class="plugin" class:error={plugin.status === 'error'}>
          <div class="info">
            <div class="title-row">
              <span class="name">{m.name}</span>
              <span class="version">v{m.version}</span>
              {#if plugin.status === 'loading'}<Loader2 size={12} class="animate-spin" />{/if}
            </div>
            {#if m.description}<p class="desc">{m.description}</p>{/if}
            <p class="meta">
              {m.author || 'Unknown author'}
              {#if plugin.nodeTypes.length} · adds {plugin.nodeTypes.join(', ')}{/if}
            </p>
            {#if plugin.error}
              <p class="err"><TriangleAlert size={12} />{plugin.error}</p>
            {/if}
          </div>
          <input
            type="checkbox"
            class="switch"
            checked={plugin.enabled}
            disabled={pluginStore.busy || plugin.status === 'loading'}
            onchange={(e) => pluginStore.setEnabled(m.id, (e.target as HTMLInputElement).checked)}
            aria-label="Enable {m.name}"
          />
        </div>
      {:else}
        <div class="empty">
          <Puzzle size={28} strokeWidth={1.25} />
          <p>No plugins installed yet.</p>
          <span>Put a plugin folder (with a <code>plugin.json</code>) into the plugins folder, then rescan.</span>
        </div>
      {/each}
    </div>

    <footer>
      <span class="path" title={pluginStore.dir}>{pluginStore.dir}</span>
      <button class="folder-btn" onclick={() => pluginStore.openFolder()}>
        <FolderOpen size={14} />Open plugins folder
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
    gap: 8px;
    height: 44px;
    padding: 0 8px 0 14px;
    border-bottom: 1px solid var(--mf-border);
    color: var(--mf-text-2);
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--mf-text);
  }

  .count {
    flex: 1;
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

  .notice {
    display: flex;
    gap: 8px;
    margin: 10px 12px 4px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.1);
    color: #f5b041;
  }

  .notice :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .notice p {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--mf-text-2);
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
  }

  .plugin {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 8px;
    border-radius: 8px;
  }

  .plugin:hover {
    background: var(--mf-hover);
  }

  .info {
    flex: 1;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    font-size: 13px;
    font-weight: 600;
  }

  .version {
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .desc,
  .meta,
  .err {
    margin: 2px 0 0;
    line-height: 1.45;
  }

  .desc {
    color: var(--mf-text-2);
  }

  .meta {
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .err {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    font-size: 11.5px;
    color: var(--mf-danger);
    word-break: break-word;
  }

  .err :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .switch {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    width: 30px;
    height: 17px;
    margin: 2px 0 0;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--mf-active);
    cursor: pointer;
    transition: background 0.15s;
  }

  .switch::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #cfcfd4;
    transition: transform 0.15s;
  }

  .switch:checked {
    background: var(--mf-accent);
  }

  .switch:checked::before {
    transform: translateX(13px);
    background: #fff;
  }

  .switch:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 28px 16px;
    text-align: center;
    color: var(--mf-text-3);
  }

  .empty p {
    margin: 0;
    font-size: 13px;
    color: var(--mf-text-2);
  }

  .empty span {
    font-size: 12px;
  }

  code {
    font-family: var(--mf-font-mono);
    font-size: 11px;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-top: 1px solid var(--mf-border);
  }

  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mf-font-mono);
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .folder-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--mf-radius);
    background: var(--mf-active);
    color: var(--mf-text);
    font-size: 12.5px;
  }

  .folder-btn:hover {
    background: var(--mf-border-strong);
  }
</style>
