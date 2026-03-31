// MosaicFlow Type Definitions

import type { Node, Edge } from '@xyflow/svelte';

// Node Types - open to allow plugin-defined types
export type NodeType = string;

// Re-export base and node-specific data types from packages
export type { BaseNodeData } from '@mosaicflow/node-sdk/types';
export type { NoteNodeData } from '@mosaicflow/node-note/types';
export type { SimpleTextNodeData } from '@mosaicflow/node-simple-text/types';
export type { ImageNodeData } from '@mosaicflow/node-image/types';
export type { LinkNodeData } from '@mosaicflow/node-link/types';
export type { CodeNodeData } from '@mosaicflow/node-code/types';
export type { IframeNodeData } from '@mosaicflow/node-iframe/types';
export type { PersonNodeData } from '@mosaicflow/node-person/types';
export type { OrganizationNodeData } from '@mosaicflow/node-organization/types';
export type { TimestampNodeData } from '@mosaicflow/node-timestamp/types';
export type { DomainNodeData } from '@mosaicflow/node-domain/types';
export type { HashNodeData } from '@mosaicflow/node-hash/types';
export type { CredentialNodeData } from '@mosaicflow/node-credential/types';
export type { SocialPostNodeData } from '@mosaicflow/node-social-post/types';
export type { RouterNodeData } from '@mosaicflow/node-router/types';
export type { SnapshotNodeData } from '@mosaicflow/node-snapshot/types';
export type { GroupNodeData } from '@mosaicflow/node-group/types';
export type { MapNodeData } from '@mosaicflow/node-map/types';
export type { LinkListNodeData, LinkItem } from '@mosaicflow/node-link-list/types';
export type { ActionNodeData } from '@mosaicflow/node-action/types';
export type { AnnotationNodeData } from '@mosaicflow/node-annotation/types';

// Import types for union
import type { NoteNodeData } from '@mosaicflow/node-note/types';
import type { ImageNodeData } from '@mosaicflow/node-image/types';
import type { LinkNodeData } from '@mosaicflow/node-link/types';
import type { CodeNodeData } from '@mosaicflow/node-code/types';
import type { TimestampNodeData } from '@mosaicflow/node-timestamp/types';
import type { PersonNodeData } from '@mosaicflow/node-person/types';
import type { OrganizationNodeData } from '@mosaicflow/node-organization/types';
import type { DomainNodeData } from '@mosaicflow/node-domain/types';
import type { HashNodeData } from '@mosaicflow/node-hash/types';
import type { CredentialNodeData } from '@mosaicflow/node-credential/types';
import type { SocialPostNodeData } from '@mosaicflow/node-social-post/types';
import type { GroupNodeData } from '@mosaicflow/node-group/types';
import type { MapNodeData } from '@mosaicflow/node-map/types';
import type { RouterNodeData } from '@mosaicflow/node-router/types';
import type { LinkListNodeData } from '@mosaicflow/node-link-list/types';
import type { SnapshotNodeData } from '@mosaicflow/node-snapshot/types';
import type { ActionNodeData } from '@mosaicflow/node-action/types';
import type { IframeNodeData } from '@mosaicflow/node-iframe/types';
import type { AnnotationNodeData } from '@mosaicflow/node-annotation/types';

// Union type for all node data
export type MosaicNodeData =  
  | NoteNodeData
  | ImageNodeData
  | LinkNodeData
  | CodeNodeData
  | TimestampNodeData
  | PersonNodeData
  | OrganizationNodeData
  | DomainNodeData
  | HashNodeData
  | CredentialNodeData
  | SocialPostNodeData
  | GroupNodeData
  | MapNodeData
  | RouterNodeData
  | LinkListNodeData
  | SnapshotNodeData
  | ActionNodeData
  | IframeNodeData
  | AnnotationNodeData;

// Custom node type extending xyflow Node
export interface MosaicNode extends Node {
  type: NodeType;
  data: MosaicNodeData;
  width?: number;
  height?: number;
}

// Edge types
export type EdgeType = 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';

// Marker types for edge arrows
export type MarkerShape = 'none' | 'arrow' | 'arrowclosed';

// Canvas interaction modes
export type CanvasMode = 'select' | 'drag';

// Edge stroke style types
export type EdgeStrokeStyle = 'solid' | 'dashed' | 'dotted';
export type EdgePathType = 'bezier' | 'straight' | 'step' | 'smoothstep';

export interface MosaicEdge extends Edge {
  label?: string;
  type?: EdgeType;
  animated?: boolean;
  style?: string;
  labelStyle?: string;
  labelBgStyle?: string;
  data?: {
    color?: string;
    strokeWidth?: number;
    strokeStyle?: EdgeStrokeStyle;
    labelColor?: string;
    labelBgColor?: string;
    labelFontSize?: number;
    markerStart?: MarkerShape;
    markerEnd?: MarkerShape;
    pathType?: EdgePathType;
    animated?: boolean;
  };
}

// Workspace settings
export interface WorkspaceSettings {
  autoSave: boolean;
  autoSaveInterval: number;
  theme: 'dark' | 'light';
  gridSize: number;
  snapToGrid: boolean;
  showMinimap: boolean;
  defaultNodeColor: string;
  defaultEdgeColor: string;
}

// Viewport state
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Workspace metadata
export interface WorkspaceMetadata {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  viewport: Viewport;
  settings: WorkspaceSettings;
}

// Main workspace data structure (workspace.json)
export interface WorkspaceData {
  metadata: WorkspaceMetadata;
  nodes: Record<string, MosaicNode>;
  edges: Record<string, MosaicEdge>;
}

// UI state structure (state.json)
export interface UIState {
  version: string;
  lastSaved: string;
  viewport: Viewport;
  nodes: Record<string, {
    position: { x: number; y: number };
    width?: number;
    height?: number;
  }>;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
}

// Default values
export const DEFAULT_SETTINGS: WorkspaceSettings = {
  autoSave: true,
  autoSaveInterval: 1000,
  theme: 'dark',
  gridSize: 20,
  snapToGrid: false,
  showMinimap: true,
  defaultNodeColor: '#1e1e1e',
  defaultEdgeColor: '#555555',
};

export const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

// Re-export node registry types from the plugin-based registry
export { 
  nodeRegistry,
  NODE_CATEGORIES,
  ICON_COMPONENTS,
  getIconComponent,
  getIconByName,
  type NodeCategory,
  type NodeDimensions,
  type NodeColors,
  type NodeTypeRegistration,
} from '$lib/kernel/registries/node-registry';
