// Workspace File Operations
// Handles saving and loading workspace files using Tauri file system

import { workspace } from '$lib/stores/workspace.svelte';
import type { WorkspaceData, UIState } from '$lib/types';
import { toPng } from 'html-to-image';

// Check if we're in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

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
  if (!isTauri || !workspace.workspacePath) {
    console.log('Save to localStorage as fallback');
    saveToLocalStorage();
    return true;
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
  if (!isTauri) {
    console.log('Load from localStorage as fallback');
    return loadFromLocalStorage();
  }

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
  if (!isTauri) {
    workspace.clear();
    workspace.name = name;
    saveToLocalStorage();
    return true;
  }

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
  if (!isTauri) {
    loadFromLocalStorage();
    return 'localStorage';
  }

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
  if (!isTauri) {
    saveToLocalStorage();
    return 'localStorage';
  }

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
  try {
    // Find the SvelteFlow viewport element
    const flowElement = document.querySelector('.svelte-flow') as HTMLElement;
    
    if (!flowElement) {
      console.error('Canvas element not found');
      return false;
    }

    // Get the viewport for proper sizing
    const viewport = flowElement.querySelector('.svelte-flow__viewport') as HTMLElement;
    if (!viewport) {
      console.error('Viewport element not found');
      return false;
    }

    // Calculate the bounds of all nodes to determine the export area
    const nodes = flowElement.querySelectorAll('.svelte-flow__node');
    if (nodes.length === 0) {
      console.error('No nodes to export');
      return false;
    }

    // Generate PNG with high quality settings
    const dataUrl = await toPng(flowElement, {
      backgroundColor: '#1a1a2e', // Match the canvas background
      quality: 1.0,
      pixelRatio: 2, // Higher resolution for better quality
      filter: (node) => {
        // Filter out minimap, controls, and other UI elements
        const className = node.className;
        if (typeof className === 'string') {
          if (className.includes('svelte-flow__minimap')) return false;
          if (className.includes('svelte-flow__controls')) return false;
          if (className.includes('svelte-flow__panel')) return false;
        }
        return true;
      },
    });

    // Create download link
    const link = document.createElement('a');
    link.download = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_canvas.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Canvas exported as PNG successfully');
    return true;
  } catch (error) {
    console.error('Error exporting canvas as PNG:', error);
    return false;
  }
}
