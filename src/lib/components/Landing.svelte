<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { appConfig } from '$lib/stores/appConfig.svelte';
  import { FolderOpen, Plus, Clock, Trash2, ArrowRight, Layers } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';

  async function selectFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Workspace Container Folder',
      });
      
      if (selected && typeof selected === 'string') {
        appConfig.setContainerPath(selected);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }

  interface Props {
    onCreateWorkspace: () => void;
    onOpenWorkspace: (path: string) => void;
  }

  let { onCreateWorkspace, onOpenWorkspace }: Props = $props();

  function removeRecent(path: string, e: Event) {
    e.stopPropagation();
    appConfig.recentWorkspaces = appConfig.recentWorkspaces.filter(w => w.path !== path);
    appConfig.saveConfig();
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

<div class="landing">
  <div class="landing-content">
    <!-- Logo and Title -->
    <div class="header">
      <div class="logo">
        <Layers size={48} strokeWidth={1.5} />
      </div>
      <h1>MosaicFlow</h1>
      <p class="tagline">Visual canvas for OSINT investigations</p>
    </div>

    {#if !appConfig.containerPath}
      <!-- First time setup - select container folder -->
      <div class="setup-container">
        <div class="setup-card">
          <FolderOpen size={32} strokeWidth={1.5} class="icon" />
          <h2>Set up your workspace</h2>
          <p>Choose a folder where all your MosaicFlow workspaces will be stored.</p>
          <Button onclick={selectFolder} size="lg">
            <FolderOpen size={18} class="mr-2" />
            Select Folder
          </Button>
        </div>
      </div>
    {:else}
      <!-- Main landing with workspace options -->
      <div class="workspace-options">
        <div class="container-path">
          <span class="label">Workspace folder:</span>
          <span class="path">{appConfig.containerPath}</span>
          <button class="change-btn" onclick={selectFolder}>Change</button>
        </div>

        <div class="actions">
          <button class="action-card" onclick={onCreateWorkspace}>
            <Plus size={24} strokeWidth={1.5} />
            <span>New Workspace</span>
          </button>
          <button class="action-card" onclick={selectFolder}>
            <FolderOpen size={24} strokeWidth={1.5} />
            <span>Open Workspace</span>
          </button>
        </div>

        {#if appConfig.recentWorkspaces.length > 0}
          <div class="recent-section">
            <h3>
              <Clock size={16} strokeWidth={1.5} />
              Recent Workspaces
            </h3>
            <div class="recent-list">
              {#each appConfig.recentWorkspaces as workspace}
                <div class="recent-item">
                  <button 
                    class="recent-info-btn"
                    onclick={() => onOpenWorkspace(workspace.path)}
                  >
                    <div class="recent-info">
                      <span class="recent-name">{workspace.name}</span>
                      <span class="recent-path">{workspace.path}</span>
                    </div>
                    <div class="recent-meta">
                      <span class="recent-date">{formatDate(workspace.lastOpened)}</span>
                      <ArrowRight size={16} class="arrow" />
                    </div>
                  </button>
                  <button 
                    class="delete-btn"
                    onclick={(e) => removeRecent(workspace.path, e)}
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
  .landing {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
    padding: 2rem;
  }

  .landing-content {
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

  .setup-container {
    display: flex;
    justify-content: center;
  }

  .setup-card {
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 16px;
    padding: 3rem;
    text-align: center;
    max-width: 400px;
  }

  .setup-card :global(.icon) {
    color: #3b82f6;
    margin-bottom: 1rem;
  }

  .setup-card h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .setup-card p {
    color: #888;
    font-size: 0.875rem;
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
  }

  .container-path {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  .container-path .label {
    color: #888;
    white-space: nowrap;
  }

  .container-path .path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #fafafa;
  }

  .container-path .change-btn {
    background: transparent;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .container-path .change-btn:hover {
    text-decoration: underline;
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
    gap: 0.75rem;
    padding: 2rem;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    color: #fafafa;
  }

  .action-card:hover {
    border-color: #3b82f6;
    background: #1a1a2e;
  }

  .action-card span {
    font-size: 0.875rem;
    font-weight: 500;
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
