<!-- Settings → Keyboard shortcuts: every command (core and plugins), its keys, and a recorder to change them. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Search, Plus, X, RotateCcw } from 'lucide-svelte';
  import { commandRegistry, type CommandRegistration } from '$lib/kernel/registries/command-registry';
  import { keybindings, eventToChord, chordParts, normalizeChord } from '$lib/kernel/keybindings.svelte';
  import { COMMAND_CATEGORIES } from '$lib/commands/core';
  import { settings } from '$lib/stores/settings.svelte';

  let query = $state('');
  let recordingId = $state<string | null>(null);
  let notice = $state<{ id: string; text: string } | null>(null);

  let commands = $derived.by(() => {
    void keybindings.version;
    void settings.current.keybindings;
    return commandRegistry.getAll();
  });

  let groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    // A query that looks like a chord ("ctrl+k") also matches by key.
    const chordQuery = q.includes('+') || q.length === 1 ? normalizeChord(q) : '';
    const match = (c: CommandRegistration) =>
      !q ||
      c.label.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.category ?? '').toLowerCase().includes(q) ||
      keybindings.get(c.id).some((k) => k.toLowerCase().includes(q) || k === chordQuery);
    const byCategory = new Map<string, CommandRegistration[]>();
    for (const c of commands.filter(match)) {
      const cat = c.category ?? 'Other';
      byCategory.set(cat, [...(byCategory.get(cat) ?? []), c]);
    }
    const order = (cat: string) => (COMMAND_CATEGORIES.indexOf(cat) + 1 || 99);
    return [...byCategory].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b));
  });

  let customCount = $derived(Object.keys(settings.current.keybindings).length);

  function startRecording(id: string) {
    notice = null;
    recordingId = id;
    keybindings.recording = true;
    window.addEventListener('keydown', onRecordKey, true);
  }

  function stopRecording() {
    recordingId = null;
    keybindings.recording = false;
    window.removeEventListener('keydown', onRecordKey, true);
  }

  function onRecordKey(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!recordingId) return;
    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      stopRecording();
      return;
    }
    const chord = eventToChord(e);
    if (!chord) return;
    const id = recordingId;
    const taken = keybindings.assign(id, chord);
    if (taken.length) notice = { id, text: `${chordParts(chord).join('+')} was removed from “${taken.map((t) => t.label).join('”, “')}”.` };
    stopRecording();
  }

  onDestroy(stopRecording);
</script>

<div class="kb">
  <div class="toolbar">
    <label class="search">
      <Search size={13} />
      <input bind:value={query} placeholder="Search commands or keys (e.g. ctrl+k)" />
    </label>
    <button class="ghost" onclick={() => keybindings.resetAll()} disabled={customCount === 0} title="Restore every default shortcut">
      <RotateCcw size={13} />Reset all{customCount ? ` (${customCount})` : ''}
    </button>
  </div>

  <p class="intro">
    Click <strong>+</strong> and press the keys you want. Shortcuts marked with a dot were changed by you.
    Plugin commands appear here too.
  </p>

  {#each groups as [category, list] (category)}
    <section>
      <h3>{category}</h3>
      {#each list as cmd (cmd.id)}
        {@const chords = keybindings.get(cmd.id)}
        <div class="row" class:custom={keybindings.isCustom(cmd.id)}>
          <div class="info">
            <span class="label">
              {#if keybindings.isCustom(cmd.id)}<span class="dot" title="Changed"></span>{/if}
              {cmd.label}
              {#if cmd.pluginId !== 'core'}<span class="plugin">{cmd.pluginId}</span>{/if}
            </span>
            {#if notice?.id === cmd.id}<span class="notice">{notice.text}</span>{/if}
          </div>
          <div class="keys">
            {#each chords as chord (chord)}
              <span class="chord">
                {#each chordParts(chord) as part, i (i)}<kbd>{part}</kbd>{/each}
                <button class="remove" onclick={() => keybindings.remove(cmd.id, chord)} aria-label="Remove {chord}" title="Remove"><X size={10} /></button>
              </span>
            {/each}
            {#if recordingId === cmd.id}
              <span class="recording">Press keys… <span class="esc">Esc to cancel</span></span>
            {:else}
              <button class="icon" onclick={() => startRecording(cmd.id)} title="Add shortcut" aria-label="Add shortcut for {cmd.label}"><Plus size={13} /></button>
            {/if}
            <button
              class="icon"
              class:hidden={!keybindings.isCustom(cmd.id)}
              onclick={() => keybindings.reset(cmd.id)}
              title="Reset to default"
              aria-label="Reset {cmd.label}"
            ><RotateCcw size={12} /></button>
          </div>
        </div>
      {/each}
    </section>
  {:else}
    <p class="empty">No command matches “{query}”.</p>
  {/each}
</div>

<style>
  .kb {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .toolbar {
    position: sticky;
    top: -20px;
    z-index: 1;
    display: flex;
    gap: 8px;
    margin: -4px 0 0;
    padding: 4px 0 8px;
    background: var(--mf-surface);
  }

  .search {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--mf-border-strong);
    border-radius: var(--mf-radius);
    background: var(--mf-surface-2);
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
    font-size: 12.5px;
    outline: none;
  }

  .ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
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

  .intro {
    margin: 0 0 4px;
    font-size: 12px;
    color: var(--mf-text-3);
  }

  section {
    display: flex;
    flex-direction: column;
  }

  h3 {
    margin: 10px 0 2px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--mf-text-3);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 34px;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .row:hover {
    background: var(--mf-hover);
  }

  .info {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--mf-accent);
  }

  .plugin {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--mf-active);
    color: var(--mf-text-3);
    font-size: 10.5px;
    line-height: 16px;
  }

  .notice {
    font-size: 11.5px;
    color: #f5b041;
  }

  .keys {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .chord {
    position: relative;
    display: inline-flex;
    gap: 3px;
  }

  kbd {
    min-width: 20px;
    padding: 0 6px;
    border: 1px solid var(--mf-border-strong);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--mf-surface-2);
    color: var(--mf-text);
    font-family: inherit;
    font-size: 11.5px;
    line-height: 20px;
    text-align: center;
  }

  .remove {
    position: absolute;
    top: -6px;
    right: -6px;
    display: none;
    place-items: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border-radius: 50%;
    background: var(--mf-danger);
    color: #fff;
  }

  .chord:hover .remove {
    display: grid;
  }

  .recording {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 8px;
    border: 1px dashed var(--mf-accent);
    border-radius: 5px;
    color: var(--mf-accent);
    font-size: 12px;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .esc {
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  @keyframes pulse {
    50% { opacity: 0.55; }
  }

  .icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .icon:hover {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .icon.hidden {
    visibility: hidden;
  }

  .empty {
    margin: 12px 8px;
    color: var(--mf-text-3);
  }
</style>
