// Node File Service
// Handles real-time file operations for individual nodes
// Each node has its own folder with content and properties files

import type { MosaicNode, MosaicNodeData, NodeType } from '$lib/types';

// Debounce timers for each node
const contentTimers = new Map<string, ReturnType<typeof setTimeout>>();
const propertiesTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Debounce delay for real-time saves (ms)
const CONTENT_SAVE_DELAY = 300; // Fast for typing
const PROPERTIES_SAVE_DELAY = 100; // Faster for position/size changes

let workspacePath: string | null = null;

// Initialize the service with workspace path
export function initNodeFileService(path: string) {
  workspacePath = path;
}

// Get the node folder path
function getNodeFolderPath(nodeId: string): string {
  return `${workspacePath}/nodes/${nodeId}`;
}

// Get the data folder path for a node
function getDataFolderPath(nodeId: string): string {
  return `${getNodeFolderPath(nodeId)}/data`;
}

// Ensure node folder structure exists
async function ensureNodeFolder(nodeId: string) {
  if (!workspacePath) return;
  
  const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
  const dataPath = getDataFolderPath(nodeId);
  
  if (!(await exists(dataPath))) {
    await mkdir(dataPath, { recursive: true });
  }
}

// Extract content from node data based on node type
function extractContent(type: NodeType, data: MosaicNodeData): string {
  switch (type) {
    case 'note':
      return (data as { content?: string }).content || '';
    case 'code':
      return (data as { code?: string }).code || '';
    case 'image':
      return (data as { imageUrl?: string; imagePath?: string }).imageUrl || 
             (data as { imagePath?: string }).imagePath || '';
    case 'link':
      return (data as { url?: string }).url || '';
    case 'iframe':
      return (data as { url?: string }).url || '';
    case 'timestamp':
      // Only save customTimestamp - if not set, content is empty meaning "use live time"
      return (data as { customTimestamp?: string }).customTimestamp || '';
    case 'person':
      return (data as { name?: string }).name || '';
    case 'organization':
      return (data as { name?: string }).name || '';
    case 'domain':
      return (data as { domain?: string }).domain || '';
    case 'hash':
      return (data as { hash?: string }).hash || '';
    case 'credential':
      return (data as { username?: string }).username || '';
    case 'socialPost':
      return (data as { content?: string }).content || '';
    case 'snapshot':
      return (data as { imageUrl?: string; sourceUrl?: string }).imageUrl || 
             (data as { sourceUrl?: string }).sourceUrl || '';
    case 'group':
      return (data as { label?: string }).label || '';
    case 'map':
      return `${(data as { latitude?: number }).latitude || 0},${(data as { longitude?: number }).longitude || 0}`;
    case 'router':
      return (data as { name?: string }).name || '';
    case 'linkList':
      const links = (data as { links?: Array<{ url: string; title?: string }> }).links || [];
      return links.map(l => `${l.title || ''}|${l.url}`).join('\n');
    case 'action':
      return (data as { action?: string }).action || '';
    case 'annotation':
      return (data as { label?: string }).label || '';
    default:
      return '';
  }
}

// Extract properties from node (everything except content)
function extractProperties(node: MosaicNode): object {
  const { data, ...nodeWithoutData } = node;
  
  // Extract non-content properties from data
  const dataProps = { ...data };
  
  // Remove content-specific fields based on type
  switch (node.type) {
    case 'note':
      delete (dataProps as Record<string, unknown>).content;
      break;
    case 'code':
      delete (dataProps as Record<string, unknown>).code;
      break;
    case 'image':
      delete (dataProps as Record<string, unknown>).imageUrl;
      delete (dataProps as Record<string, unknown>).imagePath;
      break;
    case 'link':
    case 'iframe':
      delete (dataProps as Record<string, unknown>).url;
      break;
    case 'timestamp':
      delete (dataProps as Record<string, unknown>).datetime;
      delete (dataProps as Record<string, unknown>).customTimestamp;
      break;
    case 'person':
    case 'organization':
    case 'router':
      delete (dataProps as Record<string, unknown>).name;
      break;
    case 'domain':
      delete (dataProps as Record<string, unknown>).domain;
      break;
    case 'hash':
      delete (dataProps as Record<string, unknown>).hash;
      break;
    case 'credential':
      delete (dataProps as Record<string, unknown>).username;
      break;
    case 'socialPost':
      delete (dataProps as Record<string, unknown>).content;
      break;
    case 'snapshot':
      delete (dataProps as Record<string, unknown>).imageUrl;
      delete (dataProps as Record<string, unknown>).sourceUrl;
      break;
    case 'group':
      delete (dataProps as Record<string, unknown>).label;
      break;
    case 'map':
      delete (dataProps as Record<string, unknown>).latitude;
      delete (dataProps as Record<string, unknown>).longitude;
      break;
    case 'linkList':
      delete (dataProps as Record<string, unknown>).links;
      break;
    case 'action':
      delete (dataProps as Record<string, unknown>).action;
      break;
    case 'annotation':
      delete (dataProps as Record<string, unknown>).label;
      break;
  }
  
  return {
    position: node.position,
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
    parentId: node.parentId,
    extent: node.extent,
    expandParent: node.expandParent,
    data: dataProps,
  };
}

// Save node content to file (debounced)
export function saveNodeContent(node: MosaicNode) {
  if (!workspacePath) return;
  
  // Clear existing timer
  if (contentTimers.has(node.id)) {
    clearTimeout(contentTimers.get(node.id));
  }
  
  // Set new debounced timer
  contentTimers.set(node.id, setTimeout(async () => {
    try {
      await ensureNodeFolder(node.id);
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      const content = extractContent(node.type as NodeType, node.data);
      const contentPath = `${getDataFolderPath(node.id)}/content`;
      
      await writeTextFile(contentPath, content);
      contentTimers.delete(node.id);
    } catch (error) {
      console.error(`Error saving content for node ${node.id}:`, error);
    }
  }, CONTENT_SAVE_DELAY));
}

// Save node properties to file (debounced)
export function saveNodeProperties(node: MosaicNode) {
  if (!workspacePath) return;
  
  // Clear existing timer
  if (propertiesTimers.has(node.id)) {
    clearTimeout(propertiesTimers.get(node.id));
  }
  
  // Set new debounced timer
  propertiesTimers.set(node.id, setTimeout(async () => {
    try {
      await ensureNodeFolder(node.id);
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      const properties = extractProperties(node);
      const propsPath = `${getDataFolderPath(node.id)}/properties.json`;
      
      await writeTextFile(propsPath, JSON.stringify(properties, null, 2));
      propertiesTimers.delete(node.id);
    } catch (error) {
      console.error(`Error saving properties for node ${node.id}:`, error);
    }
  }, PROPERTIES_SAVE_DELAY));
}

// Save both content and properties immediately (for node creation)
export async function saveNodeImmediate(node: MosaicNode) {
  if (!workspacePath) return;
  
  try {
    await ensureNodeFolder(node.id);
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    
    // Save content
    const content = extractContent(node.type as NodeType, node.data);
    await writeTextFile(`${getDataFolderPath(node.id)}/content`, content);
    
    // Save properties
    const properties = extractProperties(node);
    await writeTextFile(`${getDataFolderPath(node.id)}/properties.json`, JSON.stringify(properties, null, 2));
  } catch (error) {
    console.error(`Error saving node ${node.id}:`, error);
  }
}

// Delete node folder
export async function deleteNodeFolder(nodeId: string) {
  if (!workspacePath) return;
  
  try {
    const { remove, exists } = await import('@tauri-apps/plugin-fs');
    const nodePath = getNodeFolderPath(nodeId);
    
    if (await exists(nodePath)) {
      await remove(nodePath, { recursive: true });
    }
    
    // Clear any pending timers
    if (contentTimers.has(nodeId)) {
      clearTimeout(contentTimers.get(nodeId));
      contentTimers.delete(nodeId);
    }
    if (propertiesTimers.has(nodeId)) {
      clearTimeout(propertiesTimers.get(nodeId));
      propertiesTimers.delete(nodeId);
    }
  } catch (error) {
    console.error(`Error deleting node folder ${nodeId}:`, error);
  }
}

// Load a single node from files
export async function loadNode(nodeId: string, type: NodeType): Promise<MosaicNode | null> {
  if (!workspacePath) return null;
  
  try {
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    
    const dataPath = getDataFolderPath(nodeId);
    const contentPath = `${dataPath}/content`;
    const propsPath = `${dataPath}/properties.json`;
    
    // Check if properties file exists
    if (!(await exists(propsPath))) {
      console.warn(`Properties file not found for node ${nodeId}`);
      return null;
    }
    
    // Load properties
    const propsContent = await readTextFile(propsPath);
    const properties = JSON.parse(propsContent);
    
    // Load content
    let content = '';
    if (await exists(contentPath)) {
      content = await readTextFile(contentPath);
    }
    
    // Reconstruct node data with content
    const data = { ...properties.data };
    applyContentToData(type, data, content);
    
    // Reconstruct node
    const node: MosaicNode = {
      id: nodeId,
      type,
      position: properties.position,
      width: properties.width,
      height: properties.height,
      zIndex: properties.zIndex,
      parentId: properties.parentId,
      extent: properties.extent,
      expandParent: properties.expandParent,
      data: data as MosaicNodeData,
    };
    
    return node;
  } catch (error) {
    console.error(`Error loading node ${nodeId}:`, error);
    return null;
  }
}

// Apply content string back to node data based on type
function applyContentToData(type: NodeType, data: Record<string, unknown>, content: string) {
  switch (type) {
    case 'note':
      data.content = content;
      // Always start in view mode on load to show content, not editor placeholder
      data.viewMode = 'view';
      break;
    case 'code':
      data.code = content;
      break;
    case 'image':
      if (content.startsWith('asset://') || content.startsWith('http')) {
        data.imageUrl = content;
      } else if (content) {
        data.imagePath = content;
      }
      break;
    case 'link':
    case 'iframe':
      data.url = content;
      break;
    case 'timestamp':
      // If content exists, it means user set a custom timestamp - restore to customTimestamp
      // This ensures the node doesn't reset to live/realtime mode on reload
      if (content) {
        data.customTimestamp = content;
        data.datetime = content;
      }
      break;
    case 'person':
    case 'organization':
    case 'router':
      data.name = content;
      break;
    case 'domain':
      data.domain = content;
      break;
    case 'hash':
      data.hash = content;
      break;
    case 'credential':
      data.username = content;
      break;
    case 'socialPost':
      data.content = content;
      break;
    case 'snapshot':
      if (content.startsWith('asset://') || content.startsWith('http')) {
        data.imageUrl = content;
      } else if (content) {
        data.sourceUrl = content;
      }
      break;
    case 'group':
      data.label = content;
      break;
    case 'map':
      const [lat, lon] = content.split(',').map(Number);
      data.latitude = lat || 0;
      data.longitude = lon || 0;
      break;
    case 'linkList':
      if (content) {
        data.links = content.split('\n').filter(Boolean).map(line => {
          const [title, url] = line.split('|');
          return { title: title || '', url: url || '' };
        });
      } else {
        data.links = [];
      }
      break;
    case 'action':
      data.action = content;
      break;
    case 'annotation':
      data.label = content;
      break;
  }
}

// Load all nodes from the nodes folder
export async function loadAllNodes(nodesManifest: Record<string, { type: NodeType }>): Promise<MosaicNode[]> {
  if (!workspacePath) return [];
  
  const nodes: MosaicNode[] = [];
  
  for (const [nodeId, { type }] of Object.entries(nodesManifest)) {
    const node = await loadNode(nodeId, type);
    if (node) {
      nodes.push(node);
    }
  }
  
  return nodes;
}

// Flush all pending saves (call before closing)
export async function flushPendingSaves() {
  // Wait for all pending content saves
  for (const [nodeId, timer] of contentTimers) {
    clearTimeout(timer);
    contentTimers.delete(nodeId);
  }
  
  // Wait for all pending property saves
  for (const [nodeId, timer] of propertiesTimers) {
    clearTimeout(timer);
    propertiesTimers.delete(nodeId);
  }
}

// Reset the service (when changing workspace)
export function resetNodeFileService() {
  flushPendingSaves();
  workspacePath = null;
}
