// Workspace File Operations
// Handles saving and loading workspace files using Tauri file system

import { workspace } from '$lib/stores/workspace.svelte';
import type { WorkspaceData, UIState } from '$lib/types';
import { toPng } from 'html-to-image';

// Debounce timer
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Debounced auto-save function
export function scheduleAutoSave() {
  if (!workspace.settings.autoSave || !workspace.workspacePath) return;
  
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  
  saveTimer = setTimeout(() => {
    saveWorkspace();
  }, workspace.settings.autoSaveInterval);
}

// Save workspace to file
export async function saveWorkspace(): Promise<boolean> {
  if (!workspace.workspacePath) {
    console.log('No workspace path set');
    return false;
  }

  try {
    const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
    
    const basePath = workspace.workspacePath;
    
    // Ensure directories exist
    const dirs = ['notes', 'images', 'properties', 'exports'];
    for (const dir of dirs) {
      const dirPath = `${basePath}/${dir}`;
      if (!(await exists(dirPath))) {
        await mkdir(dirPath, { recursive: true });
      }
    }
    
    // Save workspace.json
    const workspaceData = workspace.toWorkspaceData();
    await writeTextFile(
      `${basePath}/workspace.json`,
      JSON.stringify(workspaceData, null, 2)
    );
    
    // Save state.json
    const uiState = workspace.toUIState();
    await writeTextFile(
      `${basePath}/state.json`,
      JSON.stringify(uiState, null, 2)
    );
    
    workspace.markSaved();
    console.log('Workspace saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving workspace:', error);
    return false;
  }
}

// Load workspace from file
export async function loadWorkspace(path: string): Promise<boolean> {
  try {
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    
    // Load workspace.json
    const workspacePath = `${path}/workspace.json`;
    if (!(await exists(workspacePath))) {
      console.error('workspace.json not found');
      return false;
    }
    
    const workspaceContent = await readTextFile(workspacePath);
    const workspaceData: WorkspaceData = JSON.parse(workspaceContent);
    
    workspace.loadFromData(workspaceData);
    workspace.workspacePath = path;
    
    // Load state.json if exists
    const statePath = `${path}/state.json`;
    if (await exists(statePath)) {
      const stateContent = await readTextFile(statePath);
      const uiState: UIState = JSON.parse(stateContent);
      workspace.loadUIState(uiState);
    }
    
    console.log('Workspace loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading workspace:', error);
    return false;
  }
}

// Create new workspace
export async function createWorkspace(path: string, name: string): Promise<boolean> {
  try {
    const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
    
    // Create workspace directory
    if (!(await exists(path))) {
      await mkdir(path, { recursive: true });
    }
    
    // Initialize workspace
    workspace.clear();
    workspace.name = name;
    workspace.workspacePath = path;
    
    // Save initial files
    await saveWorkspace();
    
    return true;
  } catch (error) {
    console.error('Error creating workspace:', error);
    return false;
  }
}

// Open workspace dialog
export async function openWorkspaceDialog(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Open Workspace',
    });
    
    if (selected && typeof selected === 'string') {
      const success = await loadWorkspace(selected);
      return success ? selected : null;
    }
    
    return null;
  } catch (error) {
    console.error('Error opening workspace dialog:', error);
    return null;
  }
}

// Save as dialog
export async function saveWorkspaceAsDialog(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Save Workspace As',
    });
    
    if (selected && typeof selected === 'string') {
      workspace.workspacePath = selected;
      const success = await saveWorkspace();
      return success ? selected : null;
    }
    
    return null;
  } catch (error) {
    console.error('Error in save as dialog:', error);
    return null;
  }
}

// LocalStorage fallback functions
function saveToLocalStorage() {
  try {
    const workspaceData = workspace.toWorkspaceData();
    const uiState = workspace.toUIState();
    
    localStorage.setItem('mosaicflow_workspace', JSON.stringify(workspaceData));
    localStorage.setItem('mosaicflow_state', JSON.stringify(uiState));
    
    workspace.markSaved();
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

function loadFromLocalStorage(): boolean {
  try {
    const workspaceStr = localStorage.getItem('mosaicflow_workspace');
    const stateStr = localStorage.getItem('mosaicflow_state');
    
    if (workspaceStr) {
      const workspaceData: WorkspaceData = JSON.parse(workspaceStr);
      workspace.loadFromData(workspaceData);
      
      if (stateStr) {
        const uiState: UIState = JSON.parse(stateStr);
        workspace.loadUIState(uiState);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return false;
  }
}

// Export workspace as ZIP
export async function exportAsZip(): Promise<boolean> {
  // For now, just trigger a download of the JSON data
  try {
    const workspaceData = workspace.toWorkspaceData();
    const dataStr = JSON.stringify(workspaceData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_workspace.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error exporting workspace:', error);
    return false;
  }
}

// Initialize auto-save watcher
export function initAutoSave() {
  // Watch for changes and trigger auto-save
  $effect(() => {
    if (workspace.isModified) {
      scheduleAutoSave();
    }
  });
}

// Export canvas as PNG image
export async function exportAsPng(): Promise<boolean> {
  console.log('Starting PNG export...');
  
  try {
    // Get the SvelteFlow viewport element (the one that contains the nodes)
    const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
    if (!viewportEl) {
      console.error('SvelteFlow viewport not found');
      return false;
    }
    
    console.log('Viewport element found, generating PNG...');

    // Create a high-resolution PNG using the filter option to exclude controls
    // Using pixelRatio 4 for very high resolution (4K equivalent scaling)
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: '#0a0a0a', // Match the canvas background
      pixelRatio: 4, // 4x resolution for high-quality export - allows zooming in without blur
      skipFonts: true, // Skip web fonts to avoid CORS errors with Google Fonts
      includeQueryParams: true,
      cacheBust: true,
      filter: (node) => {
        // Exclude controls, minimap, attribution, and panels
        if (node instanceof Element) {
          const classList = node.classList;
          if (classList?.contains('svelte-flow__controls') ||
              classList?.contains('svelte-flow__minimap') ||
              classList?.contains('svelte-flow__attribution') ||
              classList?.contains('svelte-flow__panel') ||
              classList?.contains('cm-widgetBuffer')) {
            return false;
          }
        }
        // Filter out broken or incomplete images
        if (node instanceof HTMLImageElement) {
          if (!node.complete || node.naturalWidth === 0 || node.src === '') {
            return false;
          }
        }
        return true;
      },
    });
    
    console.log('PNG generated, dataUrl length:', dataUrl?.length);

    console.log('Opening save dialog...');
    // Use Tauri file dialog to choose save location
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    
    const defaultName = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_canvas.png`;
    console.log('Default filename:', defaultName);
    
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{
        name: 'PNG Image',
        extensions: ['png']
      }]
    });
    
    console.log('Save dialog returned:', filePath);

    if (filePath) {
      // Convert data URL to binary
      const base64Data = dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log('Writing', bytes.length, 'bytes to:', filePath);
      await writeFile(filePath, bytes);
      console.log('Canvas exported as PNG successfully to:', filePath);
      return true;
    } else {
      console.log('User cancelled the save dialog');
      // User cancelled the dialog
      return false;
    }
  } catch (error) {
    console.error('Error exporting canvas as PNG:', error);
    return false;
  }
}
