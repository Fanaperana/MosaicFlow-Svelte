// Workspace File Operations
// Handles loading workspace files using Tauri file system
// Real-time saving is handled by nodeFileService and edgeFileService

import { workspace } from '$lib/stores/workspace.svelte';
import type { WorkspaceData, UIState, NodeType } from '$lib/types';
import { toPng, toSvg } from 'html-to-image';
import { loadAllNodes } from './nodeFileService';
import { loadAllEdges } from './edgeFileService';

// Workspace manifest format (v2 - minimal)
interface WorkspaceManifest {
  metadata: {
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    viewport: { x: number; y: number; zoom: number };
    settings: Record<string, unknown>;
  };
  nodes: Record<string, { id: string; type: string }>;
  edges: Record<string, { id: string }>;
}

// Load workspace from file (v2 format with individual node/edge files)
export async function loadWorkspace(path: string): Promise<boolean> {
  try {
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    
    // Load workspace.json (manifest)
    const workspacePath = `${path}/workspace.json`;
    if (!(await exists(workspacePath))) {
      console.error('workspace.json not found');
      return false;
    }
    
    const workspaceContent = await readTextFile(workspacePath);
    const manifest: WorkspaceManifest = JSON.parse(workspaceContent);
    
    // Check version to determine loading strategy
    // Handle both v1 (no metadata) and v2 (with metadata) formats
    const version = manifest.metadata?.version || '1.0.0';
    const isV2 = version.startsWith('2.');
    
    // Initialize file services with workspace path
    workspace.initFileServices(path);
    
    if (isV2) {
      // V2 format: Load nodes and edges from individual files
      console.log('Loading workspace v2 format...');
      
      // Load metadata
      workspace.name = manifest.metadata.name;
      workspace.description = manifest.metadata.description;
      workspace.createdAt = manifest.metadata.createdAt;
      workspace.updatedAt = manifest.metadata.updatedAt;
      workspace.viewport = manifest.metadata.viewport;
      if (manifest.metadata.settings) {
        const settings = manifest.metadata.settings as Record<string, unknown>;
        workspace.settings = { 
          ...workspace.settings, 
          ...(settings as unknown as typeof workspace.settings)
        };
      }
      
      // Load nodes from individual files
      const nodesManifest: Record<string, { type: NodeType }> = {};
      for (const [nodeId, nodeInfo] of Object.entries(manifest.nodes)) {
        nodesManifest[nodeId] = { type: nodeInfo.type as NodeType };
      }
      const nodes = await loadAllNodes(nodesManifest);
      workspace.nodes = nodes;
      
      // Load edges from individual files
      const edges = await loadAllEdges();
      workspace.edges = edges;
    } else {
      // V1 format: Load from full workspace.json (backward compatibility)
      console.log('Loading workspace v1 format (legacy)...');
      const workspaceData = manifest as unknown as WorkspaceData;
      workspace.loadFromData(workspaceData);
      
      // Migrate to v2 format by saving all nodes and edges to files
      console.log('Migrating to v2 format...');
      for (const node of workspace.nodes) {
        const { saveNodeImmediate } = await import('./nodeFileService');
        await saveNodeImmediate(node);
      }
      for (const edge of workspace.edges) {
        const { saveEdgeImmediate } = await import('./edgeFileService');
        await saveEdgeImmediate(edge);
      }
      // Save new manifest
      await workspace.saveWorkspaceManifest();
    }
    
    // Load state.json if exists (for viewport and selection state)
    const statePath = `${path}/.mosaic/state.json`;
    try {
      const stateExists = await exists(statePath);
      if (stateExists) {
        const stateContent = await readTextFile(statePath);
        const uiState: UIState = JSON.parse(stateContent);
        workspace.loadUIState(uiState);
      }
    } catch {
      // State file is optional, silently ignore permission or read errors
    }
    
    console.log('Workspace loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading workspace:', error);
    return false;
  }
}

// Create new workspace with v2 folder structure
export async function createWorkspace(path: string, name: string): Promise<boolean> {
  try {
    const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
    
    // Create workspace directory
    if (!(await exists(path))) {
      await mkdir(path, { recursive: true });
    }
    
    // Create required subdirectories for v2 format
    const dirs = ['nodes', 'edges', 'images', 'attachments', '.mosaic'];
    for (const dir of dirs) {
      const dirPath = `${path}/${dir}`;
      if (!(await exists(dirPath))) {
        await mkdir(dirPath, { recursive: true });
      }
    }
    
    // Initialize workspace
    workspace.clear();
    workspace.name = name;
    workspace.initFileServices(path);
    
    // Save initial manifest
    await workspace.saveWorkspaceManifest();
    
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

// Export workspace as ZIP/JSON
export async function exportAsZip(): Promise<boolean> {
  // Export full workspace data including all node content
  try {
    // Build full export with all node and edge data
    const exportData = {
      metadata: {
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        version: '2.0.0',
        viewport: workspace.viewport,
        settings: workspace.settings,
        exportedAt: new Date().toISOString(),
      },
      nodes: Object.fromEntries(
        workspace.nodes.map(node => [node.id, node])
      ),
      edges: Object.fromEntries(
        workspace.edges.map(edge => [edge.id, edge])
      ),
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
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

// Export canvas as PNG image
// Helper function to generate SVG data URL from viewport
async function generateSvgDataUrl(): Promise<{ dataUrl: string; svgContent: string; width: number; height: number } | null> {
  // Store original viewport to restore later
  const originalViewport = { ...workspace.viewport };
  
  // Mark as exporting to disable LOD simplification
  const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
  if (canvasEl) {
    canvasEl.dataset.exporting = 'true';
  }
  
  // Trigger fit view to show all nodes
  window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.1 } }));
  
  // Wait for fitView animation to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Get the SvelteFlow viewport element
  const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
  if (!viewportEl) {
    console.error('SvelteFlow viewport not found');
    if (canvasEl) delete canvasEl.dataset.exporting;
    workspace.setViewport(originalViewport);
    return null;
  }
  
  // Get viewport dimensions for the PNG canvas
  const viewportRect = viewportEl.getBoundingClientRect();
  
  // Create SVG - this captures all visible nodes perfectly
  const svgDataUrl = await toSvg(viewportEl, {
    backgroundColor: '#0a0a0a',
    skipFonts: false,
    includeQueryParams: true,
    cacheBust: true,
    filter: (node) => {
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
      if (node instanceof HTMLImageElement) {
        if (!node.complete || node.naturalWidth === 0 || node.src === '') {
          return false;
        }
      }
      return true;
    },
  });
  
  // Restore original viewport and remove export flag
  workspace.setViewport(originalViewport);
  if (canvasEl) {
    delete canvasEl.dataset.exporting;
  }
  
  // Post-process SVG to add dark background and extract actual dimensions
  let svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);
  const widthMatch = svgContent.match(/width="([^"]+)"/);
  const heightMatch = svgContent.match(/height="([^"]+)"/);
  
  // Use SVG's actual dimensions (more accurate than viewport)
  let svgWidth = viewportRect.width;
  let svgHeight = viewportRect.height;
  
  if (widthMatch && heightMatch) {
    svgWidth = parseFloat(widthMatch[1]) || viewportRect.width;
    svgHeight = parseFloat(heightMatch[1]) || viewportRect.height;
    svgContent = svgContent.replace(
      /(<svg[^>]*>)/,
      `$1<rect width="${widthMatch[1]}" height="${heightMatch[1]}" fill="#0a0a0a"/>`
    );
  }
  
  // Re-encode as data URL
  const processedDataUrl = 'data:image/svg+xml,' + encodeURIComponent(svgContent);
  
  return {
    dataUrl: processedDataUrl,
    svgContent: svgContent,
    width: svgWidth,
    height: svgHeight,
  };
}

// Export canvas as high-resolution PNG (via SVG → Rust resvg → PNG)
export async function exportAsPng(): Promise<boolean> {
  console.log('Starting high-res PNG export (via Rust resvg)...');
  
  try {
    if (workspace.nodes.length === 0) {
      console.error('No nodes to export');
      return false;
    }
    
    // Step 1: Generate SVG (captures all nodes perfectly)
    console.log('Generating SVG...');
    const svgResult = await generateSvgDataUrl();
    if (!svgResult) {
      console.error('Failed to generate SVG');
      return false;
    }
    
    console.log('SVG generated, dimensions:', svgResult.width, 'x', svgResult.height);
    
    // Step 2: Ask user where to save
    const { save } = await import('@tauri-apps/plugin-dialog');
    
    const defaultName = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_canvas.png`;
    
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{
        name: 'PNG Image',
        extensions: ['png']
      }]
    });

    if (!filePath) {
      console.log('User cancelled the save dialog');
      return false;
    }
    
    // Step 3: Convert SVG to high-res PNG using Rust (no browser limits!)
    const { invoke } = await import('@tauri-apps/api/core');
    
    // Use high scale factor - Rust has no canvas size limits
    const scale = 8.0;
    console.log(`Converting to PNG at ${scale}x scale via Rust...`);
    console.log(`Output resolution: ${Math.round(svgResult.width * scale)}x${Math.round(svgResult.height * scale)}`);
    
    await invoke('svg_to_png', {
      svgContent: svgResult.svgContent,
      filePath: filePath,
      scale: scale,
    });
    
    console.log('Canvas exported as high-res PNG successfully to:', filePath);
    return true;
  } catch (error) {
    console.error('Error exporting canvas as PNG:', error);
    return false;
  }
}

// Export canvas as SVG image
export async function exportAsSvg(): Promise<boolean> {
  console.log('Starting SVG export...');
  
  try {
    if (workspace.nodes.length === 0) {
      console.error('No nodes to export');
      return false;
    }
    
    // Store original viewport to restore later
    const originalViewport = { ...workspace.viewport };
    
    // Mark as exporting to disable LOD simplification
    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (canvasEl) {
      canvasEl.dataset.exporting = 'true';
    }
    
    // Trigger fit view to show all nodes
    window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.1 } }));
    
    // Wait for fitView animation to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get the SvelteFlow viewport element
    const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
    if (!viewportEl) {
      console.error('SvelteFlow viewport not found');
      if (canvasEl) delete canvasEl.dataset.exporting;
      workspace.setViewport(originalViewport);
      return false;
    }
    
    console.log('Viewport element found, generating SVG...');

    // Create an SVG - vectors scale infinitely without blur
    const svgDataUrl = await toSvg(viewportEl, {
      backgroundColor: '#0a0a0a',
      skipFonts: false,
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
    
    // Restore original viewport and remove export flag
    workspace.setViewport(originalViewport);
    if (canvasEl) {
      delete canvasEl.dataset.exporting;
    }
    
    console.log('SVG generated, dataUrl length:', svgDataUrl?.length);

    // Use Tauri file dialog to choose save location
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    
    const defaultName = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_canvas.svg`;
    
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{
        name: 'SVG Image',
        extensions: ['svg']
      }]
    });

    if (filePath) {
      // Extract SVG content from data URL
      let svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);
      
      // Post-process: Add a dark background rect that covers the full SVG area
      // Extract width and height from SVG tag
      const widthMatch = svgContent.match(/width="([^"]+)"/);
      const heightMatch = svgContent.match(/height="([^"]+)"/);
      
      if (widthMatch && heightMatch) {
        const width = widthMatch[1];
        const height = heightMatch[1];
        
        // Insert background rect right after the opening <svg> tag
        svgContent = svgContent.replace(
          /(<svg[^>]*>)/,
          `$1<rect width="${width}" height="${height}" fill="#0a0a0a"/>`
        );
      }
      
      await writeTextFile(filePath, svgContent);
      console.log('Canvas exported as SVG successfully to:', filePath);
      return true;
    } else {
      console.log('User cancelled the save dialog');
      return false;
    }
  } catch (error) {
    console.error('Error exporting canvas as SVG:', error);
    return false;
  }
}
