<script lang="ts">
  import { onMount } from 'svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import PropertiesPanel from '$lib/components/PropertiesPanel.svelte';
  import Landing from '$lib/components/Landing.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { appConfig } from '$lib/stores/appConfig.svelte';
  import { saveWorkspace, loadWorkspace, exportAsZip, createWorkspace } from '$lib/services/fileOperations';
  import { open, save, message } from '@tauri-apps/plugin-dialog';
  
  let showProperties = $state(false);
  let currentWorkspacePath = $state<string | null>(null);
  let showCreateDialog = $state(false);
  let newWorkspaceName = $state('');
  
  // Show properties when a node is selected
  $effect(() => {
    if (workspace.selectedNodeIds.length === 1) {
      showProperties = true;
    }
  });

  onMount(async () => {
    await appConfig.initialize();
  });

  async function handleOpenWorkspace(path: string) {
    try {
      workspace.workspacePath = path;
      const success = await loadWorkspace(path);
      if (success) {
        currentWorkspacePath = path;
        // Add to recent workspaces
        const name = path.split(/[\\/]/).pop() || 'Workspace';
        appConfig.addRecentWorkspace(name, path);
      }
    } catch (err) {
      console.error('Failed to open workspace:', err);
      await message('Failed to open workspace', { title: 'Error', kind: 'error' });
    }
  }

  async function handleCreateWorkspace() {
    if (!appConfig.containerPath) {
      await message('Please select a workspace folder first', { title: 'Error', kind: 'error' });
      return;
    }
    
    // Prompt for workspace name
    const name = prompt('Enter workspace name:');
    if (!name) return;
    
    const path = `${appConfig.containerPath}/${name.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
    
    try {
      const success = await createWorkspace(path, name);
      if (success) {
        currentWorkspacePath = path;
        appConfig.addRecentWorkspace(name, path);
        await message('Workspace created successfully!', { title: 'Created', kind: 'info' });
      } else {
        await message('Failed to create workspace', { title: 'Error', kind: 'error' });
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
      await message('Failed to create workspace', { title: 'Error', kind: 'error' });
    }
  }
  
  async function handleHome() {
    // Go back to landing
    currentWorkspacePath = null;
    workspace.workspacePath = null;
  }

  async function handleSave() {
    try {
      const success = await saveWorkspace();
      if (success) {
        await message('Workspace saved successfully!', { title: 'Saved', kind: 'info' });
      } else {
        await message('Failed to save workspace', { title: 'Error', kind: 'error' });
      }
    } catch (err) {
      console.error('Failed to save:', err);
      await message('Failed to save workspace', { title: 'Error', kind: 'error' });
    }
  }

  async function handleOpen() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Open Workspace'
    });
    
    if (selected && typeof selected === 'string') {
      await handleOpenWorkspace(selected);
    }
  }

  async function handleExport() {
    try {
      const success = await exportAsZip();
      if (success) {
        await message('Workspace exported successfully!', { title: 'Exported', kind: 'info' });
      } else {
        await message('Failed to export workspace', { title: 'Error', kind: 'error' });
      }
    } catch (err) {
      console.error('Failed to export:', err);
      await message('Failed to export workspace', { title: 'Error', kind: 'error' });
    }
  }

  function handleSettings() {
    showProperties = !showProperties;
  }
</script>

{#if !appConfig.initialized || !currentWorkspacePath}
  <Landing onOpenWorkspace={handleOpenWorkspace} onCreateWorkspace={handleCreateWorkspace} />
{:else}
  <div class="app">
    <Sidebar 
      onHome={handleHome}
      onSave={handleSave}
      onOpen={handleOpen}
      onExport={handleExport}
      onSettings={handleSettings}
    />
    
    <div class="main-content">
      <div class="canvas-container">
        <Canvas />
      </div>
      
      {#if showProperties}
        <PropertiesPanel onClose={() => showProperties = false} />
      {/if}
    </div>
  </div>
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
