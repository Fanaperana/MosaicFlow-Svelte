<script lang="ts">
  import { onMount } from 'svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import PropertiesPanel from '$lib/components/PropertiesPanel.svelte';
  import VaultPicker from '$lib/components/VaultPicker.svelte';
  import CanvasList from '$lib/components/CanvasList.svelte';
  import CanvasHeader from '$lib/components/CanvasHeader.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { saveWorkspace, loadWorkspace } from '$lib/services/fileOperations';
  import { message } from '@tauri-apps/plugin-dialog';
  
  let showProperties = $state(false);
  let canvasLoaded = $state(false);
  
  // Show properties when a node is selected
  $effect(() => {
    if (workspace.selectedNodeIds.length === 1) {
      showProperties = true;
    }
  });

  // Load canvas when current canvas changes
  $effect(() => {
    if (vaultStore.currentCanvas && !canvasLoaded) {
      loadCurrentCanvas();
    }
  });

  onMount(async () => {
    // Initialize vault store on mount
    await vaultStore.initialize();
  });

  async function loadCurrentCanvas() {
    if (!vaultStore.currentCanvas) return;
    
    try {
      const success = await loadWorkspace(vaultStore.currentCanvas.path);
      if (success) {
        workspace.workspacePath = vaultStore.currentCanvas.path;
        canvasLoaded = true;
      }
    } catch (err) {
      console.error('Failed to load canvas:', err);
    }
  }
  
  async function handleHome() {
    // Save current canvas first
    if (workspace.isModified) {
      await handleSave();
    }
    
    // Go back to canvas list or vault picker
    canvasLoaded = false;
    workspace.clear();
    vaultStore.closeCanvas();
  }

  async function handleSave() {
    try {
      const success = await saveWorkspace();
      if (success) {
        await message('Canvas saved successfully!', { title: 'Saved', kind: 'info' });
      } else {
        await message('Failed to save canvas', { title: 'Error', kind: 'error' });
      }
    } catch (err) {
      console.error('Failed to save:', err);
      await message('Failed to save canvas', { title: 'Error', kind: 'error' });
    }
  }

  async function handleOpen() {
    // Save current, then go to canvas list
    if (workspace.isModified) {
      await handleSave();
    }
    canvasLoaded = false;
    workspace.clear();
    vaultStore.closeCanvas();
  }

  async function handleExport() {
    // TODO: Implement export
    await message('Export feature coming soon!', { title: 'Info', kind: 'info' });
  }

  function handleSettings() {
    showProperties = !showProperties;
  }

  async function handleNewCanvas() {
    // Save current, then create new
    if (workspace.isModified) {
      await handleSave();
    }
    canvasLoaded = false;
    workspace.clear();
    await vaultStore.createCanvas('Untitled');
  }
</script>

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
      onHome={handleHome}
      onSave={handleSave}
      onOpen={handleOpen}
      onExport={handleExport}
      onSettings={handleSettings}
      onNewCanvas={handleNewCanvas}
      canvasName={vaultStore.currentCanvas.name}
      vaultName={vaultStore.currentVault?.name}
    />
    
    <div class="main-content">
      <div class="canvas-container">
        <CanvasHeader />
        <Canvas />
      </div>
      
      {#if showProperties}
        <PropertiesPanel onClose={() => showProperties = false} />
      {/if}
    </div>
  </div>
{:else}
  <VaultPicker />
{/if}

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(body) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #0a0a0f;
    color: #fafafa;
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
    margin-left: 52px;
    overflow: hidden;
  }
  
  .canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  
  /* Global scrollbar styles */
  :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }
  
  :global(::-webkit-scrollbar-track) {
    background: #0a0a0f;
  }
  
  :global(::-webkit-scrollbar-thumb) {
    background: #2a2a3a;
    border-radius: 4px;
  }
  
  :global(::-webkit-scrollbar-thumb:hover) {
    background: #3a3a4a;
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
