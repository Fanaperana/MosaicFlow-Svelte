<script lang="ts">
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Pencil, Check, X, ChevronRight, Loader2 } from 'lucide-svelte';

  let isEditing = $state(false);
  let editName = $state('');
  let isSaving = $state(false);

  function startEditing() {
    editName = vaultStore.currentCanvas?.name || 'Untitled';
    isEditing = true;
  }

  async function saveEdit() {
    if (!editName.trim() || editName === vaultStore.currentCanvas?.name) {
      isEditing = false;
      return;
    }

    isSaving = true;
    try {
      const success = await vaultStore.renameCurrentCanvas(editName.trim());
      if (success) {
        // Also update the workspace name
        workspace.name = editName.trim();
      }
    } catch (error) {
      console.error('Failed to rename canvas:', error);
    } finally {
      isSaving = false;
      isEditing = false;
    }
  }

  function cancelEdit() {
    isEditing = false;
    editName = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }
</script>

<div class="canvas-header">
  <div class="breadcrumb">
    <span class="vault-name">{vaultStore.currentVault?.name || 'Vault'}</span>
    <ChevronRight size={14} class="separator" />
    {#if isEditing}
      <div class="edit-container">
        <input
          type="text"
          bind:value={editName}
          onkeydown={handleKeydown}
          class="edit-input"
          autofocus
        />
        <button class="edit-btn save" onclick={saveEdit} disabled={isSaving}>
          {#if isSaving}
            <Loader2 size={14} class="animate-spin" />
          {:else}
            <Check size={14} />
          {/if}
        </button>
        <button class="edit-btn cancel" onclick={cancelEdit}>
          <X size={14} />
        </button>
      </div>
    {:else}
      <button class="canvas-name-btn" onclick={startEditing}>
        <span class="canvas-name">{vaultStore.currentCanvas?.name || 'Untitled'}</span>
        <Pencil size={12} class="edit-icon" />
      </button>
    {/if}
  </div>
  
  {#if workspace.isModified}
    <span class="modified-indicator" title="Unsaved changes">●</span>
  {/if}
</div>

<style>
  .canvas-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgba(10, 10, 15, 0.9);
    border-bottom: 1px solid #2a2a3a;
    z-index: 100;
    backdrop-filter: blur(8px);
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .vault-name {
    color: #666;
  }

  .breadcrumb :global(.separator) {
    color: #444;
  }

  .canvas-name-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #fafafa;
    cursor: pointer;
    transition: all 0.2s;
  }

  .canvas-name-btn:hover {
    background: #1a1a2e;
    border-color: #2a2a3a;
  }

  .canvas-name-btn :global(.edit-icon) {
    opacity: 0;
    color: #666;
    transition: opacity 0.2s;
  }

  .canvas-name-btn:hover :global(.edit-icon) {
    opacity: 1;
  }

  .canvas-name {
    font-weight: 500;
  }

  .edit-container {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .edit-input {
    padding: 0.25rem 0.5rem;
    background: #111118;
    border: 1px solid #3b82f6;
    border-radius: 4px;
    color: #fafafa;
    font-size: 0.875rem;
    font-weight: 500;
    width: 200px;
  }

  .edit-input:focus {
    outline: none;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .edit-btn.save {
    color: #22c55e;
  }

  .edit-btn.save:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .edit-btn.cancel {
    color: #666;
  }

  .edit-btn.cancel:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .modified-indicator {
    color: #f59e0b;
    font-size: 0.75rem;
  }

  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
