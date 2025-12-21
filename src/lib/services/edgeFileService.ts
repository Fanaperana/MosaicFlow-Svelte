// Edge File Service
// Handles real-time file operations for edges
// Each edge has its own folder with connection data

import type { MosaicEdge } from '$lib/types';

// Debounce timers for edge saves
const edgeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Debounce delay for edge saves (ms)
const EDGE_SAVE_DELAY = 100;

let workspacePath: string | null = null;

// Initialize the service with workspace path
export function initEdgeFileService(path: string) {
  workspacePath = path;
}

// Get the edge folder path
function getEdgeFolderPath(edgeId: string): string {
  return `${workspacePath}/edges/${edgeId}`;
}

// Ensure edge folder structure exists
async function ensureEdgeFolder(edgeId: string) {
  if (!workspacePath) return;
  
  const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
  const edgePath = getEdgeFolderPath(edgeId);
  
  if (!(await exists(edgePath))) {
    await mkdir(edgePath, { recursive: true });
  }
}

// Ensure edges parent folder exists
async function ensureEdgesFolder() {
  if (!workspacePath) return;
  
  const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
  const edgesPath = `${workspacePath}/edges`;
  
  if (!(await exists(edgesPath))) {
    await mkdir(edgesPath, { recursive: true });
  }
}

// Extract edge connection data (NDJSON format)
function extractEdgeData(edge: MosaicEdge): object {
  return {
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    type: edge.type,
    animated: edge.animated,
    data: edge.data,
  };
}

// Save edge to file (debounced)
export function saveEdge(edge: MosaicEdge) {
  if (!workspacePath) return;
  
  // Clear existing timer
  if (edgeTimers.has(edge.id)) {
    clearTimeout(edgeTimers.get(edge.id));
  }
  
  // Set new debounced timer
  edgeTimers.set(edge.id, setTimeout(async () => {
    try {
      await ensureEdgesFolder();
      await ensureEdgeFolder(edge.id);
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      const edgeData = extractEdgeData(edge);
      const joinedPath = `${getEdgeFolderPath(edge.id)}/joined.json`;
      
      // Write as NDJSON (single line JSON for this edge)
      await writeTextFile(joinedPath, JSON.stringify(edgeData));
      edgeTimers.delete(edge.id);
    } catch (error) {
      console.error(`Error saving edge ${edge.id}:`, error);
    }
  }, EDGE_SAVE_DELAY));
}

// Save edge immediately (for edge creation)
export async function saveEdgeImmediate(edge: MosaicEdge) {
  if (!workspacePath) return;
  
  try {
    await ensureEdgesFolder();
    await ensureEdgeFolder(edge.id);
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    
    const edgeData = extractEdgeData(edge);
    await writeTextFile(`${getEdgeFolderPath(edge.id)}/joined.json`, JSON.stringify(edgeData));
  } catch (error) {
    console.error(`Error saving edge ${edge.id}:`, error);
  }
}

// Delete edge folder
export async function deleteEdgeFolder(edgeId: string) {
  if (!workspacePath) return;
  
  try {
    const { remove, exists } = await import('@tauri-apps/plugin-fs');
    const edgePath = getEdgeFolderPath(edgeId);
    
    if (await exists(edgePath)) {
      await remove(edgePath, { recursive: true });
    }
    
    // Clear any pending timer
    if (edgeTimers.has(edgeId)) {
      clearTimeout(edgeTimers.get(edgeId));
      edgeTimers.delete(edgeId);
    }
  } catch (error) {
    console.error(`Error deleting edge folder ${edgeId}:`, error);
  }
}

// Build edge style string from data properties
function buildEdgeStyle(data?: { 
  color?: string; 
  strokeWidth?: number; 
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
}): string | undefined {
  if (!data) return undefined;
  
  const parts: string[] = [];
  
  if (data.color) {
    parts.push(`stroke: ${data.color}`);
  }
  
  if (data.strokeWidth) {
    parts.push(`stroke-width: ${data.strokeWidth}px`);
  }
  
  // Handle stroke style (dashed, dotted, solid)
  if (data.strokeStyle === 'dashed') {
    parts.push('stroke-dasharray: 8 4');
  } else if (data.strokeStyle === 'dotted') {
    parts.push('stroke-dasharray: 2 2');
  }
  
  return parts.length > 0 ? parts.join('; ') + ';' : undefined;
}

// Build label style string from data properties
function buildLabelStyle(data?: {
  labelColor?: string;
  labelFontSize?: number;
}): string | undefined {
  if (!data) return undefined;
  
  const parts: string[] = [];
  
  if (data.labelColor) {
    parts.push(`color: ${data.labelColor}`);
  }
  
  if (data.labelFontSize) {
    parts.push(`font-size: ${data.labelFontSize}px`);
  }
  
  return parts.length > 0 ? parts.join('; ') + ';' : undefined;
}

// Build label background style string from data properties
function buildLabelBgStyle(data?: {
  labelBgColor?: string;
}): string | undefined {
  if (!data) return undefined;
  
  if (data.labelBgColor) {
    return `fill: ${data.labelBgColor};`;
  }
  
  return undefined;
}

// Load a single edge from file
export async function loadEdge(edgeId: string): Promise<MosaicEdge | null> {
  if (!workspacePath) return null;
  
  try {
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    
    const joinedPath = `${getEdgeFolderPath(edgeId)}/joined.json`;
    
    if (!(await exists(joinedPath))) {
      console.warn(`Edge file not found for ${edgeId}`);
      return null;
    }
    
    const content = await readTextFile(joinedPath);
    const edgeData = JSON.parse(content);
    
    // Reconstruct edge with proper style
    const edge: MosaicEdge = {
      id: edgeId,
      source: edgeData.source,
      target: edgeData.target,
      sourceHandle: edgeData.sourceHandle,
      targetHandle: edgeData.targetHandle,
      label: edgeData.label,
      type: edgeData.type || 'default',
      animated: edgeData.animated || false,
      data: edgeData.data || {},
      style: buildEdgeStyle(edgeData.data),
      labelStyle: buildLabelStyle(edgeData.data),
      labelBgStyle: buildLabelBgStyle(edgeData.data),
    };
    
    return edge;
  } catch (error) {
    console.error(`Error loading edge ${edgeId}:`, error);
    return null;
  }
}

// Load all edges from the edges folder
export async function loadAllEdges(): Promise<MosaicEdge[]> {
  if (!workspacePath) return [];
  
  try {
    const { readDir, exists } = await import('@tauri-apps/plugin-fs');
    
    const edgesPath = `${workspacePath}/edges`;
    if (!(await exists(edgesPath))) {
      return [];
    }
    
    const entries = await readDir(edgesPath);
    const edges: MosaicEdge[] = [];
    
    for (const entry of entries) {
      if (entry.isDirectory && entry.name) {
        const edge = await loadEdge(entry.name);
        if (edge) {
          edges.push(edge);
        }
      }
    }
    
    return edges;
  } catch (error) {
    console.error('Error loading edges:', error);
    return [];
  }
}

// Flush all pending saves
export async function flushPendingSaves() {
  for (const [edgeId, timer] of edgeTimers) {
    clearTimeout(timer);
    edgeTimers.delete(edgeId);
  }
}

// Reset the service
export function resetEdgeFileService() {
  flushPendingSaves();
  workspacePath = null;
}
