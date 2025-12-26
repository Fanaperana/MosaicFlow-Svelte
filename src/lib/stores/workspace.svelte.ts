// MosaicFlow Workspace Store
// Manages the workspace state including nodes, edges, and settings
// Uses real-time file operations for persistence (no save button needed)

import { type Node, type Edge } from '@xyflow/svelte';
import { v4 as uuidv4 } from 'uuid';
import type {
  MosaicNode,
  MosaicEdge,
  WorkspaceSettings,
  WorkspaceMetadata,
  WorkspaceData,
  UIState,
  Viewport,
  NodeType,
  MosaicNodeData,
  CanvasMode,
} from '$lib/types';
import { DEFAULT_SETTINGS, DEFAULT_VIEWPORT } from '$lib/types';
import {
  initNodeFileService,
  saveNodeContent,
  saveNodeProperties,
  saveNodeImmediate,
  deleteNodeFolder,
  resetNodeFileService,
} from '$lib/services/nodeFileService';
import {
  initEdgeFileService,
  saveEdge,
  saveEdgeImmediate,
  deleteEdgeFolder,
  resetEdgeFileService,
} from '$lib/services/edgeFileService';

// Reactive state using Svelte 5 runes
class WorkspaceStore {
  // Core data
  nodes = $state.raw<MosaicNode[]>([]);
  edges = $state.raw<MosaicEdge[]>([]);
  
  // Version counter to force reactivity for edge updates (markers, etc.)
  edgeVersion = $state(0);
  
  // Metadata
  name = $state('Untitled Workspace');
  description = $state('');
  createdAt = $state(new Date().toISOString());
  updatedAt = $state(new Date().toISOString());
  
  // Viewport
  viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
  
  // Settings
  settings = $state<WorkspaceSettings>({
    autoSave: true,
    autoSaveInterval: 1000,
    theme: 'dark',
    gridSize: 20,
    snapToGrid: false,
    showMinimap: true,
    defaultNodeColor: '#1e1e1e',
    defaultEdgeColor: '#555555',
  });
  
  // UI State
  selectedNodeIds = $state<string[]>([]);
  selectedEdgeIds = $state<string[]>([]);
  isModified = $state(false);
  workspacePath = $state<string | null>(null);
  
  // Properties panel state
  propertiesPanelOpen = $state(false);
  selectedNodeForProperties = $state<MosaicNode | null>(null);
  
  // Canvas mode (select or drag)
  canvasMode = $state<CanvasMode>('select');

  // Undo/Redo stacks
  private undoStack: Array<{ nodes: MosaicNode[]; edges: MosaicEdge[] }> = [];
  private redoStack: Array<{ nodes: MosaicNode[]; edges: MosaicEdge[] }> = [];
  private maxHistorySize = 50; // Limit history size to prevent memory issues
  private isUndoRedoOperation = false; // Flag to prevent saving history during undo/redo
  
  // Reactive state for UI to track if undo/redo is available
  canUndo = $state(false);
  canRedo = $state(false);

  /**
   * Save current state to undo stack
   */
  saveToHistory() {
    if (this.isUndoRedoOperation) return;
    
    // Deep clone current state
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges)),
    };
    
    this.undoStack.push(snapshot);
    
    // Limit stack size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    this.redoStack = [];
    
    // Update reactive state
    this.canUndo = this.undoStack.length > 0;
    this.canRedo = false;
  }

  /**
   * Undo the last action
   */
  undo() {
    if (this.undoStack.length === 0) return;
    
    this.isUndoRedoOperation = true;
    
    // Save current state to redo stack
    const currentState = {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges)),
    };
    this.redoStack.push(currentState);
    
    // Restore previous state
    const previousState = this.undoStack.pop()!;
    this.nodes = previousState.nodes;
    this.edges = previousState.edges;
    
    // Update reactive state
    this.canUndo = this.undoStack.length > 0;
    this.canRedo = this.redoStack.length > 0;
    
    this.isUndoRedoOperation = false;
    
    // Save the restored state to files
    if (this.workspacePath) {
      this.saveWorkspaceManifest();
    }
  }

  /**
   * Redo the last undone action
   */
  redo() {
    if (this.redoStack.length === 0) return;
    
    this.isUndoRedoOperation = true;
    
    // Save current state to undo stack
    const currentState = {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges)),
    };
    this.undoStack.push(currentState);
    
    // Restore next state
    const nextState = this.redoStack.pop()!;
    this.nodes = nextState.nodes;
    this.edges = nextState.edges;
    
    // Update reactive state
    this.canUndo = this.undoStack.length > 0;
    this.canRedo = this.redoStack.length > 0;
    
    this.isUndoRedoOperation = false;
    
    // Save the restored state to files
    if (this.workspacePath) {
      this.saveWorkspaceManifest();
    }
  }

  /**
   * Clear history (e.g., when loading a new canvas)
   */
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.canUndo = false;
    this.canRedo = false;
  }

  /**
   * Reorder nodes so that parent nodes come before their children.
   * This is required for SvelteFlow subflows to work correctly.
   */
  private reorderNodesForSubflows(nodes: MosaicNode[]): MosaicNode[] {
    // Separate parent nodes (groups) and other nodes
    const parentNodes = nodes.filter(n => n.type === 'group');
    const childNodes = nodes.filter(n => n.parentId);
    const regularNodes = nodes.filter(n => n.type !== 'group' && !n.parentId);
    
    // Order: parent nodes first, then regular nodes, then child nodes
    // Child nodes should come after their parent
    const orderedNodes: MosaicNode[] = [];
    
    // Add parent nodes first
    for (const parent of parentNodes) {
      orderedNodes.push(parent);
      // Add children of this parent immediately after
      const children = childNodes.filter(n => n.parentId === parent.id);
      orderedNodes.push(...children);
    }
    
    // Add orphaned child nodes (parent was deleted but child still has parentId)
    const orphanedChildren = childNodes.filter(n => !parentNodes.some(p => p.id === n.parentId));
    orderedNodes.push(...orphanedChildren);
    
    // Add regular nodes
    orderedNodes.push(...regularNodes);
    
    return orderedNodes;
  }

  // Create a new node
  createNode(type: NodeType, position: { x: number; y: number }, data?: Partial<MosaicNodeData>): MosaicNode {
    // Save state before mutation
    this.saveToHistory();
    
    const id = uuidv4();
    const baseData = this.getDefaultDataForType(type);
    
    const node: MosaicNode = {
      id,
      type,
      position,
      data: { ...baseData, ...data } as MosaicNodeData,
      width: this.getDefaultWidthForType(type),
      height: this.getDefaultHeightForType(type),
      zIndex: type === 'group' ? -1 : 1,
    };
    
    this.nodes = [...this.nodes, node];
    
    // Save node to files immediately
    if (this.workspacePath) {
      saveNodeImmediate(node);
      this.saveWorkspaceManifest();
    }
    
    return node;
  }

  // Duplicate nodes (creates new nodes with same data, offset position)
  // This is a batch operation that saves history only once
  duplicateNodes(nodeIds: string[]): MosaicNode[] {
    if (nodeIds.length === 0) return [];
    
    // Save state before mutation (only once for all duplicates)
    this.saveToHistory();
    
    const nodesToDuplicate = this.nodes.filter(n => nodeIds.includes(n.id));
    const newNodes: MosaicNode[] = [];
    
    for (const node of nodesToDuplicate) {
      const id = uuidv4();
      const newPosition = {
        x: node.position.x + 50,
        y: node.position.y + 50,
      };
      
      const newNode: MosaicNode = {
        id,
        type: node.type,
        position: newPosition,
        data: JSON.parse(JSON.stringify(node.data)), // Deep clone data
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      };
      
      newNodes.push(newNode);
    }
    
    // Add all new nodes at once
    this.nodes = [...this.nodes, ...newNodes];
    
    // Save nodes to files
    if (this.workspacePath) {
      newNodes.forEach(node => saveNodeImmediate(node));
      this.saveWorkspaceManifest();
    }
    
    return newNodes;
  }

  // Get default data for a node type
  private getDefaultDataForType(type: NodeType): MosaicNodeData {
    const baseData = {
      title: this.getDefaultTitleForType(type),
      color: this.settings.defaultNodeColor,
    };

    switch (type) {
      case 'note':
        return { ...baseData, content: '', isEditing: true };
      case 'image':
        return { ...baseData, caption: '' };
      case 'link':
        return { ...baseData, url: '', description: '' };
      case 'code':
        return { ...baseData, code: '', language: 'javascript' };
      case 'timestamp':
        return { ...baseData, datetime: new Date().toISOString(), format: 'datetime' };
      case 'person':
        return { ...baseData, name: '', aliases: [] };
      case 'organization':
        return { ...baseData, name: '' };
      case 'domain':
        return { ...baseData, domain: '' };
      case 'hash':
        return { ...baseData, hash: '', algorithm: 'sha256', threatLevel: 'unknown' };
      case 'credential':
        return { ...baseData, breached: false };
      case 'socialPost':
        return { ...baseData, platform: '', content: '' };
      case 'group':
        return { ...baseData, label: 'Group', childNodeIds: [] };
      case 'map':
        return { ...baseData, latitude: 0, longitude: 0, zoom: 10 };
      case 'router':
        return { ...baseData, name: '' };
      case 'linkList':
        return { ...baseData, links: [] };
      case 'snapshot':
        return { ...baseData, url: '' };
      case 'action':
        return { ...baseData, action: '', status: 'pending', priority: 'medium' };
      case 'iframe':
        return { ...baseData, url: '' };
      case 'annotation':
        return { ...baseData, label: 'Annotation', arrow: '⤹', fontSize: 24, fontWeight: 'normal' };
      default:
        return baseData as MosaicNodeData;
    }
  }

  private getDefaultTitleForType(type: NodeType): string {
    const titles: Record<NodeType, string> = {
      note: 'New Note',
      image: 'Image',
      link: 'Link',
      code: 'Code Snippet',
      timestamp: 'Timestamp',
      person: 'Person',
      organization: 'Organization',
      domain: 'Domain',
      hash: 'Hash',
      credential: 'Credential',
      socialPost: 'Social Post',
      group: 'Group',
      map: 'Location',
      router: 'Router',
      linkList: 'Link List',
      snapshot: 'Snapshot',
      action: 'Action',
      iframe: 'Embed',
      annotation: 'Annotation',
    };
    return titles[type] || 'Node';
  }

  private getDefaultWidthForType(type: NodeType): number {
    const widths: Partial<Record<NodeType, number>> = {
      note: 300,
      image: 250,
      code: 400,
      group: 400,
      linkList: 300,
      socialPost: 350,
      timestamp: 160,
      iframe: 400,
      annotation: 200,
    };
    return widths[type] || 250;
  }

  private getDefaultHeightForType(type: NodeType): number {
    const heights: Partial<Record<NodeType, number>> = {
      note: 200,
      image: 200,
      code: 250,
      group: 300,
      linkList: 200,
      timestamp: 36,
      iframe: 300,
      annotation: 100,
    };
    return heights[type] || 150;
  }

  // Update a node
  updateNode(id: string, updates: Partial<MosaicNode>) {
    let updatedNode: MosaicNode | null = null;
    const parentIdChanged = updates.parentId !== undefined;
    
    this.nodes = this.nodes.map(node => {
      if (node.id === id) {
        updatedNode = { ...node, ...updates };
        return updatedNode;
      }
      return node;
    });
    
    // If parentId changed, reorder nodes to maintain proper subflow ordering
    if (parentIdChanged) {
      this.nodes = this.reorderNodesForSubflows(this.nodes);
    }
    
    // Save node properties to file (debounced)
    if (this.workspacePath && updatedNode) {
      saveNodeProperties(updatedNode);
    }
  }

  // Update node data
  updateNodeData(id: string, dataUpdates: Partial<MosaicNodeData>) {
    let updatedNode: MosaicNode | null = null;
    this.nodes = this.nodes.map(node => {
      if (node.id === id) {
        updatedNode = { ...node, data: { ...node.data, ...dataUpdates } as MosaicNodeData };
        return updatedNode;
      }
      return node;
    });
    
    // Save to files (debounced) - content for text changes, properties for other data
    if (this.workspacePath && updatedNode) {
      saveNodeContent(updatedNode);
      saveNodeProperties(updatedNode);
    }
  }

  // Delete a node
  deleteNode(id: string) {
    // Save state before mutation
    this.saveToHistory();
    
    // Get edges to delete
    const edgesToDelete = this.edges.filter(edge => edge.source === id || edge.target === id);
    
    this.nodes = this.nodes.filter(node => node.id !== id);
    this.edges = this.edges.filter(edge => edge.source !== id && edge.target !== id);
    
    // Delete node and edge files
    if (this.workspacePath) {
      deleteNodeFolder(id);
      edgesToDelete.forEach(edge => deleteEdgeFolder(edge.id));
      this.saveWorkspaceManifest();
    }
  }

  // Delete multiple nodes
  deleteNodes(ids: string[]) {
    // Save state before mutation
    this.saveToHistory();
    
    // Get edges to delete
    const edgesToDelete = this.edges.filter(edge => ids.includes(edge.source) || ids.includes(edge.target));
    
    this.nodes = this.nodes.filter(node => !ids.includes(node.id));
    this.edges = this.edges.filter(edge => !ids.includes(edge.source) && !ids.includes(edge.target));
    
    // Delete node and edge files
    if (this.workspacePath) {
      ids.forEach(id => deleteNodeFolder(id));
      edgesToDelete.forEach(edge => deleteEdgeFolder(edge.id));
      this.saveWorkspaceManifest();
    }
  }

  // Create an edge
  createEdge(source: string, target: string, label?: string, sourceHandle?: string | null, targetHandle?: string | null): MosaicEdge {
    // Save state before mutation
    this.saveToHistory();
    
    const id = uuidv4();
    const edge: MosaicEdge = {
      id,
      source,
      target,
      sourceHandle: sourceHandle ?? undefined,
      targetHandle: targetHandle ?? undefined,
      label,
      type: 'default',
      animated: false,
      style: `stroke: ${this.settings.defaultEdgeColor}; stroke-width: 2px;`,
      data: {
        color: this.settings.defaultEdgeColor,
        strokeWidth: 2,
        animated: false,
      },
    };
    
    this.edges = [...this.edges, edge];
    
    // Save edge to file immediately
    if (this.workspacePath) {
      saveEdgeImmediate(edge);
    }
    
    return edge;
  }

  // Update an edge
  updateEdge(id: string, updates: Partial<MosaicEdge>) {
    let updatedEdge: MosaicEdge | null = null;
    this.edges = this.edges.map(edge => {
      if (edge.id === id) {
        // Merge the edge with updates
        const merged = { ...edge, ...updates };
        
        // Sync animated flag to data for custom edge component access
        if (updates.animated !== undefined) {
          merged.data = { ...merged.data, animated: updates.animated };
        }
        
        // If data was updated, also update the derived style properties
        if (updates.data) {
          const data = merged.data || {};
          
          // Build edge stroke style
          const styleParts: string[] = [];
          if (data.color) styleParts.push(`stroke: ${data.color}`);
          if (data.strokeWidth) styleParts.push(`stroke-width: ${data.strokeWidth}px`);
          if (data.strokeStyle === 'dashed') styleParts.push('stroke-dasharray: 8 4');
          else if (data.strokeStyle === 'dotted') styleParts.push('stroke-dasharray: 2 2');
          if (styleParts.length > 0) merged.style = styleParts.join('; ') + ';';
          
          // Build label style
          const labelParts: string[] = [];
          if (data.labelColor) labelParts.push(`color: ${data.labelColor}`);
          if (data.labelFontSize) labelParts.push(`font-size: ${data.labelFontSize}px`);
          if (labelParts.length > 0) merged.labelStyle = labelParts.join('; ') + ';';
          
          // Build label background style
          if (data.labelBgColor) merged.labelBgStyle = `fill: ${data.labelBgColor};`;
        }
        
        updatedEdge = merged;
        return updatedEdge;
      }
      return edge;
    });
    
    // Save edge to file (debounced)
    if (this.workspacePath && updatedEdge) {
      saveEdge(updatedEdge);
    }
  }

  // Update an edge and force array refresh for SvelteFlow reactivity
  // Use this for visual properties like markers that need immediate re-render
  updateEdgeWithRefresh(id: string, updates: Partial<MosaicEdge>) {
    const edgeIndex = this.edges.findIndex(e => e.id === id);
    if (edgeIndex === -1) return;
    
    const edgeToUpdate = this.edges[edgeIndex];
    
    // Create a completely new edge object
    const updatedEdge: MosaicEdge = { 
      ...edgeToUpdate, 
      ...updates,
      data: {
        ...edgeToUpdate.data,
        ...updates.data,
      }
    };
    
    // Create new array with all new edge object references
    // This ensures SvelteFlow detects the change
    this.edges = this.edges.map((edge, index) => {
      if (index === edgeIndex) {
        return updatedEdge;
      }
      // Create new reference for each edge
      return { ...edge };
    });
    
    // Increment version to force Canvas to re-render edges
    this.edgeVersion++;
    
    // Save edge to file (debounced)
    if (this.workspacePath) {
      saveEdge(updatedEdge);
    }
  }

  // Delete an edge
  deleteEdge(id: string) {
    // Save state before mutation
    this.saveToHistory();
    
    this.edges = this.edges.filter(edge => edge.id !== id);
    
    // Delete edge file
    if (this.workspacePath) {
      deleteEdgeFolder(id);
    }
  }

  // Set canvas mode
  setCanvasMode(mode: CanvasMode) {
    this.canvasMode = mode;
  }

  // Group selected nodes
  groupSelectedNodes(): MosaicNode | null {
    if (this.selectedNodeIds.length < 2) return null;

    // Save state before mutation
    this.saveToHistory();

    // Get the selected nodes
    const selectedNodes = this.nodes.filter(n => this.selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 2) return null;

    // Calculate bounding box of selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selectedNodes) {
      const w = node.width || 200;
      const h = node.height || 100;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }

    // Add padding
    const padding = 40;
    minX -= padding;
    minY -= padding + 30; // Extra for header
    maxX += padding;
    maxY += padding;

    // Create group node
    const groupNode = this.createNode('group', { x: minX, y: minY }, {
      label: 'Group',
      childNodeIds: this.selectedNodeIds.slice(),
    });

    // Update group node size
    groupNode.width = maxX - minX;
    groupNode.height = maxY - minY;
    
    // Update nodes to be children of group (set parentId)
    let updatedNodes = this.nodes.map(node => {
      if (this.selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          parentId: groupNode.id,
          position: {
            x: node.position.x - minX,
            y: node.position.y - minY,
          },
          expandParent: true,
          extent: 'parent' as const, // Constrain within parent bounds
        };
      }
      if (node.id === groupNode.id) {
        return { ...node, width: maxX - minX, height: maxY - minY };
      }
      return node;
    });
    
    // Reorder nodes so parent comes before children (required for SvelteFlow subflows)
    this.nodes = this.reorderNodesForSubflows(updatedNodes);

    // Clear selection and select the group
    this.setSelectedNodes([groupNode.id]);
    return groupNode;
  }

  // Ungroup a group node
  ungroupNode(groupId: string) {
    const groupNode = this.nodes.find(n => n.id === groupId && n.type === 'group');
    if (!groupNode) return;

    // Save state before mutation
    this.saveToHistory();

    // Get child nodes
    const childNodes = this.nodes.filter(n => n.parentId === groupId);
    const childIds = childNodes.map(n => n.id);

    // Update child nodes to remove parent and restore absolute positions
    this.nodes = this.nodes.map(node => {
      if (node.parentId === groupId) {
        return {
          ...node,
          parentId: undefined,
          position: {
            x: node.position.x + groupNode.position.x,
            y: node.position.y + groupNode.position.y,
          },
          expandParent: undefined,
          extent: undefined, // Remove containment
        };
      }
      return node;
    });

    // Remove the group node
    this.deleteNode(groupId);

    // Select the ungrouped nodes
    this.setSelectedNodes(childIds);
  }

  // Selection management
  setSelectedNodes(ids: string[]) {
    this.selectedNodeIds = ids;
    if (ids.length === 1) {
      const node = this.nodes.find(n => n.id === ids[0]);
      if (node) {
        this.selectedNodeForProperties = node;
        this.propertiesPanelOpen = true;
      }
    } else {
      this.selectedNodeForProperties = null;
      if (ids.length === 0) {
        this.propertiesPanelOpen = false;
      }
    }
  }

  setSelectedEdges(ids: string[]) {
    this.selectedEdgeIds = ids;
  }

  // Toggle properties panel
  togglePropertiesPanel() {
    this.propertiesPanelOpen = !this.propertiesPanelOpen;
  }

  // Update a node's extent (containment within parent)
  setNodeContained(nodeId: string, contained: boolean) {
    let updatedNode: MosaicNode | null = null;
    this.nodes = this.nodes.map(node => {
      if (node.id === nodeId && node.parentId) {
        updatedNode = {
          ...node,
          extent: contained ? 'parent' : undefined,
        };
        return updatedNode;
      }
      return node;
    });
    
    // Save to file
    if (this.workspacePath && updatedNode) {
      saveNodeProperties(updatedNode);
    }
  }

  // Get child nodes of a group
  getChildNodes(groupId: string): MosaicNode[] {
    return this.nodes.filter(n => n.parentId === groupId);
  }

  // Viewport management
  setViewport(viewport: Viewport) {
    this.viewport = viewport;
  }

  // Fit view to show all nodes
  fitView(padding: number = 50) {
    if (this.nodes.length === 0) {
      // No nodes, reset to default
      this.viewport = { x: 0, y: 0, zoom: 1 };
      return;
    }

    // Calculate bounds of all nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of this.nodes) {
      const width = node.width || 200;
      const height = node.height || 100;
      
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    }

    // Add padding
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Calculate the bounds dimensions
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;

    // Get canvas dimensions (approximate, since we don't have direct access)
    // Using a reasonable default canvas size
    const canvasWidth = window.innerWidth - 200; // Approximate canvas width
    const canvasHeight = window.innerHeight - 100; // Approximate canvas height

    // Calculate zoom to fit
    const zoomX = canvasWidth / boundsWidth;
    const zoomY = canvasHeight / boundsHeight;
    const zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in more than 1

    // Calculate center position
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate viewport position to center the nodes
    const x = (canvasWidth / 2) - (centerX * zoom);
    const y = (canvasHeight / 2) - (centerY * zoom);

    this.viewport = { x, y, zoom: Math.max(zoom, 0.1) };
  }

  // Set all nodes (for bulk operations like loading)
  setNodes(nodes: MosaicNode[]) {
    // Track nodes that were removed
    const removedIds = this.nodes
      .filter(n => !nodes.find(newN => newN.id === n.id))
      .map(n => n.id);
    
    const processedNodes = nodes.map(node => ({
      ...node,
      zIndex: node.type === 'group' ? -1 : 1
    }));
    
    // Reorder nodes so parent nodes come before children (required for SvelteFlow subflows)
    this.nodes = this.reorderNodesForSubflows(processedNodes);
    
    // Save changes to files if we have a workspace path
    if (this.workspacePath) {
      // Delete removed nodes
      removedIds.forEach(id => deleteNodeFolder(id));
      // Save all nodes (they will be debounced)
      this.nodes.forEach(node => {
        saveNodeProperties(node);
        saveNodeContent(node);
      });
      this.saveWorkspaceManifest();
    }
  }

  // Set all edges (for bulk operations like loading)
  setEdges(edges: MosaicEdge[]) {
    // Track edges that were removed
    const removedIds = this.edges
      .filter(e => !edges.find(newE => newE.id === e.id))
      .map(e => e.id);
    
    this.edges = edges;
    
    // Save changes to files if we have a workspace path
    if (this.workspacePath) {
      // Delete removed edges
      removedIds.forEach(id => deleteEdgeFolder(id));
      // Save all edges (they will be debounced)
      this.edges.forEach(edge => saveEdge(edge));
    }
  }

  // Mark workspace as modified
  private markModified() {
    this.isModified = true;
    this.updatedAt = new Date().toISOString();
  }

  // Mark workspace as saved
  markSaved() {
    this.isModified = false;
  }

  // Clear workspace
  clear() {
    // Reset file services
    resetNodeFileService();
    resetEdgeFileService();
    
    this.nodes = [];
    this.edges = [];
    this.selectedNodeIds = [];
    this.selectedEdgeIds = [];
    this.name = 'Untitled Workspace';
    this.description = '';
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.viewport = { x: 0, y: 0, zoom: 1 };
    this.workspacePath = null;
    
    // Clear history when loading new workspace
    this.clearHistory();
  }

  // Initialize file services when workspace path is set
  initFileServices(path: string) {
    this.workspacePath = path;
    initNodeFileService(path);
    initEdgeFileService(path);
  }

  // Save workspace manifest (minimal workspace.json with just node/edge IDs and types)
  async saveWorkspaceManifest() {
    if (!this.workspacePath) return;
    
    try {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      // Create minimal node manifest (just id and type)
      const nodesManifest: Record<string, { id: string; type: string }> = {};
      this.nodes.forEach(node => {
        nodesManifest[node.id] = {
          id: node.id,
          type: node.type as string,
        };
      });
      
      // Create edge manifest (just IDs, full data is in edge folders)
      const edgesManifest: Record<string, { id: string }> = {};
      this.edges.forEach(edge => {
        edgesManifest[edge.id] = { id: edge.id };
      });
      
      const manifest = {
        metadata: {
          name: this.name,
          description: this.description,
          createdAt: this.createdAt,
          updatedAt: new Date().toISOString(),
          version: '2.0.0', // New version for real-time format
          viewport: this.viewport,
          settings: this.settings,
        },
        nodes: nodesManifest,
        edges: edgesManifest,
      };
      
      await writeTextFile(
        `${this.workspacePath}/workspace.json`,
        JSON.stringify(manifest, null, 2)
      );
    } catch (error) {
      console.error('Error saving workspace manifest:', error);
    }
  }

  // Load workspace from data
  loadFromData(data: WorkspaceData) {
    // Handle both v1 (no metadata) and v2 (with metadata) formats
    if (data.metadata) {
      this.name = data.metadata.name;
      this.description = data.metadata.description;
      this.createdAt = data.metadata.createdAt;
      this.updatedAt = data.metadata.updatedAt;
      this.viewport = data.metadata.viewport;
      this.settings = { ...this.settings, ...data.metadata.settings };
    } else {
      // V1 format - use defaults or existing values
      this.name = this.name || 'Untitled';
      this.description = this.description || '';
      this.createdAt = this.createdAt || new Date().toISOString();
      this.updatedAt = new Date().toISOString();
    }
    
    // Convert nodes and edges from Record to array
    const loadedNodes = Object.values(data.nodes || {}).map(node => ({
      ...node,
      zIndex: node.type === 'group' ? -1 : 1
    })) as MosaicNode[];
    
    // Reorder nodes so parent nodes come before children (required for SvelteFlow subflows)
    this.nodes = this.reorderNodesForSubflows(loadedNodes);
    this.edges = Object.values(data.edges || []);
    
    this.isModified = false;
  }

  // Load UI state
  loadUIState(state: UIState) {
    this.viewport = state.viewport ?? DEFAULT_VIEWPORT;
    this.selectedNodeIds = state.selectedNodeIds ?? [];
    this.selectedEdgeIds = state.selectedEdgeIds ?? [];
    
    // Update node positions from state
    this.nodes = this.nodes.map(node => {
      const stateNode = state.nodes[node.id];
      if (stateNode) {
        return {
          ...node,
          position: stateNode.position,
          width: stateNode.width ?? node.width,
          height: stateNode.height ?? node.height,
        };
      }
      return node;
    });
  }

  // Export to WorkspaceData format (minimal - for manifest only)
  toWorkspaceData(): WorkspaceData {
    const nodesRecord: Record<string, MosaicNode> = {};
    const edgesRecord: Record<string, MosaicEdge> = {};
    
    // For v2 format, we only store id and type in the manifest
    // Full node data is stored in individual node folders
    this.nodes.forEach(node => {
      nodesRecord[node.id] = {
        id: node.id,
        type: node.type,
      } as MosaicNode;
    });
    
    this.edges.forEach(edge => {
      edgesRecord[edge.id] = {
        id: edge.id,
      } as MosaicEdge;
    });
    
    return {
      metadata: {
        name: this.name,
        description: this.description,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        version: '1.0.0',
        viewport: this.viewport,
        settings: this.settings,
      },
      nodes: nodesRecord,
      edges: edgesRecord,
    };
  }

  // Export to UIState format
  toUIState(): UIState {
    const nodesState: UIState['nodes'] = {};
    
    this.nodes.forEach(node => {
      nodesState[node.id] = {
        position: node.position,
        width: node.width,
        height: node.height,
      };
    });
    
    return {
      version: '1.0.0',
      lastSaved: new Date().toISOString(),
      viewport: this.viewport,
      nodes: nodesState,
      selectedNodeIds: this.selectedNodeIds,
      selectedEdgeIds: this.selectedEdgeIds,
    };
  }

  // Get node by ID
  getNode(id: string): MosaicNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  // Get edge by ID
  getEdge(id: string): MosaicEdge | undefined {
    return this.edges.find(e => e.id === id);
  }
}

// Create singleton instance
export const workspace = new WorkspaceStore();
