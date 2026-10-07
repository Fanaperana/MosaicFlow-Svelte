<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Canvas from '$lib/components/Canvas.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import PropertiesPanel from '$lib/components/PropertiesPanel.svelte';
  import VaultPicker from '$lib/components/VaultPicker.svelte';
  import CanvasList from '$lib/components/CanvasList.svelte';
  import CanvasHeader from '$lib/components/CanvasHeader.svelte';
  import QuickToolbar from '$lib/components/QuickToolbar.svelte';
  import WorkflowSearch from '$lib/components/WorkflowSearch.svelte';
  import PagesSidebar from '$lib/components/PagesSidebar.svelte';
  import LinkPreview from '$lib/components/LinkPreview.svelte';
  import PluginsDialog from '$lib/components/PluginsDialog.svelte';
  import { pageNav } from '$lib/stores/pages.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { loadWorkspace, exportAsPng, exportAsSvg, exportAsJson } from '$lib/services/fileOperations';
  import { exportCanvasPackage } from '$lib/services/packageService';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { consumePendingFocus, openWikilink } from '$lib/services/navigation';
  import { initOpenFiles, processOpenFiles } from '$lib/services/openFiles';
  import { openExternal } from '$lib/utils';
  import { message } from '@tauri-apps/plugin-dialog';
  import type { CanvasInfo } from '$lib/services/vaultService';
  
  let showSearch = $state(false);
  let showNodeList = $state(false);
  let showPlugins = $state(false);

  const PANEL_TRANSITION = { axis: 'x', duration: 200, easing: cubicOut } as const;
  
  // Track the current canvas ID to detect changes
  let currentCanvasId = $state<string | null>(null);

  // Load canvas when current canvas changes
  $effect(() => {
    const canvas = vaultStore.currentCanvas;
    if (canvas) untrack(() => pageNav.visit(canvas.id));
    if (canvas && canvas.id !== currentCanvasId) {
      currentCanvasId = canvas.id;
      loadCurrentCanvas();
    }
  });

  onMount(async () => {
    // Initialize vault store on mount
    await vaultStore.initialize();
  });

  // Files opened from the OS (double-clicked .mosaic etc.) are imported once a vault is open.
  onMount(() => {
    let stop: (() => void) | undefined;
    initOpenFiles().then((s) => (stop = s));
    return () => stop?.();
  });

  $effect(() => {
    if (vaultStore.isInitialized && vaultStore.currentVault) processOpenFiles();
  });

  // Vault-wide index for search, wikilinks, backlinks and tags
  $effect(() => {
    if (vaultStore.currentVault && vaultStore.canvases) knowledge.loadVault();
  });

  $effect(() => {
    void workspace.nodes;
    knowledge.scheduleLiveRefresh();
  });

  // Links inside rendered markdown: wikilinks navigate, tags highlight, web links open in the browser.
  function handleContentClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    const wikilink = target?.closest<HTMLAnchorElement>('a.wikilink');
    if (wikilink) {
      e.preventDefault();
      e.stopPropagation();
      openWikilink(wikilink.dataset.wikilink ?? '');
      return;
    }
    const tag = target?.closest<HTMLElement>('.tag-pill[data-tag]');
    if (tag) {
      e.stopPropagation();
      knowledge.toggleTag(tag.dataset.tag ?? null);
      return;
    }
    const link = target?.closest<HTMLAnchorElement>('.markdown-content a[href], .cm-markdoc-renderBlock a[href]');
    if (link) {
      e.preventDefault();
      openExternal(link.href);
    }
  }

  onMount(() => {
    document.addEventListener('click', handleContentClick, true);
    return () => document.removeEventListener('click', handleContentClick, true);
  });

  async function loadCurrentCanvas() {
    if (!vaultStore.currentCanvas) return;
    
    try {
      // Clear workspace first
      workspace.clear();
      
      // Always set the workspace path to the canvas path and initialize file services
      workspace.initFileServices(vaultStore.currentCanvas.path);
      // Sync name from canvas metadata
      workspace.name = vaultStore.currentCanvas.name;
      
      // Try to load existing workspace data
      const success = await loadWorkspace(vaultStore.currentCanvas.path);
      if (!success) {
        // If no workspace.json exists yet, that's fine - we just start fresh
        console.log('No existing workspace data, starting fresh');
      }
      await consumePendingFocus();
    } catch (err) {
      console.error('Failed to load canvas:', err);
    }
  }
  
  async function handleHome() {
    // Go back to canvas list or vault picker (auto-save handles persistence)
    currentCanvasId = null;
    workspace.clear();
    vaultStore.closeCanvas();
  }

  async function handleExport() {
    await exportAsJson();
  }

  async function handleExportPng() {
    try {
      const success = await exportAsPng();
      if (!success) {
        await message('Failed to export canvas as PNG', { title: 'Error', kind: 'error' });
      }
    } catch (err) {
      console.error('Failed to export PNG:', err);
      await message('Failed to export canvas as PNG', { title: 'Error', kind: 'error' });
    }
  }

  async function handleExportSvg() {
    try {
      const success = await exportAsSvg();
      if (!success) {
        await message('Failed to export canvas as SVG', { title: 'Error', kind: 'error' });
      }
    } catch (err) {
      console.error('Failed to export SVG:', err);
      await message('Failed to export canvas as SVG', { title: 'Error', kind: 'error' });
    }
  }

  async function handleNewCanvas() {
    // Create new canvas (auto-save handles current canvas persistence)
    // Name is auto-generated as "Untitled 1", "Untitled 2", etc.
    currentCanvasId = null;
    workspace.clear();
    await vaultStore.createCanvas();
  }

  function handleSearch() {
    showSearch = true;
  }

  async function handleCanvasSelect(canvas: CanvasInfo) {
    // Switch to selected canvas (auto-save handles persistence)
    await vaultStore.openCanvas(canvas);
    showSearch = false;
  }

  // Global keyboard shortcuts: search, page sidebar, back/forward between pages
  function handleGlobalKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && (e.key === 'k' || e.key === 'o')) {
      e.preventDefault();
      showSearch = !showSearch;
    } else if (mod && e.key === '\\' && vaultStore.appView === 'canvas') {
      e.preventDefault();
      pageNav.toggleSidebar();
    } else if (e.altKey && !mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && vaultStore.appView === 'canvas') {
      e.preventDefault();
      if (e.key === 'ArrowLeft') pageNav.goBack();
      else pageNav.goForward();
    }
  }

  // Mouse back/forward buttons
  function handleMouseNav(e: MouseEvent) {
    if (vaultStore.appView !== 'canvas' || (e.button !== 3 && e.button !== 4)) return;
    e.preventDefault();
    if (e.button === 3) pageNav.goBack();
    else pageNav.goForward();
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} onmouseup={handleMouseNav} />

{#if !vaultStore.isInitialized || vaultStore.isLoading}
  <div class="loading-screen">
    <div class="loader"></div>
    <p>Loading MosaicFlow...</p>
  </div>
{:else if vaultStore.appView === 'vault-picker'}
  <VaultPicker />
{:else if vaultStore.appView === 'canvas-list'}
  <CanvasList />
{:else if vaultStore.appView === 'canvas' && vaultStore.currentCanvas}
  <div class="app">
    <Sidebar 
      onSearch={handleSearch}
      onExport={handleExport}
      onExportPackage={exportCanvasPackage}
      onExportPng={handleExportPng}
      onExportSvg={handleExportSvg}
      onPlugins={() => (showPlugins = true)}
    />
    
    <div class="main-content">
      {#if pageNav.sidebarOpen}
        <div class="panel-slot" transition:slide={PANEL_TRANSITION}>
          <PagesSidebar onSearch={handleSearch} onNewCanvas={handleNewCanvas} onAllPages={handleHome} />
        </div>
      {/if}
      <div class="canvas-container">
        <CanvasHeader onToggleNodeList={() => showNodeList = !showNodeList} />
        <QuickToolbar />
        <Canvas showNodeList={showNodeList} onToggleNodeList={() => showNodeList = !showNodeList} />
      </div>
      
      {#if workspace.propertiesPanelOpen}
        <div class="panel-slot right" transition:slide={PANEL_TRANSITION}>
          <PropertiesPanel onClose={() => workspace.propertiesPanelOpen = false} />
        </div>
      {/if}
    </div>
    
    <WorkflowSearch 
      isOpen={showSearch}
      onClose={() => showSearch = false}
      onCanvasSelect={handleCanvasSelect}
    />
    <LinkPreview />
    {#if showPlugins}
      <PluginsDialog onClose={() => (showPlugins = false)} />
    {/if}
  </div>
{:else}
  <VaultPicker />
{/if}

<style lang="postcss">
  @reference "tailwindcss";

  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(body) {
    background-color: var(--mf-bg);
    color: var(--mf-text);
    overflow: hidden;
  }
  
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 1rem;
  }

  .loader {
    width: 40px;
    height: 40px;
    border: 3px solid #2a2a3a;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-screen p {
    color: #888;
    font-size: 0.875rem;
  }
  
  .app {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }
  
  .main-content {
    display: flex;
    flex: 1;
    margin-left: 44px;
    overflow: hidden;
  }
  
  .canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  /* Fixed-width panels are clipped while the slot's width animates */
  .panel-slot {
    display: flex;
    flex-shrink: 0;
    height: 100vh;
  }

  .panel-slot.right {
    justify-content: flex-end;
  }
  
  /* Global scrollbar styles */
  :global(::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }
  
  :global(::-webkit-scrollbar-track) {
    background: transparent;
  }
  
  :global(::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  :global(::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.18);
  }
  
  /* Global button styles */
  :global(button) {
    font-family: inherit;
    cursor: pointer;
    border: none;
    outline: none;
  }
  
  :global(button:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  /* Global input styles */
  :global(input),
  :global(textarea),
  :global(select) {
    font-family: inherit;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 6px;
    color: #fafafa;
    padding: 8px 12px;
  }
  
  :global(input:focus),
  :global(textarea:focus),
  :global(select:focus) {
    outline: none;
    border-color: #3b82f6;
  }
  
  :global(input::placeholder) {
    color: #666;
  }
  
  /* Global link styles */
  :global(a) {
    color: #3b82f6;
    text-decoration: none;
  }
  
  :global(a:hover) {
    text-decoration: underline;
  }
</style>
