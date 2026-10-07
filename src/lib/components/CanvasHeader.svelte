<script lang="ts">
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { flushPendingSaves as flushNodeSaves } from '$lib/services/nodeFileService';
  import { flushPendingSaves as flushEdgeSaves } from '$lib/services/edgeFileService';
  import { Pencil, Check, X, ChevronRight, Loader2, List, ArrowLeft, ArrowRight, PanelLeft } from 'lucide-svelte';
  import VaultSwitcher from './VaultSwitcher.svelte';
  import { pageNav } from '$lib/stores/pages.svelte';

  interface Props {
    onToggleNodeList?: () => void;
  }

  let { onToggleNodeList }: Props = $props();

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
      // The canvas folder is renamed on disk, so pending writes must land first.
      await Promise.all([flushNodeSaves(), flushEdgeSaves()]);
      const success = await vaultStore.renameCurrentCanvas(editName.trim());
      if (success) {
        workspace.name = editName.trim();
        if (vaultStore.currentCanvas) workspace.initFileServices(vaultStore.currentCanvas.path);
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
  <div class="left-actions">
    {#if !pageNav.sidebarOpen}
      <button class="icon-btn" onclick={() => pageNav.toggleSidebar(true)} title="Show pages (Ctrl+\)" aria-label="Show pages">
        <PanelLeft size={15} />
      </button>
    {/if}
    <button class="icon-btn" onclick={() => pageNav.goBack()} disabled={!pageNav.canGoBack} title="Back (Alt+←)" aria-label="Back">
      <ArrowLeft size={15} />
    </button>
    <button class="icon-btn" onclick={() => pageNav.goForward()} disabled={!pageNav.canGoForward} title="Forward (Alt+→)" aria-label="Forward">
      <ArrowRight size={15} />
    </button>
  </div>

  <div class="breadcrumb">
    {#if !pageNav.sidebarOpen}
      <VaultSwitcher />
      <ChevronRight size={14} class="separator" />
    {/if}
    {#if isEditing}
      <div class="edit-container">
        <!-- svelte-ignore a11y_autofocus -->
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

  <div class="right-actions">
    <button class="icon-btn" onclick={onToggleNodeList} title="Toggle Node List">
      <List size={16} />
    </button>
  </div>
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
    background: color-mix(in srgb, var(--mf-surface) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--mf-border);
    z-index: 100;
    padding: 0 12px;
  }

  .right-actions {
    position: absolute;
    right: 10px;
    display: flex;
    align-items: center;
  }

  .left-actions {
    position: absolute;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .icon-btn:disabled,
  .icon-btn:disabled:hover {
    opacity: 0.35;
    background: transparent;
    color: var(--mf-text-3);
    cursor: default;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--mf-text-3);
    width: 26px;
    height: 26px;
    border-radius: var(--mf-radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    pointer-events: auto;
  }

  .breadcrumb :global(.separator) {
    color: var(--mf-text-3);
    opacity: 0.6;
  }

  .canvas-name-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 6px;
    background: transparent;
    border: none;
    border-radius: var(--mf-radius);
    color: var(--mf-text);
    cursor: pointer;
    transition: background 0.12s;
  }

  .canvas-name-btn:hover {
    background: var(--mf-hover);
  }

  .canvas-name-btn :global(.edit-icon) {
    opacity: 0;
    color: var(--mf-text-3);
    transition: opacity 0.12s;
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
    gap: 2px;
  }

  .edit-input {
    height: 24px;
    padding: 0 6px;
    background: var(--mf-surface-2);
    border: 1px solid var(--mf-accent);
    border-radius: var(--mf-radius);
    color: var(--mf-text);
    font-size: 13px;
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

  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
