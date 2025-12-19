// MosaicFlow Workspace Store
// Manages the workspace state including nodes, edges, and settings

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

// Reactive state using Svelte 5 runes
class WorkspaceStore {
  // Core data
  nodes = $state.raw<MosaicNode[]>([]);
  edges = $state.raw<MosaicEdge[]>([]);
  
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

  // Undo/Redo stacks (future feature)
  private undoStack: Array<{ nodes: MosaicNode[]; edges: MosaicEdge[] }> = [];
  private redoStack: Array<{ nodes: MosaicNode[]; edges: MosaicEdge[] }> = [];

  // Create a new node
  createNode(type: NodeType, position: { x: number; y: number }, data?: Partial<MosaicNodeData>): MosaicNode {
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
    this.markModified();
    return node;
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
    this.nodes = this.nodes.map(node => 
      node.id === id ? { ...node, ...updates } : node
    );
    this.markModified();
  }

  // Update node data
  updateNodeData(id: string, dataUpdates: Partial<MosaicNodeData>) {
    this.nodes = this.nodes.map(node => 
      node.id === id 
        ? { ...node, data: { ...node.data, ...dataUpdates } as MosaicNodeData } 
        : node
    );
    this.markModified();
  }

  // Delete a node
  deleteNode(id: string) {
    this.nodes = this.nodes.filter(node => node.id !== id);
    // Also remove connected edges
    this.edges = this.edges.filter(edge => edge.source !== id && edge.target !== id);
    this.markModified();
  }

  // Delete multiple nodes
  deleteNodes(ids: string[]) {
    this.nodes = this.nodes.filter(node => !ids.includes(node.id));
    this.edges = this.edges.filter(edge => !ids.includes(edge.source) && !ids.includes(edge.target));
    this.markModified();
  }

  // Create an edge
  createEdge(source: string, target: string, label?: string, sourceHandle?: string | null, targetHandle?: string | null): MosaicEdge {
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
      },
    };
    
    this.edges = [...this.edges, edge];
    this.markModified();
    return edge;
  }

  // Update an edge
  updateEdge(id: string, updates: Partial<MosaicEdge>) {
    this.edges = this.edges.map(edge => 
      edge.id === id ? { ...edge, ...updates } : edge
    );
    this.markModified();
  }

  // Delete an edge
  deleteEdge(id: string) {
    this.edges = this.edges.filter(edge => edge.id !== id);
    this.markModified();
  }

  // Set canvas mode
  setCanvasMode(mode: CanvasMode) {
    this.canvasMode = mode;
  }

  // Group selected nodes
  groupSelectedNodes(): MosaicNode | null {
    if (this.selectedNodeIds.length < 2) return null;

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
    this.nodes = this.nodes.map(node => {
      if (this.selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          parentId: groupNode.id,
          position: {
            x: node.position.x - minX,
            y: node.position.y - minY,
          },
          expandParent: true,
          extent: 'parent', // Default to contained within parent
        };
      }
      if (node.id === groupNode.id) {
        return { ...node, width: maxX - minX, height: maxY - minY };
      }
      return node;
    });

    // Clear selection and select the group
    this.setSelectedNodes([groupNode.id]);
    return groupNode;
  }

  // Ungroup a group node
  ungroupNode(groupId: string) {
    const groupNode = this.nodes.find(n => n.id === groupId && n.type === 'group');
    if (!groupNode) return;

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
    this.nodes = this.nodes.map(node => {
      if (node.id === nodeId && node.parentId) {
        return {
          ...node,
          extent: contained ? 'parent' : undefined,
        };
      }
      return node;
    });
    this.markModified();
  }

  // Get child nodes of a group
  getChildNodes(groupId: string): MosaicNode[] {
    return this.nodes.filter(n => n.parentId === groupId);
  }

  // Viewport management
  setViewport(viewport: Viewport) {
    this.viewport = viewport;
  }

  // Set all nodes
  setNodes(nodes: MosaicNode[]) {
    this.nodes = nodes.map(node => ({
      ...node,
      zIndex: node.type === 'group' ? -1 : 1
    }));
    this.markModified();
  }

  // Set all edges
  setEdges(edges: MosaicEdge[]) {
    this.edges = edges;
    this.markModified();
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
    this.isModified = false;
  }

  // Load workspace from data
  loadFromData(data: WorkspaceData) {
    this.name = data.metadata.name;
    this.description = data.metadata.description;
    this.createdAt = data.metadata.createdAt;
    this.updatedAt = data.metadata.updatedAt;
    this.viewport = data.metadata.viewport;
    this.settings = { ...this.settings, ...data.metadata.settings };
    
    // Convert nodes and edges from Record to array
    this.nodes = Object.values(data.nodes).map(node => ({
      ...node,
      zIndex: node.type === 'group' ? -1 : 1
    }));
    this.edges = Object.values(data.edges);
    
    this.isModified = false;
  }

  // Load UI state
  loadUIState(state: UIState) {
    this.viewport = state.viewport;
    this.selectedNodeIds = state.selectedNodeIds;
    this.selectedEdgeIds = state.selectedEdgeIds;
    
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

  // Export to WorkspaceData format
  toWorkspaceData(): WorkspaceData {
    const nodesRecord: Record<string, MosaicNode> = {};
    const edgesRecord: Record<string, MosaicEdge> = {};
    
    this.nodes.forEach(node => {
      nodesRecord[node.id] = node;
    });
    
    this.edges.forEach(edge => {
      edgesRecord[edge.id] = edge;
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
