<!-- Settings → Plugins: enable/disable user plugins, their errors, and settings they contribute. -->
<script lang="ts">
  import { FolderOpen, RefreshCw, TriangleAlert, ShieldAlert, Loader2, Puzzle } from 'lucide-svelte';
  import { pluginStore } from '$lib/stores/plugins.svelte';
  import { settings } from '$lib/stores/settings.svelte';
</script>

<div class="plugins">
  <div class="notice">
    <ShieldAlert size={14} />
    <p>Plugins run with the same access as MosaicFlow, including your vault files. New plugins stay off until you enable them; only enable plugins you trust.</p>
  </div>

  <div class="actions">
    <span class="count">{pluginStore.activeCount} of {pluginStore.plugins.length} active</span>
    <button class="ghost" onclick={() => pluginStore.rescan()} disabled={pluginStore.busy}>
      {#if pluginStore.busy}<Loader2 size={13} class="animate-spin" />{:else}<RefreshCw size={13} />{/if}Rescan
    </button>
    <button class="ghost" onclick={() => pluginStore.openFolder()}><FolderOpen size={13} />Open plugins folder</button>
  </div>

  {#each pluginStore.plugins as plugin (plugin.manifest.id)}
    {@const m = plugin.manifest}
    {@const contributed = settings.pluginDefs[m.id]?.defs ?? []}
    <div class="card" class:error={plugin.status === 'error'}>
      <div class="head">
        <div class="info">
          <div class="title-row">
            <span class="name">{m.name}</span>
            <span class="version">v{m.version}</span>
            {#if plugin.status === 'loading'}<Loader2 size={12} class="animate-spin" />{/if}
          </div>
          {#if m.description}<p class="desc">{m.description}</p>{/if}
          <p class="meta">
            {m.author || 'Unknown author'}{#if plugin.nodeTypes.length} · adds {plugin.nodeTypes.join(', ')}{/if}
          </p>
          {#if plugin.error}<p class="err"><TriangleAlert size={12} />{plugin.error}</p>{/if}
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

      {#if plugin.status === 'active' && contributed.length}
        <div class="fields">
          {#each contributed as def (def.key)}
            {@const value = settings.getPluginSetting(m.id, def.key)}
            <label class="field">
              <span class="field-text">
                <span>{def.label}</span>
                {#if def.description}<span class="field-desc">{def.description}</span>{/if}
              </span>
              {#if def.type === 'toggle'}
                <input type="checkbox" class="switch" checked={!!value} onchange={(e) => settings.setPluginSetting(m.id, def.key, (e.target as HTMLInputElement).checked)} />
              {:else if def.type === 'select'}
                <select class="control" value={String(value ?? '')} onchange={(e) => settings.setPluginSetting(m.id, def.key, (e.target as HTMLSelectElement).value)}>
                  {#each def.options ?? [] as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
                </select>
              {:else if def.type === 'number'}
                <input class="control num" type="number" value={Number(value ?? 0)} onchange={(e) => settings.setPluginSetting(m.id, def.key, Number((e.target as HTMLInputElement).value))} />
              {:else}
                <input class="control" type="text" value={String(value ?? '')} onchange={(e) => settings.setPluginSetting(m.id, def.key, (e.target as HTMLInputElement).value)} />
              {/if}
            </label>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty">
      <Puzzle size={28} strokeWidth={1.25} />
      <p>No plugins installed yet.</p>
      <span>Put a plugin folder (with a <code>plugin.json</code>) into the plugins folder, then click Rescan.</span>
    </div>
  {/each}

  <p class="path" title={pluginStore.dir}>{pluginStore.dir}</p>
</div>

<style>
  .plugins {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .notice {
    display: flex;
    gap: 8px;
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

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .count {
    flex: 1;
    font-size: 12px;
    color: var(--mf-text-3);
  }

  .ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-2);
    font-size: 12.5px;
  }

  .ghost:hover:not(:disabled) {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .card {
    border: 1px solid var(--mf-border);
    border-radius: 10px;
  }

  .card.error {
    border-color: rgba(239, 100, 97, 0.35);
  }

  .head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
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

  .version,
  .meta {
    font-size: 11.5px;
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

  .err {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    font-size: 11.5px;
    color: var(--mf-danger);
    word-break: break-word;
  }

  .fields {
    display: flex;
    flex-direction: column;
    padding: 4px 12px 8px;
    border-top: 1px solid var(--mf-border);
  }

  .field {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
  }

  .field-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    font-size: 12.5px;
  }

  .field-desc {
    font-size: 11.5px;
    color: var(--mf-text-3);
  }

  .control {
    height: 28px;
    min-width: 160px;
    padding: 0 8px;
    border: 1px solid var(--mf-border-strong);
    border-radius: var(--mf-radius);
    background: var(--mf-surface-2);
    color: var(--mf-text);
    font-size: 12.5px;
  }

  .control.num {
    min-width: 0;
    width: 90px;
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

  code {
    font-family: var(--mf-font-mono);
    font-size: 11px;
  }

  .path {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mf-font-mono);
    font-size: 10.5px;
    color: var(--mf-text-3);
  }
</style>
