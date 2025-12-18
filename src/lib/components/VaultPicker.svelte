<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { FolderOpen, Plus, Clock, Trash2, ArrowRight, Layers, Loader2, AlertCircle } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';

  let isCreating = $state(false);
  let newVaultName = $state('');
  let selectedParentPath = $state<string | null>(null);
  let showCreateForm = $state(false);

  async function selectParentFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select folder for your MosaicVault',
      });
      
      if (selected && typeof selected === 'string') {
        selectedParentPath = selected;
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }

  async function handleCreateVault() {
    if (!selectedParentPath || !newVaultName.trim()) return;
    
    isCreating = true;
    try {
      await vaultStore.createVault(selectedParentPath, newVaultName.trim());
    } catch (error) {
      console.error('Failed to create vault:', error);
    } finally {
      isCreating = false;
    }
  }

  async function handleOpenVault() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open MosaicVault',
      });
      
      if (selected && typeof selected === 'string') {
        await vaultStore.openVault(selected);
      }
    } catch (error) {
      console.error('Failed to open vault:', error);
    }
  }

  async function handleOpenRecent(path: string) {
    await vaultStore.openVault(path);
  }

  function handleRemoveRecent(path: string, e: Event) {
    e.stopPropagation();
    vaultStore.removeFromRecent(path);
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  function startCreate() {
    showCreateForm = true;
    newVaultName = '';
    selectedParentPath = null;
  }

  function cancelCreate() {
    showCreateForm = false;
    newVaultName = '';
    selectedParentPath = null;
  }
</script>

<div class="vault-picker">
  <div class="vault-picker-content">
    <!-- Logo and Title -->
    <div class="header">
      <div class="logo">
        <Layers size={48} strokeWidth={1.5} />
      </div>
      <h1>MosaicFlow</h1>
      <p class="tagline">Visual canvas for OSINT investigations</p>
    </div>

    {#if vaultStore.isLoading}
      <div class="loading-container">
        <Loader2 size={32} class="animate-spin" />
        <p>Loading...</p>
      </div>
    {:else if vaultStore.error}
      <div class="error-container">
        <AlertCircle size={24} />
        <p>{vaultStore.error}</p>
        <Button onclick={() => vaultStore.error = null} variant="outline" size="sm">
          Dismiss
        </Button>
      </div>
    {:else if showCreateForm}
      <!-- Create Vault Form -->
      <div class="create-form">
        <h2>Create New MosaicVault</h2>
        <p class="form-description">
          A MosaicVault is where all your canvases and investigations are stored.
        </p>
        
        <div class="form-field">
          <label for="vault-name">Vault Name</label>
          <input
            id="vault-name"
            type="text"
            bind:value={newVaultName}
            placeholder="My Investigation"
            class="vault-name-input"
          />
        </div>
        
        <div class="form-field">
          <label>Location</label>
          {#if selectedParentPath}
            <div class="selected-path">
              <span class="path-text">{selectedParentPath}</span>
              <button class="change-btn" onclick={selectParentFolder}>Change</button>
            </div>
          {:else}
            <Button onclick={selectParentFolder} variant="outline" class="w-full">
              <FolderOpen size={18} class="mr-2" />
              Select Folder
            </Button>
          {/if}
        </div>

        {#if selectedParentPath && newVaultName}
          <p class="vault-path-preview">
            Will be created at: <code>{selectedParentPath}/{newVaultName.replace(/[^a-zA-Z0-9-_\s]/g, '_')}</code>
          </p>
        {/if}
        
        <div class="form-actions">
          <Button onclick={cancelCreate} variant="ghost">
            Cancel
          </Button>
          <Button 
            onclick={handleCreateVault} 
            disabled={!selectedParentPath || !newVaultName.trim() || isCreating}
          >
            {#if isCreating}
              <Loader2 size={18} class="mr-2 animate-spin" />
              Creating...
            {:else}
              Create Vault
            {/if}
          </Button>
        </div>
      </div>
    {:else}
      <!-- Main vault picker -->
      <div class="vault-options">
        <div class="actions">
          <button class="action-card" onclick={startCreate}>
            <Plus size={24} strokeWidth={1.5} />
            <span>Create New Vault</span>
            <p class="action-desc">Start a fresh investigation workspace</p>
          </button>
          <button class="action-card" onclick={handleOpenVault}>
            <FolderOpen size={24} strokeWidth={1.5} />
            <span>Open Existing Vault</span>
            <p class="action-desc">Open a vault you've created before</p>
          </button>
        </div>

        {#if vaultStore.recentVaults.length > 0}
          <div class="recent-section">
            <h3>
              <Clock size={16} strokeWidth={1.5} />
              Recent Vaults
            </h3>
            <div class="recent-list">
              {#each vaultStore.recentVaults as vault}
                <div class="recent-item">
                  <button 
                    class="recent-info-btn"
                    onclick={() => handleOpenRecent(vault.path)}
                  >
                    <div class="recent-info">
                      <span class="recent-name">{vault.name}</span>
                      <span class="recent-path">{vault.path}</span>
                    </div>
                    <div class="recent-meta">
                      <span class="recent-date">{formatDate(vault.last_opened)}</span>
                      <ArrowRight size={16} class="arrow" />
                    </div>
                  </button>
                  <button 
                    class="delete-btn"
                    onclick={(e) => handleRemoveRecent(vault.path, e)}
                    title="Remove from recent"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .vault-picker {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
    padding: 2rem;
  }

  .vault-picker-content {
    max-width: 600px;
    width: 100%;
  }

  .header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 20px;
    margin-bottom: 1.5rem;
    color: white;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(135deg, #fff 0%, #888 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    color: #888;
    font-size: 1rem;
    margin: 0;
  }

  .loading-container,
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 16px;
    text-align: center;
  }

  .error-container {
    border-color: #ef4444;
  }

  .error-container p {
    color: #ef4444;
  }

  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .create-form {
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 16px;
    padding: 2rem;
  }

  .create-form h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .form-description {
    color: #888;
    font-size: 0.875rem;
    margin: 0 0 1.5rem 0;
  }

  .form-field {
    margin-bottom: 1.25rem;
  }

  .form-field label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #ccc;
  }

  .vault-name-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: #0a0a0f;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    color: #fafafa;
    font-size: 1rem;
  }

  .vault-name-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .selected-path {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #0a0a0f;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
  }

  .path-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    color: #ccc;
  }

  .change-btn {
    background: transparent;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .change-btn:hover {
    text-decoration: underline;
  }

  .vault-path-preview {
    font-size: 0.75rem;
    color: #666;
    margin: 0.5rem 0 1rem;
  }

  .vault-path-preview code {
    background: #0a0a0f;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem 1.5rem;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    color: #fafafa;
    text-align: center;
  }

  .action-card:hover {
    border-color: #3b82f6;
    background: #1a1a2e;
  }

  .action-card span {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .action-desc {
    font-size: 0.75rem;
    color: #666;
    margin: 0;
  }

  .recent-section h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #888;
    margin: 0 0 1rem 0;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .recent-item:hover {
    border-color: #3b82f6;
    background: #1a1a2e;
  }

  .recent-info-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: #fafafa;
  }

  .recent-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow: hidden;
  }

  .recent-name {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .recent-path {
    font-size: 0.75rem;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .recent-date {
    font-size: 0.75rem;
    color: #666;
    white-space: nowrap;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    border-radius: 6px;
    opacity: 0;
    transition: all 0.2s;
  }

  .recent-item:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .recent-meta :global(.arrow) {
    color: #666;
  }

  .recent-item:hover :global(.arrow) {
    color: #3b82f6;
  }
</style>
