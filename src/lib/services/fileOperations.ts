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
export async function exportAsPng(): Promise<boolean> {
  console.log('Starting PNG export...');
  
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
    window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.15 } }));
    
    // Wait for fitView animation to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now set zoom to 1 for consistent quality
    workspace.setViewport({
      x: workspace.viewport.x,
      y: workspace.viewport.y,
      zoom: 1
    });
    
    // Wait for zoom to apply
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get the SvelteFlow viewport element
    const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
    if (!viewportEl) {
      console.error('SvelteFlow viewport not found');
      if (canvasEl) delete canvasEl.dataset.exporting;
      workspace.setViewport(originalViewport);
      return false;
    }
    
    console.log('Viewport element found, generating PNG...');

    // Create a high-resolution PNG
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: '#0a0a0a',
      pixelRatio: 2,
      skipFonts: true,
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
    
    // Calculate bounds of all nodes (including children in absolute coordinates)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const node of workspace.nodes) {
      const width = node.width || 200;
      const height = node.height || 100;
      
      // For child nodes, calculate absolute position
      let absX = node.position.x;
      let absY = node.position.y;
      
      if (node.parentId) {
        const parent = workspace.nodes.find(n => n.id === node.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }
      
      minX = Math.min(minX, absX);
      minY = Math.min(minY, absY);
      maxX = Math.max(maxX, absX + width);
      maxY = Math.max(maxY, absY + height);
    }
    
    // Add padding
    const padding = 40;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    
    console.log('Calculated bounds:', { minX, minY, maxX, maxY, boundsWidth, boundsHeight });
    
    // Get canvas container to calculate proper viewport positioning
    const canvasRect = canvasEl?.getBoundingClientRect();
    if (!canvasRect) {
      console.error('Canvas container not found');
      if (canvasEl) delete canvasEl.dataset.exporting;
      return false;
    }
    
    // Center the bounds in the viewport at zoom 1
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const viewportX = canvasRect.width / 2 - centerX;
    const viewportY = canvasRect.height / 2 - centerY;
    
    // Set viewport to show all nodes centered at zoom 1
    workspace.setViewport({
      x: viewportX,
      y: viewportY,
      zoom: 1
    });
    
    // Wait for viewport to update
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
      skipFonts: false, // Include fonts for proper text rendering
      includeQueryParams: true,
      cacheBust: true,
      width: boundsWidth,
      height: boundsHeight,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
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

    console.log('Opening save dialog...');
    // Use Tauri file dialog to choose save location
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    
    const defaultName = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_canvas.svg`;
    console.log('Default filename:', defaultName);
    
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{
        name: 'SVG Image',
        extensions: ['svg']
      }]
    });
    
    console.log('Save dialog returned:', filePath);

    if (filePath) {
      // Extract SVG content from data URL
      let svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);
      
      // Post-process SVG to ensure background covers entire area
      // Add a background rect right after the opening <svg> tag
      svgContent = svgContent.replace(
        /(<svg[^>]*>)/,
        `$1<rect x="0" y="0" width="${boundsWidth}" height="${boundsHeight}" fill="#0a0a0a"/>`
      );
      
      console.log('Writing SVG to:', filePath);
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
