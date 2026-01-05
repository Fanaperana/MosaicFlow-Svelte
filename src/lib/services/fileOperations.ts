// Workspace File Operations
// Handles loading workspace files using Tauri file system
// Real-time saving is handled by nodeFileService and edgeFileService

import { workspace } from '$lib/stores/workspace.svelte';
import type { WorkspaceData, UIState, NodeType } from '$lib/types';
import { toPng, toSvg } from 'html-to-image';
import { toast } from 'svelte-sonner';
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
  
  // Notify Canvas to switch to detailed LOD
  window.dispatchEvent(new CustomEvent('mosaicflow:exportStart'));
  
  // Trigger fit view to show all nodes
  window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.1 } }));
  
  // Wait for fitView animation to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Force LOD to detailed by directly modifying the class
  const flowEl = document.querySelector('#mosaic-flow') as HTMLElement;
  let originalLodClass = '';
  if (flowEl) {
    originalLodClass = flowEl.className;
    flowEl.className = flowEl.className
      .replace(/lod-simplified/g, 'lod-detailed')
      .replace(/lod-medium/g, 'lod-detailed');
    console.log('Forced LOD to detailed for SVG capture');
  }
  
  // Inject override styles to force all content visible
  const overrideStyle = document.createElement('style');
  overrideStyle.id = 'export-lod-override-svg';
  overrideStyle.textContent = `
    .svelte-flow__node .node-content { display: block !important; opacity: 1 !important; }
    .svelte-flow__handle { display: block !important; opacity: 1 !important; }
    .svelte-flow__edge { opacity: 1 !important; }
    .svelte-flow__edge-label { display: block !important; opacity: 1 !important; }
    .svelte-flow__resize-control { display: block !important; }
    .svelte-flow__node .node-header { font-size: inherit !important; }
  `;
  document.head.appendChild(overrideStyle);
  
  // Wait for DOM to update with forced LOD class and styles
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Get the SvelteFlow viewport element
  const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
  if (!viewportEl) {
    console.error('SvelteFlow viewport not found');
    overrideStyle.remove();
    if (flowEl && originalLodClass) flowEl.className = originalLodClass;
    if (canvasEl) delete canvasEl.dataset.exporting;
    window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
    workspace.setViewport(originalViewport);
    return null;
  }
  
  // Get viewport dimensions for the PNG canvas
  const viewportRect = viewportEl.getBoundingClientRect();
  
  // Create SVG - this captures all visible nodes perfectly
  // skipFonts: true to avoid cross-origin CSS errors with remote fonts
  const svgDataUrl = await toSvg(viewportEl, {
    backgroundColor: '#0a0a0a',
    skipFonts: true, // Skip remote font embedding to avoid CORS errors
    includeQueryParams: false, // Avoid cache-busting that can fail
    cacheBust: false, // Disable to prevent network requests
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
      // Filter out images that aren't fully loaded or are from external URLs
      if (node instanceof HTMLImageElement) {
        if (!node.complete || node.naturalWidth === 0 || node.src === '') {
          return false;
        }
        // Skip external images that might fail to fetch
        try {
          const imgUrl = new URL(node.src);
          if (imgUrl.protocol === 'http:' || imgUrl.protocol === 'https:') {
            if (!node.crossOrigin && imgUrl.origin !== window.location.origin) {
              return false;
            }
          }
        } catch {
          return false;
        }
      }
      return true;
    },
  });
  
  // Remove override styles
  overrideStyle.remove();
  
  // Restore original viewport, LOD class, and remove export flag
  workspace.setViewport(originalViewport);
  if (flowEl && originalLodClass) {
    flowEl.className = originalLodClass;
  }
  if (canvasEl) {
    delete canvasEl.dataset.exporting;
  }
  window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
  
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

// Export canvas as high-resolution PNG using DOM capture
// Strategy: Use fitView to position content correctly, then capture the viewport
export async function exportAsPng(): Promise<boolean> {
  console.log('Starting high-res PNG export...');
  
  // Show loading toast
  const toastId = toast.loading('Preparing PNG export...', {
    description: 'Calculating bounds and positioning nodes'
  });
  
  try {
    if (workspace.nodes.length === 0) {
      toast.error('No nodes to export', { id: toastId });
      return false;
    }
    
    // Calculate exact bounding box from node data for output dimensions
    const margin = 50;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const node of workspace.nodes) {
      const x = node.position.x;
      const y = node.position.y;
      const width = node.measured?.width || node.width || 200;
      const height = node.measured?.height || node.height || 100;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
    
    // Desired output dimensions (content + margins)
    const outputWidth = Math.ceil(maxX - minX + margin * 2);
    const outputHeight = Math.ceil(maxY - minY + margin * 2);
    
    console.log('Node bounds:', { minX, minY, maxX, maxY });
    console.log('Output dimensions:', { outputWidth, outputHeight });
    
    // Store original viewport to restore later
    const originalViewport = { ...workspace.viewport };
    
    // Mark as exporting
    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (canvasEl) {
      canvasEl.dataset.exporting = 'true';
    }
    
    window.dispatchEvent(new CustomEvent('mosaicflow:exportStart'));
    
    toast.loading('Fitting view...', { id: toastId, description: 'Positioning nodes for capture' });
    
    // Use fitView to position content correctly - this is the same as pressing "fit to screen"
    // Use padding: 0 so nodes fill the viewport, we'll add our own margin via viewBox
    window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.02 } }));
    
    // Wait for fitView animation to complete
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Get the viewport state after fitView
    const fitViewport = { ...workspace.viewport };
    console.log('Viewport after fitView:', fitViewport);
    
    toast.loading('Capturing canvas...', { id: toastId, description: 'Converting images to base64' });
    
    // Force LOD to detailed by directly modifying the class
    const flowEl = document.querySelector('#mosaic-flow') as HTMLElement;
    let originalLodClass = '';
    if (flowEl) {
      originalLodClass = flowEl.className;
      flowEl.className = flowEl.className
        .replace(/lod-simplified/g, 'lod-detailed')
        .replace(/lod-medium/g, 'lod-detailed');
      console.log('Forced LOD to detailed for PNG export');
    }
    
    // Inject override styles to force all content visible
    const overrideStyle = document.createElement('style');
    overrideStyle.id = 'export-lod-override-png-export';
    overrideStyle.textContent = `
      #mosaic-flow .svelte-flow__node .node-content { display: block !important; opacity: 1 !important; visibility: visible !important; }
      #mosaic-flow .svelte-flow__handle { display: block !important; opacity: 1 !important; }
      #mosaic-flow .svelte-flow__edge { opacity: 1 !important; }
      #mosaic-flow .svelte-flow__edge-path { opacity: 1 !important; }
      #mosaic-flow .svelte-flow__edge-label { display: block !important; opacity: 1 !important; }
      #mosaic-flow .svelte-flow__resize-control { display: none !important; }
      #mosaic-flow .node-wrapper { opacity: 1 !important; }
      #mosaic-flow .node-header { opacity: 1 !important; }
      #mosaic-flow .lod-placeholder { display: none !important; }
    `;
    document.head.appendChild(overrideStyle);
    
    // Wait for DOM to update with forced LOD class and styles
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Convert all asset:// and http images to base64 data URLs before capture
    console.log('Converting images to base64...');
    const images = document.querySelectorAll('#mosaic-flow img') as NodeListOf<HTMLImageElement>;
    const originalSrcs = new Map<HTMLImageElement, string>();
    
    for (const img of images) {
      if (img.src && !img.src.startsWith('data:')) {
        originalSrcs.set(img, img.src);
        try {
          // Try to convert to base64
          const response = await fetch(img.src);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          img.src = dataUrl;
        } catch (e) {
          console.warn('Could not convert image to base64:', img.src, e);
        }
      }
    }
    
    // Wait for images to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the SvelteFlow viewport element
    const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
    if (!viewportEl) {
      console.error('SvelteFlow viewport not found');
      // Restore images
      originalSrcs.forEach((src, img) => { img.src = src; });
      overrideStyle.remove();
      if (flowEl && originalLodClass) flowEl.className = originalLodClass;
      if (canvasEl) delete canvasEl.dataset.exporting;
      window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
      workspace.setViewport(originalViewport);
      return false;
    }
    
    toast.loading('Generating SVG...', { id: toastId, description: 'Capturing DOM elements' });
    console.log('Generating SVG from DOM...');
    
    // Generate SVG with html-to-image - don't limit width/height, let viewBox crop later
    const svgDataUrl = await toSvg(viewportEl, {
      backgroundColor: '#0a0a0a',
      skipFonts: true,
      includeQueryParams: false,
      cacheBust: false,
      filter: (node) => {
        if (node instanceof Element) {
          const classList = node.classList;
          if (classList?.contains('svelte-flow__controls') ||
              classList?.contains('svelte-flow__minimap') ||
              classList?.contains('svelte-flow__attribution') ||
              classList?.contains('svelte-flow__panel') ||
              classList?.contains('cm-widgetBuffer') ||
              classList?.contains('svelte-flow__resize-control')) {
            return false;
          }
        }
        return true;
      },
    });
    
    // Restore original image sources
    originalSrcs.forEach((src, img) => { img.src = src; });
    
    // Cleanup: Remove override styles and restore state
    overrideStyle.remove();
    if (flowEl && originalLodClass) {
      flowEl.className = originalLodClass;
    }
    if (canvasEl) {
      delete canvasEl.dataset.exporting;
    }
    window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
    workspace.setViewport(originalViewport);
    
    console.log('SVG generated, length:', svgDataUrl.length);
    
    // Post-process SVG to crop to content bounds
    // After fitView, the viewport is positioned to show all nodes centered
    // The SVG internal transform is: translate(viewport.x, viewport.y) scale(viewport.zoom)
    // A node at world (nodeX, nodeY) appears at screen position:
    //   screenX = nodeX * zoom + viewport.x
    //   screenY = nodeY * zoom + viewport.y
    
    let svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);
    
    const zoom = fitViewport.zoom;
    
    // Screen position of the top-left node corner
    const screenMinX = minX * zoom + fitViewport.x;
    const screenMinY = minY * zoom + fitViewport.y;
    
    // Screen position of the bottom-right node corner  
    const screenMaxX = maxX * zoom + fitViewport.x;
    const screenMaxY = maxY * zoom + fitViewport.y;
    
    // Content size in screen pixels
    const screenContentWidth = screenMaxX - screenMinX;
    const screenContentHeight = screenMaxY - screenMinY;
    
    // Add margin in screen pixels
    const screenMargin = margin * zoom;
    
    // viewBox: start from (screenMinX - margin, screenMinY - margin)
    const viewBoxX = screenMinX - screenMargin;
    const viewBoxY = screenMinY - screenMargin;
    const viewBoxWidth = screenContentWidth + screenMargin * 2;
    const viewBoxHeight = screenContentHeight + screenMargin * 2;
    
    console.log('ViewBox calculation:', { 
      fitViewport,
      zoom,
      screenMinX, screenMinY,
      screenMaxX, screenMaxY,
      viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight,
      outputWidth, outputHeight 
    });
    
    // Update SVG dimensions to our desired output size
    svgContent = svgContent
      .replace(/width="[^"]*"/, `width="${outputWidth}"`)
      .replace(/height="[^"]*"/, `height="${outputHeight}"`);
    
    // Set viewBox to clip to our content area (maintains aspect ratio)
    if (svgContent.includes('viewBox=')) {
      svgContent = svgContent.replace(/viewBox="[^"]*"/, `viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}"`);
    } else {
      svgContent = svgContent.replace(/<svg/, `<svg viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}"`);
    }
    
    // Add dark background rect covering the viewBox area
    svgContent = svgContent.replace(
      /(<svg[^>]*>)/,
      `$1<rect x="${viewBoxX}" y="${viewBoxY}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="#0a0a0a"/>`
    );
    
    // Re-encode as data URL for canvas rendering
    const processedSvgDataUrl = 'data:image/svg+xml,' + encodeURIComponent(svgContent);
    
    // Ask user where to save
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
      toast.dismiss(toastId);
      console.log('User cancelled the save dialog');
      return false;
    }
    
    // Send SVG to Rust for high-quality PNG rendering
    // Since this SVG has foreignObject/HTML, we need to use the headless browser approach
    // or convert via browser canvas first
    toast.loading('Rendering PNG...', { id: toastId, description: 'Converting to high-resolution image' });
    console.log('Converting SVG to PNG via canvas...');
    
    // Use browser canvas to convert SVG to PNG (supports foreignObject)
    const img = new Image();
    const pngDataUrl = await new Promise<string>((resolve, reject) => {
      img.onload = () => {
        try {
          // Use 3x scale for high quality
          const scale = 3;
          const canvas = document.createElement('canvas');
          canvas.width = outputWidth * scale;
          canvas.height = outputHeight * scale;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas 2d context'));
            return;
          }
          
          // Fill background
          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw scaled
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
          
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = (err) => {
        console.error('Failed to load SVG into image:', err);
        reject(new Error('Failed to load SVG for PNG conversion'));
      };
      
      img.src = processedSvgDataUrl;
    });
    
    toast.loading('Saving file...', { id: toastId, description: 'Writing PNG to disk' });
    console.log('PNG generated, saving to file...');
    
    // Save PNG to file
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const base64Data = pngDataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    await writeFile(filePath, bytes);
    toast.success('PNG exported successfully!', { 
      id: toastId, 
      description: `Saved to ${filePath.split(/[/\\]/).pop()}`,
      duration: 4000
    });
    console.log('Canvas exported as high-res PNG successfully to:', filePath);
    return true;
  } catch (error) {
    console.error('Error exporting canvas as PNG:', error);
    toast.error('Failed to export PNG', { 
      id: toastId, 
      description: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

// Export canvas as SVG image with exact node bounds
// Algorithm:
// 1. Calculate bounding box of all nodes
// 2. Capture the full viewport DOM as SVG  
// 3. Use viewBox to clip to just the content area
export async function exportAsSvg(): Promise<boolean> {
  console.log('Starting SVG export with exact bounds...');
  
  const toastId = toast.loading('Preparing SVG export...', {
    description: 'Calculating bounds'
  });
  
  try {
    if (workspace.nodes.length === 0) {
      toast.error('No nodes to export', { id: toastId });
      return false;
    }
    
    // Calculate exact bounding box from node data
    const margin = 50;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const node of workspace.nodes) {
      const x = node.position.x;
      const y = node.position.y;
      const width = node.measured?.width || node.width || 200;
      const height = node.measured?.height || node.height || 100;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
    
    // Desired output dimensions (content + margins)
    const outputWidth = Math.ceil(maxX - minX + margin * 2);
    const outputHeight = Math.ceil(maxY - minY + margin * 2);
    
    console.log('SVG Node bounds:', { minX, minY, maxX, maxY });
    console.log('SVG Output dimensions:', { outputWidth, outputHeight });
    
    // Store original viewport to restore later
    const originalViewport = { ...workspace.viewport };
    
    // Mark as exporting
    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (canvasEl) {
      canvasEl.dataset.exporting = 'true';
    }
    
    window.dispatchEvent(new CustomEvent('mosaicflow:exportStart'));
    
    toast.loading('Fitting view...', { id: toastId, description: 'Positioning nodes for capture' });
    
    // Use fitView to position content correctly - same as pressing "fit to screen"
    window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.02 } }));
    
    // Wait for fitView animation to complete
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Get the viewport state after fitView
    const fitViewport = { ...workspace.viewport };
    console.log('SVG Viewport after fitView:', fitViewport);
    
    toast.loading('Capturing canvas...', { id: toastId, description: 'Converting images to base64' });
    
    // Force LOD to detailed by directly modifying the class
    const flowEl = document.querySelector('#mosaic-flow') as HTMLElement;
    let originalLodClass = '';
    if (flowEl) {
      originalLodClass = flowEl.className;
      flowEl.className = flowEl.className
        .replace(/lod-simplified/g, 'lod-detailed')
        .replace(/lod-medium/g, 'lod-detailed');
      console.log('Forced LOD to detailed for SVG export');
    }
    
    // Inject override styles to force all content visible
    const overrideStyle = document.createElement('style');
    overrideStyle.id = 'export-lod-override-svg-export';
    overrideStyle.textContent = `
      #mosaic-flow .svelte-flow__node .node-content { display: block !important; opacity: 1 !important; visibility: visible !important; }
      #mosaic-flow .svelte-flow__handle { display: block !important; opacity: 1 !important; }
      #mosaic-flow .svelte-flow__edge { opacity: 1 !important; }
      #mosaic-flow .svelte-flow__edge-path { opacity: 1 !important; }
      #mosaic-flow .svelte-flow__edge-label { display: block !important; opacity: 1 !important; }
      #mosaic-flow .svelte-flow__resize-control { display: none !important; }
      #mosaic-flow .node-wrapper { opacity: 1 !important; }
      #mosaic-flow .node-header { opacity: 1 !important; }
      #mosaic-flow .lod-placeholder { display: none !important; }
    `;
    document.head.appendChild(overrideStyle);
    
    // Wait for DOM to update with forced LOD class and styles
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Convert all asset:// and http images to base64 data URLs before capture
    console.log('Converting images to base64 for SVG export...');
    const images = document.querySelectorAll('#mosaic-flow img') as NodeListOf<HTMLImageElement>;
    const originalSrcs = new Map<HTMLImageElement, string>();
    
    for (const img of images) {
      if (img.src && !img.src.startsWith('data:')) {
        originalSrcs.set(img, img.src);
        try {
          const response = await fetch(img.src);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          img.src = dataUrl;
        } catch (e) {
          console.warn('Could not convert image to base64:', img.src, e);
        }
      }
    }
    
    // Wait for images to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the SvelteFlow viewport element
    const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
    if (!viewportEl) {
      console.error('SvelteFlow viewport not found');
      originalSrcs.forEach((src, img) => { img.src = src; });
      overrideStyle.remove();
      if (flowEl && originalLodClass) flowEl.className = originalLodClass;
      if (canvasEl) delete canvasEl.dataset.exporting;
      window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
      workspace.setViewport(originalViewport);
      return false;
    }
    
    console.log('Generating SVG with exact bounds...');

    // Generate SVG - don't limit width/height, we'll use viewBox to crop
    const svgDataUrl = await toSvg(viewportEl, {
      backgroundColor: '#0a0a0a',
      skipFonts: true,
      includeQueryParams: false,
      cacheBust: false,
      filter: (node) => {
        if (node instanceof Element) {
          const classList = node.classList;
          if (classList?.contains('svelte-flow__controls') ||
              classList?.contains('svelte-flow__minimap') ||
              classList?.contains('svelte-flow__attribution') ||
              classList?.contains('svelte-flow__panel') ||
              classList?.contains('cm-widgetBuffer') ||
              classList?.contains('svelte-flow__resize-control')) {
            return false;
          }
        }
        return true;
      },
    });
    
    // Restore original image sources
    originalSrcs.forEach((src, img) => { img.src = src; });
    
    // Remove override styles and restore state
    overrideStyle.remove();
    workspace.setViewport(originalViewport);
    if (flowEl && originalLodClass) {
      flowEl.className = originalLodClass;
    }
    if (canvasEl) {
      delete canvasEl.dataset.exporting;
    }
    window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
    
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
      // Post-process SVG to crop to content bounds
      // After fitView, the viewport is positioned to show all nodes centered
      let svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);
      
      const zoom = fitViewport.zoom;
      
      // Screen position of the top-left node corner
      const screenMinX = minX * zoom + fitViewport.x;
      const screenMinY = minY * zoom + fitViewport.y;
      
      // Screen position of the bottom-right node corner  
      const screenMaxX = maxX * zoom + fitViewport.x;
      const screenMaxY = maxY * zoom + fitViewport.y;
      
      // Content size in screen pixels
      const screenContentWidth = screenMaxX - screenMinX;
      const screenContentHeight = screenMaxY - screenMinY;
      
      // Add margin in screen pixels
      const screenMargin = margin * zoom;
      
      // viewBox: start from (screenMinX - margin, screenMinY - margin)
      const viewBoxX = screenMinX - screenMargin;
      const viewBoxY = screenMinY - screenMargin;
      const viewBoxWidth = screenContentWidth + screenMargin * 2;
      const viewBoxHeight = screenContentHeight + screenMargin * 2;
      
      console.log('SVG ViewBox calculation:', { 
        fitViewport,
        zoom,
        screenMinX, screenMinY,
        viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight,
        outputWidth, outputHeight 
      });
      
      toast.loading('Processing SVG...', { id: toastId, description: 'Applying viewBox crop' });
      
      // Update SVG dimensions
      svgContent = svgContent
        .replace(/width="[^"]*"/, `width="${outputWidth}"`)
        .replace(/height="[^"]*"/, `height="${outputHeight}"`);
      
      // Set viewBox to clip to our content area
      if (svgContent.includes('viewBox=')) {
        svgContent = svgContent.replace(/viewBox="[^"]*"/, `viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}"`);
      } else {
        svgContent = svgContent.replace(/<svg/, `<svg viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}"`);
      }
      
      // Add background rect covering the viewBox area
      svgContent = svgContent.replace(
        /(<svg[^>]*>)/,
        `$1<rect x="${viewBoxX}" y="${viewBoxY}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="#0a0a0a"/>`
      );
      
      await writeTextFile(filePath, svgContent);
      toast.success('SVG exported successfully!', { 
        id: toastId, 
        description: `Saved to ${filePath.split(/[/\\]/).pop()}`,
        duration: 4000
      });
      console.log('Canvas exported as SVG successfully to:', filePath);
      return true;
    } else {
      toast.dismiss(toastId);
      console.log('User cancelled the save dialog');
      return false;
    }
  } catch (error) {
    console.error('Error exporting canvas as SVG:', error);
    toast.error('Failed to export SVG', { 
      id: toastId, 
      description: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}
