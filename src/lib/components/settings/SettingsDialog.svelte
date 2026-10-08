<!--
  Settings window (Ctrl+,): General, Appearance, Canvas, Keyboard shortcuts, Plugins, About.
  Everything is saved to {APP_DATA}/settings.json.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Settings2, Palette, LayoutGrid, Keyboard, Puzzle, Info, X, FileJson, RotateCcw, Check } from 'lucide-svelte';
  import { ui, type SettingsSection } from '$lib/stores/ui.svelte';
  import {
    settings,
    ACCENT_PRESETS,
    APPEARANCE_LIMITS,
    type AppearanceSettings,
    type CanvasBackground,
    type UiFont,
    type MonoFont,
  } from '$lib/stores/settings.svelte';
  import { themeRegistry } from '$lib/kernel/registries/contribution-registry';
  import { keybindings } from '$lib/kernel/keybindings.svelte';
  import KeybindingsSettings from './KeybindingsSettings.svelte';
  import PluginsSettings from './PluginsSettings.svelte';

  const SECTIONS: { id: SettingsSection; label: string; icon: typeof Settings2 }[] = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
    { id: 'keybindings', label: 'Keyboard shortcuts', icon: Keyboard },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
    { id: 'about', label: 'About', icon: Info },
  ];

  let s = $derived(settings.current);
  let title = $derived(SECTIONS.find((x) => x.id === ui.settingsSection)?.label ?? 'Settings');
  let themes = $state(themeRegistry.getAll());
  let themeMissing = $derived(!themes.some((t) => t.id === s.appearance.theme));
  let cssDraft = $state(settings.current.appearance.customCss);
  let cssTimer: ReturnType<typeof setTimeout> | undefined;
  let cssPending = false;

  function setAppearance(patch: Partial<AppearanceSettings>) {
    settings.update('appearance', patch);
  }

  const num = (e: Event) => Number((e.target as HTMLInputElement).value);
  const percent = (v: number) => `${Math.round(v * 100)}%`;

  function editCss(value: string) {
    cssDraft = value;
    cssPending = true;
    clearTimeout(cssTimer);
    cssTimer = setTimeout(() => {
      cssPending = false;
      setAppearance({ customCss: value });
    }, 400);
  }

  function close() {
    if (!keybindings.recording) ui.settingsOpen = false;
  }

  async function revealSettingsFile() {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    await revealItemInDir(settings.filePath);
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !keybindings.recording) close();
    };
    window.addEventListener('keydown', onKey);
    const stopThemes = themeRegistry.subscribe(() => (themes = themeRegistry.getAll()));
    return () => {
      window.removeEventListener('keydown', onKey);
      stopThemes();
      clearTimeout(cssTimer);
    };
  });

  // Keep the editor in sync when appearance is reset or changed by a plugin.
  $effect(() => {
    const css = settings.current.appearance.customCss;
    if (!cssPending) cssDraft = css;
  });
</script>

{#snippet toggle(checked: boolean, onchange: (v: boolean) => void, label: string)}
  <input type="checkbox" class="switch" {checked} onchange={(e) => onchange((e.target as HTMLInputElement).checked)} aria-label={label} />
{/snippet}

{#snippet slider(key: 'uiScale' | 'textScale' | 'iconScale', label: string)}
  {@const limits = APPEARANCE_LIMITS[key]}
  <div class="range">
    <input type="range" min={limits.min} max={limits.max} step={limits.step} value={s.appearance[key]}
      aria-label={label} oninput={(e) => setAppearance({ [key]: num(e) })} />
    <button class="value link" onclick={() => setAppearance({ [key]: 1 })} title="Reset to 100%">{percent(s.appearance[key])}</button>
  </div>
{/snippet}

{#snippet colorPicker(value: string, onchange: (v: string) => void, label: string)}
  <label class="swatch custom" style="--c: {value}" title={label}>
    <input type="color" {value} aria-label={label} oninput={(e) => onchange((e.target as HTMLInputElement).value)} />
  </label>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="backdrop" role="presentation" onclick={close}>
  <div class="window" role="dialog" tabindex="-1" aria-modal="true" aria-label="Settings" onclick={(e) => e.stopPropagation()}>
    <nav>
      <div class="nav-title">Settings</div>
      {#each SECTIONS as section (section.id)}
        <button class="nav-item" class:active={ui.settingsSection === section.id} onclick={() => (ui.settingsSection = section.id)}>
          <section.icon size={15} />{section.label}
        </button>
      {/each}
      <div class="nav-spacer"></div>
      <button class="nav-item muted" onclick={revealSettingsFile} title={settings.filePath}>
        <FileJson size={15} />settings.json
      </button>
    </nav>

    <main>
      <header>
        <h2>{title}</h2>
        {#if ui.settingsSection === 'general' || ui.settingsSection === 'appearance' || ui.settingsSection === 'canvas'}
          {@const section = ui.settingsSection}
          <button class="ghost" onclick={() => settings.resetSection(section)} title="Restore the defaults of this section">
            <RotateCcw size={13} />Reset
          </button>
        {/if}
        <button class="icon-btn" onclick={close} aria-label="Close settings"><X size={16} /></button>
      </header>

      <div class="content">
        {#if ui.settingsSection === 'general'}
          <div class="row">
            <div class="text"><span>Link hover previews</span><small>Show a preview card when hovering [[links]], backlinks and embeds.</small></div>
            {@render toggle(s.general.hoverPreviews, (v) => settings.update('general', { hoverPreviews: v }), 'Link hover previews')}
          </div>
          <div class="row" class:disabled={!s.general.hoverPreviews}>
            <div class="text"><span>Preview delay</span><small>How long to hover before the preview appears.</small></div>
            <div class="range">
              <input type="range" min="0" max="1500" step="50" value={s.general.previewDelay}
                disabled={!s.general.hoverPreviews}
                oninput={(e) => settings.update('general', { previewDelay: Number((e.target as HTMLInputElement).value) })} />
              <span class="value">{s.general.previewDelay} ms</span>
            </div>
          </div>
          <div class="row">
            <div class="text"><span>Confirm before deleting pages</span><small>Ask before a page is deleted from the sidebar or page list.</small></div>
            {@render toggle(s.general.confirmDelete, (v) => settings.update('general', { confirmDelete: v }), 'Confirm before deleting pages')}
          </div>

        {:else if ui.settingsSection === 'appearance'}
          <h3>Colors</h3>
          <div class="row">
            <div class="text">
              <span>Theme</span>
              <small>
                {#if themeMissing}The selected theme's plugin is off or missing, so the default is shown.{:else}Colors of the interface and canvas. Plugins can add more.{/if}
              </small>
            </div>
            <select class="control" value={themeMissing ? '' : s.appearance.theme} onchange={(e) => setAppearance({ theme: (e.target as HTMLSelectElement).value })} aria-label="Theme">
              {#if themeMissing}<option value="" disabled>Unavailable theme</option>{/if}
              {#each themes as theme (theme.id)}
                <option value={theme.id}>{theme.name}{theme.pluginId === 'core' ? '' : ' (plugin)'}</option>
              {/each}
            </select>
          </div>
          <div class="row">
            <div class="text"><span>Accent color</span><small>Used for selection, focus rings and highlights.</small></div>
            <div class="swatches">
              {#each ACCENT_PRESETS as color (color)}
                <button class="swatch" style="--c: {color}" class:active={s.appearance.accent.toLowerCase() === color} onclick={() => setAppearance({ accent: color })} aria-label="Accent {color}">
                  {#if s.appearance.accent.toLowerCase() === color}<Check size={12} />{/if}
                </button>
              {/each}
              {@render colorPicker(s.appearance.accent, (v) => setAppearance({ accent: v }), 'Custom accent color')}
            </div>
          </div>

          <h3>Size</h3>
          <div class="row">
            <div class="text"><span>Interface scale</span><small>Zooms the whole window, like browser zoom.</small></div>
            {@render slider('uiScale', 'Interface scale')}
          </div>
          <div class="row">
            <div class="text"><span>Text size</span><small>Text in menus, panels and dialogs. Blocks on the canvas keep their size.</small></div>
            {@render slider('textScale', 'Text size')}
          </div>
          <div class="row">
            <div class="text"><span>Density</span><small>Height of rows in menus and lists.</small></div>
            <div class="seg">
              {#each [['compact', 'Compact'], ['default', 'Default'], ['comfortable', 'Comfortable']] as [value, label] (value)}
                <button class:active={s.appearance.density === value} onclick={() => setAppearance({ density: value as AppearanceSettings['density'] })}>{label}</button>
              {/each}
            </div>
          </div>
          <div class="row">
            <div class="text"><span>Corner radius</span><small>Roundness of buttons, inputs and menus.</small></div>
            <div class="range">
              <input type="range" min={APPEARANCE_LIMITS.radius.min} max={APPEARANCE_LIMITS.radius.max} step="1" value={s.appearance.radius}
                aria-label="Corner radius" oninput={(e) => setAppearance({ radius: num(e) })} />
              <span class="value">{s.appearance.radius}px</span>
            </div>
          </div>

          <h3>Fonts</h3>
          <div class="row">
            <div class="text"><span>Interface font</span><small>Font for menus, panels and node text.</small></div>
            <div class="stack">
              <select class="control" value={s.appearance.uiFont} onchange={(e) => setAppearance({ uiFont: (e.target as HTMLSelectElement).value as UiFont })} aria-label="Interface font">
                <option value="space-grotesk">Space Grotesk</option>
                <option value="system">System</option>
                <option value="serif">Serif</option>
                <option value="mono">PT Mono</option>
                <option value="custom">Installed font…</option>
              </select>
              {#if s.appearance.uiFont === 'custom'}
                <input class="control" type="text" placeholder="Font name, e.g. Inter" value={s.appearance.customUiFont}
                  aria-label="Installed interface font" onchange={(e) => setAppearance({ customUiFont: (e.target as HTMLInputElement).value.trim() })} />
              {/if}
            </div>
          </div>
          <div class="row">
            <div class="text"><span>Code font</span><small>Font for code blocks, ids and the code editor.</small></div>
            <div class="stack">
              <select class="control" value={s.appearance.monoFont} onchange={(e) => setAppearance({ monoFont: (e.target as HTMLSelectElement).value as MonoFont })} aria-label="Code font">
                <option value="pt-mono">PT Mono</option>
                <option value="space-mono">Space Mono</option>
                <option value="system">System monospace</option>
                <option value="custom">Installed font…</option>
              </select>
              {#if s.appearance.monoFont === 'custom'}
                <input class="control" type="text" placeholder="Font name, e.g. JetBrains Mono" value={s.appearance.customMonoFont}
                  aria-label="Installed code font" onchange={(e) => setAppearance({ customMonoFont: (e.target as HTMLInputElement).value.trim() })} />
              {/if}
            </div>
          </div>

          <h3>Icons</h3>
          <div class="row">
            <div class="text"><span>Icon size</span><small>Icons in the ribbon, toolbars, menus and panels.</small></div>
            {@render slider('iconScale', 'Icon size')}
          </div>
          <div class="row">
            <div class="text"><span>Icon color</span><small>Default follows the text around each icon.</small></div>
            <div class="swatches">
              <div class="seg">
                {#each [['default', 'Default'], ['accent', 'Accent'], ['custom', 'Custom']] as [value, label] (value)}
                  <button class:active={s.appearance.iconColor === value} onclick={() => setAppearance({ iconColor: value as AppearanceSettings['iconColor'] })}>{label}</button>
                {/each}
              </div>
              {#if s.appearance.iconColor === 'custom'}
                {@render colorPicker(s.appearance.customIconColor, (v) => setAppearance({ customIconColor: v }), 'Icon color')}
              {/if}
            </div>
          </div>
          <div class="row">
            <div class="text"><span>Icon weight</span><small>Line thickness of icons.</small></div>
            <div class="seg">
              {#each [['thin', 'Thin'], ['regular', 'Regular'], ['bold', 'Bold']] as [value, label] (value)}
                <button class:active={s.appearance.iconWeight === value} onclick={() => setAppearance({ iconWeight: value as AppearanceSettings['iconWeight'] })}>{label}</button>
              {/each}
            </div>
          </div>

          <h3>Advanced</h3>
          <div class="row">
            <div class="text"><span>Reduce motion</span><small>Turn off animations and transitions.</small></div>
            {@render toggle(s.appearance.reduceMotion, (v) => setAppearance({ reduceMotion: v }), 'Reduce motion')}
          </div>
          <div class="row column">
            <div class="text">
              <span>Custom CSS</span>
              <small>Applied on top of everything, like Obsidian snippets. Use variables such as <code>--mf-bg</code>, <code>--mf-text</code> or <code>--mf-accent</code>; see the plugin API docs for the full list.</small>
            </div>
            <textarea class="css-editor" spellcheck="false" placeholder={':root {\n  --mf-bg: #101418;\n}'} value={cssDraft}
              aria-label="Custom CSS" oninput={(e) => editCss((e.target as HTMLTextAreaElement).value)}></textarea>
          </div>

        {:else if ui.settingsSection === 'canvas'}
          <div class="row">
            <div class="text"><span>Background</span><small>Pattern behind the nodes.</small></div>
            <div class="seg">
              {#each [['dots', 'Dots'], ['lines', 'Lines'], ['cross', 'Cross'], ['none', 'None']] as [value, label] (value)}
                <button class:active={s.canvas.background === value} onclick={() => settings.update('canvas', { background: value as CanvasBackground })}>{label}</button>
              {/each}
            </div>
          </div>
          <div class="row">
            <div class="text"><span>Grid size</span><small>Spacing of the background pattern and of snapping.</small></div>
            <div class="range">
              <input type="range" min="8" max="64" step="4" value={s.canvas.gridSize}
                oninput={(e) => settings.update('canvas', { gridSize: Number((e.target as HTMLInputElement).value) })} />
              <span class="value">{s.canvas.gridSize}px</span>
            </div>
          </div>
          <div class="row">
            <div class="text"><span>Snap to grid</span><small>Nodes move in grid steps while dragging.</small></div>
            {@render toggle(s.canvas.snapToGrid, (v) => settings.update('canvas', { snapToGrid: v }), 'Snap to grid')}
          </div>
          <div class="row">
            <div class="text"><span>Minimap</span><small>Overview of the page in the bottom-left corner.</small></div>
            {@render toggle(s.canvas.showMinimap, (v) => settings.update('canvas', { showMinimap: v }), 'Minimap')}
          </div>
          <div class="row">
            <div class="text"><span>Zoom controls</span><small>Zoom and fit buttons in the bottom-right corner.</small></div>
            {@render toggle(s.canvas.showControls, (v) => settings.update('canvas', { showControls: v }), 'Zoom controls')}
          </div>
          <div class="row">
            <div class="text"><span>Double-click to insert</span><small>Double-click empty space to open the block menu.</small></div>
            {@render toggle(s.canvas.doubleClickInsert, (v) => settings.update('canvas', { doubleClickInsert: v }), 'Double-click to insert')}
          </div>

        {:else if ui.settingsSection === 'keybindings'}
          <KeybindingsSettings />

        {:else if ui.settingsSection === 'plugins'}
          <PluginsSettings />

        {:else}
          <div class="about">
            <img src="/MosaicFlow-Word.png" alt="MosaicFlow" />
            <p>A node-based knowledge base: notes, research and ideas on an infinite canvas, stored as plain files you own.</p>
            <dl>
              <dt>Settings file</dt><dd title={settings.filePath}>{settings.filePath}</dd>
            </dl>
            <p class="hint">Settings, shortcuts and plugin options are stored in <code>settings.json</code>. Copy it to another machine to bring your setup along.</p>
          </div>
        {/if}
      </div>
    </main>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1600;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.5);
    animation: fade 0.12s ease-out;
  }

  @keyframes fade {
    from { opacity: 0; }
  }

  .window {
    display: flex;
    width: min(900px, calc(100vw - 48px));
    height: min(640px, calc(100vh - 64px));
    overflow: hidden;
    border: 1px solid var(--mf-border-strong);
    border-radius: 12px;
    background: var(--mf-surface);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: calc(210px * var(--mf-text-scale, 1));
    flex-shrink: 0;
    padding: 12px 8px;
    border-right: 1px solid var(--mf-border);
    background: var(--mf-bg);
  }

  .nav-title {
    padding: 4px 10px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--mf-text-3);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 30px;
    padding: 0 10px;
    border-radius: 6px;
    background: transparent;
    color: var(--mf-text-2);
    font-size: 13px;
    text-align: left;
    white-space: nowrap;
  }

  .nav-item :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .nav-item:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .nav-item.active {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .nav-item.active :global(svg) {
    color: var(--mf-accent);
  }

  .nav-item.muted {
    font-size: 12px;
    color: var(--mf-text-3);
  }

  .nav-spacer {
    flex: 1;
  }

  main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  header {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 52px;
    flex-shrink: 0;
    padding: 0 12px 0 24px;
    border-bottom: 1px solid var(--mf-border);
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px 28px;
    scrollbar-width: thin;
  }

  .ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
    font-size: 12px;
  }

  .ghost:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
  }

  .icon-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 24px;
    min-height: 56px;
    padding: 8px 0;
    border-bottom: 1px solid var(--mf-border);
  }

  .row.disabled {
    opacity: 0.5;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .text span {
    font-size: 13px;
    font-weight: 500;
  }

  .text small {
    font-size: 12px;
    color: var(--mf-text-3);
  }

  .switch {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    width: 32px;
    height: 18px;
    margin: 0;
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
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #cfcfd4;
    transition: transform 0.15s;
  }

  .switch:checked {
    background: var(--mf-accent);
  }

  .switch:checked::before {
    transform: translateX(14px);
    background: #fff;
  }

  .control {
    height: 30px;
    min-width: 180px;
    padding: 0 8px;
    border: 1px solid var(--mf-border-strong);
    border-radius: var(--mf-radius);
    background: var(--mf-surface-2);
    color: var(--mf-text);
    font-size: 12.5px;
  }

  .range {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .range input {
    width: 160px;
    padding: 0;
    border: none;
    background: transparent;
    accent-color: var(--mf-accent);
  }

  .value {
    min-width: 56px;
    font-size: 12px;
    color: var(--mf-text-2);
    font-variant-numeric: tabular-nums;
    text-align: right;
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
    height: 26px;
    padding: 0 12px;
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

  .swatches {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--c);
    color: #0b0b0e;
    cursor: pointer;
  }

  .swatch.active {
    border-color: var(--mf-text);
  }

  .swatch.custom {
    position: relative;
    overflow: hidden;
    background: conic-gradient(#f43f5e, #f59e0b, #22c55e, #14b8a6, #5b8def, #8b7cf6, #f43f5e);
  }

  .swatch.custom input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    opacity: 0;
    cursor: pointer;
  }

  h3 {
    margin: 22px 0 2px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--mf-text-3);
  }

  h3:first-child {
    margin-top: 0;
  }

  .row.column {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .value.link {
    padding: 0;
    background: transparent;
    cursor: pointer;
  }

  .value.link:hover {
    color: var(--mf-accent);
  }

  .text code {
    font-family: var(--mf-font-mono);
    font-size: 11px;
  }

  .css-editor {
    min-height: 140px;
    padding: 10px;
    border: 1px solid var(--mf-border-strong);
    border-radius: var(--mf-radius);
    background: var(--mf-bg);
    color: var(--mf-text);
    font-family: var(--mf-font-mono);
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
    tab-size: 2;
  }

  .css-editor:focus {
    outline: none;
    border-color: var(--mf-accent);
  }

  .about {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 520px;
  }

  .about img {
    width: 220px;
  }

  .about p {
    margin: 0;
    color: var(--mf-text-2);
    line-height: 1.5;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 16px;
    margin: 0;
  }

  dt {
    color: var(--mf-text-3);
  }

  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mf-font-mono);
    font-size: 11.5px;
  }

  .hint {
    font-size: 12px;
  }

  code {
    font-family: var(--mf-font-mono);
    font-size: 11.5px;
  }
</style>
