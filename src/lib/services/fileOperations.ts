// Workspace File Operations
// Handles loading workspace files using Tauri file system
// Real-time saving is handled by nodeFileService and edgeFileService

import { workspace } from '$lib/stores/workspace.svelte';
import type { WorkspaceData, UIState, NodeType } from '$lib/types';
import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from '@xyflow/svelte';
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

// ---------------------------------------------------------------------------
// Export helpers – shared between PNG and SVG exports
// ---------------------------------------------------------------------------

/** Prepare the DOM for capture (force LOD, convert images, etc.) and return
 *  a cleanup function.  This keeps the two export paths DRY. */
async function prepareForCapture(): Promise<{
  viewportEl: HTMLElement;
  cleanup: () => void;
  originalSrcs: Map<HTMLImageElement, string>;
} | null> {
  // Mark as exporting (forces detailed LOD in Canvas.svelte)
  const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
  if (canvasEl) canvasEl.dataset.exporting = 'true';
  window.dispatchEvent(new CustomEvent('mosaicflow:exportStart'));

  // Force LOD to detailed by directly modifying the class
  const flowEl = document.querySelector('#mosaic-flow') as HTMLElement;
  let originalLodClass = '';
  if (flowEl) {
    originalLodClass = flowEl.className;
    flowEl.className = flowEl.className
      .replace(/lod-simplified/g, 'lod-detailed')
      .replace(/lod-medium/g, 'lod-detailed');
  }

  // Inject override styles to force all content visible
  const overrideStyle = document.createElement('style');
  overrideStyle.id = 'export-lod-override';
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

  // Wait for DOM to update with forced LOD
  await new Promise(resolve => setTimeout(resolve, 300));

  // ---------------------------------------------------------------------------
  // Convert all <img> elements to base64 data URLs so they survive the
  // html-to-image SVG foreignObject serialisation.  asset:// and http(s)://
  // URLs are opaque to the foreign document context.
  // ---------------------------------------------------------------------------
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
        // Wait for the image to load with the new data URL src
        await new Promise<void>((resolve) => {
          if (img.complete) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve(); // proceed even on error
        });
      } catch (e) {
        console.warn('Could not convert image to base64:', img.src, e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Snapshot all <canvas> elements (e.g. MapLibre GL) into <img> overlays.
  // html-to-image serialises the DOM as SVG foreignObject, which cannot
  // capture canvas pixel data.  We create a temporary <img> with the canvas
  // snapshot placed on top and hide the original canvas during capture.
  // ---------------------------------------------------------------------------
  const canvasOverlays: { canvas: HTMLCanvasElement; overlay: HTMLImageElement }[] = [];
  const canvasElements = document.querySelectorAll('#mosaic-flow canvas') as NodeListOf<HTMLCanvasElement>;
  for (const cvs of canvasElements) {
    try {
      const dataUrl = cvs.toDataURL('image/png');
      const overlay = document.createElement('img');
      overlay.src = dataUrl;
      overlay.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: ${cvs.clientWidth}px;
        height: ${cvs.clientHeight}px;
        pointer-events: none;
        z-index: 9999;
      `;
      overlay.dataset.exportOverlay = 'true';

      // Place the overlay image relative to the canvas's parent
      const parent = cvs.parentElement;
      if (parent) {
        // Ensure parent is positioned so absolute overlay works
        const parentPos = getComputedStyle(parent).position;
        if (parentPos === 'static') {
          parent.style.position = 'relative';
          (parent as HTMLElement).dataset.exportResetPosition = 'true';
        }
        parent.appendChild(overlay);
      }

      // Hide the original canvas
      cvs.style.visibility = 'hidden';
      canvasOverlays.push({ canvas: cvs, overlay });

      // Wait for the overlay image to load
      await new Promise<void>((resolve) => {
        if (overlay.complete) { resolve(); return; }
        overlay.onload = () => resolve();
        overlay.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('Could not snapshot canvas element:', e);
    }
  }

  // Wait for image src updates and overlays to settle
  await new Promise(resolve => setTimeout(resolve, 100));

  const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
  if (!viewportEl) {
    console.error('SvelteFlow viewport element not found');
    // Immediate cleanup
    originalSrcs.forEach((src, img) => { img.src = src; });
    canvasOverlays.forEach(({ canvas, overlay }) => {
      canvas.style.visibility = '';
      overlay.remove();
      const p = canvas.parentElement;
      if (p?.dataset.exportResetPosition) { p.style.position = ''; delete p.dataset.exportResetPosition; }
    });
    overrideStyle.remove();
    if (flowEl && originalLodClass) flowEl.className = originalLodClass;
    if (canvasEl) delete canvasEl.dataset.exporting;
    window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
    return null;
  }

  const cleanup = () => {
    // Restore original image sources
    originalSrcs.forEach((src, img) => { img.src = src; });

    // Remove canvas overlays and restore original canvases
    canvasOverlays.forEach(({ canvas, overlay }) => {
      canvas.style.visibility = '';
      overlay.remove();
      const p = canvas.parentElement;
      if (p?.dataset.exportResetPosition) {
        p.style.position = '';
        delete p.dataset.exportResetPosition;
      }
    });

    overrideStyle.remove();
    if (flowEl && originalLodClass) flowEl.className = originalLodClass;
    if (canvasEl) delete canvasEl.dataset.exporting;
    window.dispatchEvent(new CustomEvent('mosaicflow:exportEnd'));
  };

  return { viewportEl, cleanup, originalSrcs };
}

/** Standard filter used by html-to-image to exclude UI chrome from the capture. */
function captureFilter(node: unknown): boolean {
  if (node instanceof Element) {
    const cl = node.classList;
    if (
      cl?.contains('svelte-flow__controls') ||
      cl?.contains('svelte-flow__minimap') ||
      cl?.contains('svelte-flow__attribution') ||
      cl?.contains('svelte-flow__panel') ||
      cl?.contains('cm-widgetBuffer') ||
      cl?.contains('svelte-flow__resize-control')
    ) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Export canvas as high-resolution PNG
// Strategy:
//   1. Calculate the bounding box of all nodes
//   2. Use getViewportForBounds to compute the exact transform that maps
//      content into the desired image dimensions
//   3. Pass explicit width, height, and style.transform to toSvg so it
//      captures the content at the right scale – no viewBox hacks needed
//   4. Render the SVG onto a 3× canvas for a crisp PNG
// ---------------------------------------------------------------------------
export async function exportAsPng(): Promise<boolean> {
  console.log('Starting high-res PNG export…');

  const toastId = toast.loading('Preparing PNG export…', {
    description: 'Calculating bounds and positioning nodes',
  });

  try {
    if (workspace.nodes.length === 0) {
      toast.error('No nodes to export', { id: toastId });
      return false;
    }

    // --- 1. Compute node bounds & output dimensions -----------------------
    const PADDING = 0.05; // 5% padding around content
    const bounds = getNodesBounds(workspace.nodes);
    const imageWidth  = Math.ceil(bounds.width  * (1 + PADDING * 2));
    const imageHeight = Math.ceil(bounds.height * (1 + PADDING * 2));

    console.log('Node bounds:', bounds);
    console.log('Output dimensions:', { imageWidth, imageHeight });

    // --- 2. Compute the viewport transform for the capture ----------------
    //   getViewportForBounds returns {x, y, zoom} such that the node rect
    //   is centred inside imageWidth × imageHeight with the given padding.
    const captureViewport = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.01,  // minZoom
      8,     // maxZoom
      PADDING,
    );

    console.log('Capture viewport:', captureViewport);

    // --- 3. Prepare DOM (force LOD, base64-ify images, …) -----------------
    toast.loading('Preparing canvas…', { id: toastId, description: 'Converting images to base64' });

    const prep = await prepareForCapture();
    if (!prep) {
      toast.error('Viewport element not found', { id: toastId });
      return false;
    }
    const { viewportEl, cleanup } = prep;

    // --- 4. Capture SVG ---------------------------------------------------
    toast.loading('Generating SVG…', { id: toastId, description: 'Capturing DOM elements' });

    let svgDataUrl: string;
    try {
      svgDataUrl = await toSvg(viewportEl, {
        width: imageWidth,
        height: imageHeight,
        backgroundColor: '#0a0a0a',
        skipFonts: true,
        includeQueryParams: false,
        cacheBust: false,
        style: {
          width:  `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${captureViewport.x}px, ${captureViewport.y}px) scale(${captureViewport.zoom})`,
        },
        filter: captureFilter,
      });
    } finally {
      cleanup();
    }

    console.log('SVG captured, data-url length:', svgDataUrl.length);

    // --- 5. Ask user where to save ----------------------------------------
    const { save } = await import('@tauri-apps/plugin-dialog');
    const defaultName = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_canvas.png`;
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    if (!filePath) {
      toast.dismiss(toastId);
      return false;
    }

    // --- 6. Render SVG → canvas → PNG at 3× scale -------------------------
    toast.loading('Rendering PNG…', { id: toastId, description: 'Converting to high-resolution image' });

    const pngDataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const SCALE = 3;
          const canvas = document.createElement('canvas');
          canvas.width  = imageWidth  * SCALE;
          canvas.height = imageHeight * SCALE;

          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Could not get canvas 2d context')); return; }

          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.scale(SCALE, SCALE);
          ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load SVG for PNG conversion'));
      img.src = svgDataUrl;
    });

    // --- 7. Write to disk -------------------------------------------------
    toast.loading('Saving file…', { id: toastId, description: 'Writing PNG to disk' });

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
      duration: 4000,
    });
    console.log('Canvas exported as high-res PNG to:', filePath);
    return true;
  } catch (error) {
    console.error('Error exporting canvas as PNG:', error);
    toast.error('Failed to export PNG', {
      id: toastId,
      description: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Export canvas as SVG
// Same strategy as PNG but we save the SVG directly instead of rasterising.
// ---------------------------------------------------------------------------
export async function exportAsSvg(): Promise<boolean> {
  console.log('Starting SVG export…');

  const toastId = toast.loading('Preparing SVG export…', {
    description: 'Calculating bounds',
  });

  try {
    if (workspace.nodes.length === 0) {
      toast.error('No nodes to export', { id: toastId });
      return false;
    }

    // --- 1. Compute node bounds & output dimensions -----------------------
    const PADDING = 0.05; // 5% padding around content
    const bounds = getNodesBounds(workspace.nodes);
    const imageWidth  = Math.ceil(bounds.width  * (1 + PADDING * 2));
    const imageHeight = Math.ceil(bounds.height * (1 + PADDING * 2));

    console.log('SVG Node bounds:', bounds);
    console.log('SVG Output dimensions:', { imageWidth, imageHeight });

    // --- 2. Compute the viewport transform for the capture ----------------
    const captureViewport = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.01,
      8,
      PADDING,
    );

    console.log('SVG Capture viewport:', captureViewport);

    // --- 3. Prepare DOM ---------------------------------------------------
    toast.loading('Preparing canvas…', { id: toastId, description: 'Converting images to base64' });

    const prep = await prepareForCapture();
    if (!prep) {
      toast.error('Viewport element not found', { id: toastId });
      return false;
    }
    const { viewportEl, cleanup } = prep;

    // --- 4. Capture SVG ---------------------------------------------------
    toast.loading('Capturing canvas…', { id: toastId, description: 'Generating SVG' });

    let svgDataUrl: string;
    try {
      svgDataUrl = await toSvg(viewportEl, {
        width: imageWidth,
        height: imageHeight,
        backgroundColor: '#0a0a0a',
        skipFonts: true,
        includeQueryParams: false,
        cacheBust: false,
        style: {
          width:  `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${captureViewport.x}px, ${captureViewport.y}px) scale(${captureViewport.zoom})`,
        },
        filter: captureFilter,
      });
    } finally {
      cleanup();
    }

    console.log('SVG generated, dataUrl length:', svgDataUrl.length);

    // --- 5. Ask user where to save ----------------------------------------
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const defaultName = `${workspace.name.replace(/[^a-z0-9]/gi, '_')}_canvas.svg`;
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'SVG Image', extensions: ['svg'] }],
    });
    if (!filePath) {
      toast.dismiss(toastId);
      return false;
    }

    // --- 6. Decode, fix background, & save --------------------------------
    toast.loading('Saving file…', { id: toastId, description: 'Writing SVG to disk' });

    let svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);

    // html-to-image sets backgroundColor on the captured element only, which
    // doesn't cover the full SVG canvas when the viewport transform is used.
    // Inject a full-size background rect right after the opening <svg> tag.
    svgContent = svgContent.replace(
      /(<svg[^>]*>)/,
      `$1<rect width="${imageWidth}" height="${imageHeight}" fill="#0a0a0a"/>`
    );

    await writeTextFile(filePath, svgContent);

    toast.success('SVG exported successfully!', {
      id: toastId,
      description: `Saved to ${filePath.split(/[/\\]/).pop()}`,
      duration: 4000,
    });
    console.log('Canvas exported as SVG to:', filePath);
    return true;
  } catch (error) {
    console.error('Error exporting canvas as SVG:', error);
    toast.error('Failed to export SVG', {
      id: toastId,
      description: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
