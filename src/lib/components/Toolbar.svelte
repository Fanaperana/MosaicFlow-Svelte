<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import { 
    saveWorkspace, 
    openWorkspaceDialog, 
    saveWorkspaceAsDialog,
    exportAsZip,
    createWorkspace 
  } from '$lib/services/fileOperations';
  import { MousePointer2, Hand, Group } from 'lucide-svelte';

  let showMenu = $state(false);
  let showExportMenu = $state(false);

  async function handleNew() {
    if (workspace.isModified) {
      const confirm = window.confirm('You have unsaved changes. Create new workspace anyway?');
      if (!confirm) return;
    }
    workspace.clear();
    showMenu = false;
  }

  async function handleOpen() {
    await openWorkspaceDialog();
    showMenu = false;
  }

  async function handleSave() {
    await saveWorkspace();
    showMenu = false;
  }

  async function handleSaveAs() {
    await saveWorkspaceAsDialog();
    showMenu = false;
  }

  async function handleExportZip() {
    await exportAsZip();
    showExportMenu = false;
  }

  function handleExportPng() {
    // Export canvas as PNG - would require html-to-image or similar
    alert('PNG export coming soon!');
    showExportMenu = false;
  }

  function toggleAutoSave() {
    workspace.settings.autoSave = !workspace.settings.autoSave;
  }

  function toggleMinimap() {
    workspace.settings.showMinimap = !workspace.settings.showMinimap;
  }

  function toggleSnapToGrid() {
    workspace.settings.snapToGrid = !workspace.settings.snapToGrid;
  }

  // Check if we can group selected nodes
  const canGroup = $derived(workspace.selectedNodeIds.length >= 2);

  function handleGroupNodes() {
    workspace.groupSelectedNodes();
  }
</script>

<header class="toolbar">
  <div class="toolbar-left">
    <div class="app-logo">
      <span class="logo-icon">🎨</span>
      <span class="logo-text">MosaicFlow</span>
    </div>

    <div class="toolbar-menu">
      <div class="menu-item">
        <button 
          class="menu-trigger"
          onclick={() => { showMenu = !showMenu; showExportMenu = false; }}
        >
          File
        </button>
        {#if showMenu}
          <div class="menu-dropdown">
            <button onclick={handleNew}>
              <span>📄</span> New Workspace
            </button>
            <button onclick={handleOpen}>
              <span>📂</span> Open Workspace
            </button>
            <div class="menu-separator"></div>
            <button onclick={handleSave}>
              <span>💾</span> Save
            </button>
            <button onclick={handleSaveAs}>
              <span>📁</span> Save As...
            </button>
            <div class="menu-separator"></div>
            <button onclick={() => { showExportMenu = !showExportMenu; }}>
              <span>📤</span> Export ▸
            </button>
          </div>
        {/if}
      </div>

      <div class="menu-item">
        <button 
          class="menu-trigger"
          onclick={() => { showExportMenu = !showExportMenu; showMenu = false; }}
        >
          Export
        </button>
        {#if showExportMenu}
          <div class="menu-dropdown">
            <button onclick={handleExportZip}>
              <span>📦</span> Export as JSON
            </button>
            <button onclick={handleExportPng}>
              <span>🖼️</span> Export as PNG
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="toolbar-center">
    <input 
      type="text" 
      class="workspace-name"
      bind:value={workspace.name}
      placeholder="Untitled Workspace"
    />
    {#if workspace.isModified}
      <span class="unsaved-indicator" title="Unsaved changes">●</span>
    {/if}
  </div>

  <div class="toolbar-right">
    <div class="toolbar-toggles">
      <button 
        class="toggle-btn"
        class:active={workspace.settings.autoSave}
        onclick={toggleAutoSave}
        title="Auto-save"
      >
        💾
      </button>
      <button 
        class="toggle-btn"
        class:active={workspace.settings.showMinimap}
        onclick={toggleMinimap}
        title="Show minimap"
      >
        🗺️
      </button>
      <button 
        class="toggle-btn"
        class:active={workspace.settings.snapToGrid}
        onclick={toggleSnapToGrid}
        title="Snap to grid"
      >
        ⊞
      </button>
    </div>

    <!-- Canvas Mode Toggle -->
    <div class="toolbar-mode-toggle">
      <button 
        class="mode-btn"
        class:active={workspace.canvasMode === 'select'}
        onclick={() => workspace.setCanvasMode('select')}
        title="Select Mode (V)"
      >
        <MousePointer2 size={16} />
      </button>
      <button 
        class="mode-btn"
        class:active={workspace.canvasMode === 'drag'}
        onclick={() => workspace.setCanvasMode('drag')}
        title="Drag/Pan Mode (H)"
      >
        <Hand size={16} />
      </button>
    </div>

    <!-- Group Button -->
    {#if canGroup}
      <button 
        class="group-btn"
        onclick={handleGroupNodes}
        title="Group selected nodes (Ctrl+G)"
      >
        <Group size={14} />
        <span>Group</span>
      </button>
    {/if}

    <button 
      class="properties-btn"
      onclick={() => workspace.togglePropertiesPanel()}
      title="Toggle properties panel"
    >
      ⚙️ Properties
    </button>
  </div>
</header>

<!-- Click outside to close menus -->
{#if showMenu || showExportMenu}
  <div 
    class="menu-overlay"
    onclick={() => { showMenu = false; showExportMenu = false; }}
    role="button"
    tabindex="-1"
    onkeydown={(e) => { if (e.key === 'Escape') { showMenu = false; showExportMenu = false; }}}
  ></div>
{/if}

<style>
  .toolbar {
    position: fixed;
    top: 0;
    left: 260px;
    right: 0;
    height: 48px;
    background: #1a1d21;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    z-index: 200;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .app-logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-icon {
    font-size: 20px;
  }

  .logo-text {
    font-weight: 700;
    font-size: 16px;
    color: #e0e0e0;
  }

  .toolbar-menu {
    display: flex;
    gap: 4px;
  }

  .menu-item {
    position: relative;
  }

  .menu-trigger {
    padding: 6px 12px;
    background: transparent;
    border: none;
    color: #888;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
  }

  .menu-trigger:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .menu-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: #1a1d21;
    border: 1px solid #333;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    min-width: 180px;
    padding: 4px;
    z-index: 300;
  }

  .menu-dropdown button {
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: #e0e0e0;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
  }

  .menu-dropdown button:hover {
    background: rgba(59, 130, 246, 0.2);
  }

  .menu-separator {
    height: 1px;
    background: #333;
    margin: 4px 0;
  }

  .menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 199;
  }

  .toolbar-center {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .workspace-name {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    min-width: 200px;
    outline: none;
  }

  .workspace-name:hover {
    border-color: #444;
  }

  .workspace-name:focus {
    border-color: #3b82f6;
    background: rgba(255, 255, 255, 0.05);
  }

  .unsaved-indicator {
    color: #f59e0b;
    font-size: 12px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toolbar-toggles {
    display: flex;
    gap: 4px;
  }

  .toggle-btn {
    padding: 6px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    opacity: 0.5;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    opacity: 0.8;
  }

  .toggle-btn.active {
    opacity: 1;
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .toolbar-mode-toggle {
    display: flex;
    gap: 2px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    padding: 2px;
    border: 1px solid #333;
  }

  .mode-btn {
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #888;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mode-btn:hover {
    color: #e0e0e0;
    background: rgba(255, 255, 255, 0.1);
  }

  .mode-btn.active {
    color: #e0e0e0;
    background: rgba(59, 130, 246, 0.3);
  }

  .group-btn {
    padding: 6px 12px;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s ease;
  }

  .group-btn:hover {
    background: rgba(139, 92, 246, 0.3);
    border-color: rgba(139, 92, 246, 0.6);
  }

  .properties-btn {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .properties-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #555;
  }
</style>
