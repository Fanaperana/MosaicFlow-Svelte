<script lang="ts">
  import { vaultStore } from '$lib/stores/vault.svelte';
  import type { CanvasInfo } from '$lib/services/vaultService';
  import { 
    Plus, 
    ArrowLeft, 
    Trash2, 
    ArrowRight, 
    FileText, 
    Loader2,
    Pencil,
    Check,
    X
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';

  let isCreating = $state(false);
  let newCanvasName = $state('');
  let showCreateInput = $state(false);
  let editingCanvasId = $state<string | null>(null);
  let editingName = $state('');

  async function handleCreateCanvas() {
    if (!newCanvasName.trim()) return;
    
    isCreating = true;
    try {
      await vaultStore.createCanvas(newCanvasName.trim());
      newCanvasName = '';
      showCreateInput = false;
    } catch (error) {
      console.error('Failed to create canvas:', error);
    } finally {
      isCreating = false;
    }
  }

  function handleOpenCanvas(canvas: CanvasInfo) {
    vaultStore.openCanvas(canvas);
  }

  async function handleDeleteCanvas(canvas: CanvasInfo, e: Event) {
    e.stopPropagation();
    if (confirm(`Delete "${canvas.name}"? This cannot be undone.`)) {
      await vaultStore.deleteCanvasById(canvas.path);
    }
  }

  function startEditing(canvas: CanvasInfo, e: Event) {
    e.stopPropagation();
    editingCanvasId = canvas.id;
    editingName = canvas.name;
  }

  async function saveEdit(canvas: CanvasInfo) {
    if (editingName.trim() && editingName !== canvas.name) {
      // For now, just update locally - the renameCanvas will handle folder rename
      vaultStore.openCanvas(canvas);
      // Then rename
      await vaultStore.renameCurrentCanvas(editingName.trim());
    }
    editingCanvasId = null;
    editingName = '';
  }

  function cancelEdit() {
    editingCanvasId = null;
    editingName = '';
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
</script>

<div class="canvas-list-page">
  <div class="canvas-list-content">
    <header class="list-header">
      <button class="back-btn" onclick={() => vaultStore.closeVault()}>
        <ArrowLeft size={20} />
      </button>
      <div class="vault-info">
        <h1>{vaultStore.currentVault?.name || 'Vault'}</h1>
        <p class="canvas-count">{vaultStore.canvases.length} canvas{vaultStore.canvases.length !== 1 ? 'es' : ''}</p>
      </div>
      <Button onclick={() => showCreateInput = true} size="sm">
        <Plus size={16} class="mr-1" />
        New Canvas
      </Button>
    </header>

    {#if showCreateInput}
      <div class="create-input-row">
        <input
          type="text"
          bind:value={newCanvasName}
          placeholder="Canvas name..."
          class="canvas-name-input"
          onkeydown={(e) => e.key === 'Enter' && handleCreateCanvas()}
          autofocus
        />
        <Button onclick={handleCreateCanvas} disabled={isCreating || !newCanvasName.trim()} size="sm">
          {#if isCreating}
            <Loader2 size={16} class="animate-spin" />
          {:else}
            Create
          {/if}
        </Button>
        <Button onclick={() => { showCreateInput = false; newCanvasName = ''; }} variant="ghost" size="sm">
          Cancel
        </Button>
      </div>
    {/if}

    <div class="canvas-grid">
      {#each vaultStore.canvases as canvas}
        <div class="canvas-card" onclick={() => handleOpenCanvas(canvas)}>
          <div class="canvas-icon">
            <FileText size={32} strokeWidth={1.5} />
          </div>
          <div class="canvas-info">
            {#if editingCanvasId === canvas.id}
              <div class="edit-name-row" onclick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  bind:value={editingName}
                  class="edit-name-input"
                  onkeydown={(e) => {
                    if (e.key === 'Enter') saveEdit(canvas);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autofocus
                />
                <button class="edit-action-btn save" onclick={() => saveEdit(canvas)}>
                  <Check size={14} />
                </button>
                <button class="edit-action-btn cancel" onclick={cancelEdit}>
                  <X size={14} />
                </button>
              </div>
            {:else}
              <h3 class="canvas-name">{canvas.name}</h3>
            {/if}
            <p class="canvas-date">Modified {formatDate(canvas.updated_at)}</p>
          </div>
          <div class="canvas-actions">
            <button 
              class="action-btn edit"
              onclick={(e) => startEditing(canvas, e)}
              title="Rename"
            >
              <Pencil size={14} />
            </button>
            <button 
              class="action-btn delete"
              onclick={(e) => handleDeleteCanvas(canvas, e)}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
            <ArrowRight size={18} class="arrow" />
          </div>
        </div>
      {/each}
    </div>

    {#if vaultStore.canvases.length === 0}
      <div class="empty-state">
        <FileText size={48} strokeWidth={1} />
        <h3>No canvases yet</h3>
        <p>Create your first canvas to start investigating</p>
        <Button onclick={() => showCreateInput = true}>
          <Plus size={16} class="mr-1" />
          Create Canvas
        </Button>
      </div>
    {/if}
  </div>
</div>

<style>
  .canvas-list-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
    padding: 2rem;
  }

  .canvas-list-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .list-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #2a2a3a;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    color: #fafafa;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    border-color: #3b82f6;
    background: #1a1a2e;
  }

  .vault-info {
    flex: 1;
  }

  .vault-info h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .canvas-count {
    font-size: 0.875rem;
    color: #666;
    margin: 0.25rem 0 0 0;
  }

  .create-input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
  }

  .canvas-name-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: #0a0a0f;
    border: 1px solid #2a2a3a;
    border-radius: 6px;
    color: #fafafa;
    font-size: 0.875rem;
  }

  .canvas-name-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .canvas-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .canvas-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .canvas-card:hover {
    border-color: #3b82f6;
    background: #1a1a2e;
  }

  .canvas-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 10px;
    color: white;
  }

  .canvas-info {
    flex: 1;
    min-width: 0;
  }

  .canvas-name {
    font-size: 1rem;
    font-weight: 500;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .canvas-date {
    font-size: 0.75rem;
    color: #666;
    margin: 0.25rem 0 0 0;
  }

  .edit-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-name-input {
    flex: 1;
    padding: 0.25rem 0.5rem;
    background: #0a0a0f;
    border: 1px solid #3b82f6;
    border-radius: 4px;
    color: #fafafa;
    font-size: 0.875rem;
  }

  .edit-action-btn {
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

  .edit-action-btn.save {
    color: #22c55e;
  }

  .edit-action-btn.save:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .edit-action-btn.cancel {
    color: #666;
  }

  .edit-action-btn.cancel:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .canvas-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    border-radius: 6px;
    opacity: 0;
    transition: all 0.2s;
  }

  .canvas-card:hover .action-btn {
    opacity: 1;
  }

  .action-btn.edit:hover {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  .action-btn.delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .canvas-actions :global(.arrow) {
    color: #666;
    margin-left: 0.5rem;
  }

  .canvas-card:hover :global(.arrow) {
    color: #3b82f6;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 2rem;
    text-align: center;
    color: #666;
  }

  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 500;
    color: #888;
    margin: 0;
  }

  .empty-state p {
    font-size: 0.875rem;
    margin: 0;
  }

  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
