// MosaicFlow Type Definitions

import type { Node, Edge } from '@xyflow/svelte';

// Node Types
export type NodeType = 
  | 'note'
  | 'simpleText'
  | 'image'
  | 'link'
  | 'code'
  | 'timestamp'
  | 'person'
  | 'organization'
  | 'domain'
  | 'hash'
  | 'credential'
  | 'socialPost'
  | 'group'
  | 'map'
  | 'router'
  | 'linkList'
  | 'snapshot'
  | 'action'
  | 'iframe'
  | 'annotation';

// Base node data interface with index signature for xyflow compatibility
export interface BaseNodeData {
  title: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderRadius?: number;
  bgOpacity?: number;
  textColor?: string;
  notes?: string;
  showHeader?: boolean;
  locked?: boolean;
  sizeLocked?: boolean;
  [key: string]: unknown;
}

// Specific node data types
export interface NoteNodeData extends BaseNodeData {
  content: string;
  isEditing?: boolean;
  viewMode?: 'edit' | 'view';
}

export interface SimpleTextNodeData extends BaseNodeData {
  content: string;
}

export interface ImageNodeData extends BaseNodeData {
  imageUrl?: string;
  imagePath?: string;
  caption?: string;
}

export interface LinkNodeData extends BaseNodeData {
  url: string;
  description?: string;
  favicon?: string;
}

export interface CodeNodeData extends BaseNodeData {
  code: string;
  language: string;
}

export interface TimestampNodeData extends BaseNodeData {
  datetime: string;
  format?: 'date' | 'time' | 'datetime' | 'relative';
  timezone?: string;
  textColor?: string;
  showMonth?: boolean;
  showYear?: boolean;
  showDayOfWeek?: boolean;
  showDay?: boolean;
  showHour?: boolean;
  showMinute?: boolean;
  showSecond?: boolean;
  showMillisecond?: boolean;
  useCurrentTime?: boolean;
  multiLine?: boolean;
  use24HourFormat?: boolean; // Military time (24h) vs 12h with AM/PM
  customTimestamp?: string; // ISO date string for custom datetime
  // Component compatibility
  date?: string;
  time?: string;
  label?: string;
}

export interface PersonNodeData extends BaseNodeData {
  name: string;
  email?: string;
  phone?: string;
  aliases?: string[];
  avatar?: string;
  organization?: string;
  role?: string;
}

export interface OrganizationNodeData extends BaseNodeData {
  name: string;
  type?: string;
  website?: string;
  description?: string;
  logo?: string;
  // Component compatibility
  industry?: string;
  location?: string;
  size?: string;
}

export interface DomainNodeData extends BaseNodeData {
  domain: string;
  registrar?: string;
  createdDate?: string;
  expiryDate?: string;
  nameservers?: string[];
  ipAddresses?: string[];
  // Additional OSINT properties
  protocol?: 'http' | 'https';
  ip?: string;
  created?: string;
  expires?: string;
}

export interface HashNodeData extends BaseNodeData {
  hash: string;
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' | 'other';
  filename?: string;
  threatLevel?: 'unknown' | 'safe' | 'suspicious' | 'malicious';
  virusTotalUrl?: string;
  // Alternative properties for component compatibility
  type?: string;
  value?: string;
  status?: 'clean' | 'malicious' | 'unknown';
  source?: string;
}

export interface CredentialNodeData extends BaseNodeData {
  username?: string;
  email?: string;
  platform?: string;
  source?: string;
  breached?: boolean;
  // Additional properties
  service?: string;
  password?: string;
  compromised?: boolean;
}

export interface SocialPostNodeData extends BaseNodeData {
  platform: string;
  author?: string;
  content: string;
  postUrl?: string;
  timestamp?: string;
  engagement?: {
    likes?: number;
    shares?: number;
    comments?: number;
  };
  // Additional properties
  url?: string;
  avatar?: string;
  handle?: string;
  likes?: number;
  reposts?: number;
  replies?: number;
}

export interface GroupNodeData extends BaseNodeData {
  label?: string;
  childNodeIds?: string[];
  // Font customization
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontStyle?: 'normal' | 'italic';
  labelColor?: string;
  // Collapsed state
  collapsed?: boolean;
  // Group styling
  groupColor?: string;
  groupBgColor?: string;
  groupBgOpacity?: number;
  description?: string;
}

export interface MapNodeData extends BaseNodeData {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  address?: string;
  label?: string;
}

export interface RouterNodeData extends BaseNodeData {
  name: string;
  ipAddress?: string;
  macAddress?: string;
  manufacturer?: string;
  model?: string;
  // Additional properties
  ip?: string;
  mac?: string;
  vendor?: string;
  status?: 'online' | 'offline' | 'unknown';
  ports?: number[];
}

// Link item for LinkListNode
export interface LinkItem {
  id: string;
  url: string;
  label: string;
  description?: string;
}

export interface LinkListNodeData extends BaseNodeData {
  links: LinkItem[];
}

export interface SnapshotNodeData extends BaseNodeData {
  url: string;
  screenshotPath?: string;
  capturedAt?: string;
  htmlPath?: string;
  // Additional properties
  imageUrl?: string;
  sourceUrl?: string;
  timestamp?: string;
  hash?: string;
}

export interface ActionNodeData extends BaseNodeData {
  action: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
}

export interface IframeNodeData extends BaseNodeData {
  url: string;
  allowFullscreen?: boolean;
  sandbox?: string;
}

export interface AnnotationNodeData extends BaseNodeData {
  label: string;
  arrow?: string;
  arrowStyle?: string;
  arrowPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right' | 'none';
  arrowRotation?: number; // 0, 45, 90, 135, 180, 225, 270, 315
  arrowFlipX?: boolean;
  arrowFlipY?: boolean;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  // Component compatibility
  content?: string;
  annotationType?: 'note' | 'info' | 'warning' | 'error' | 'success';
  author?: string;
}

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

// Node type metadata for UI
export interface NodeTypeInfo {
  type: NodeType;
  label: string;
  icon: string;
  category: 'content' | 'entity' | 'osint' | 'utility';
  description: string;
}

export const NODE_TYPE_INFO: NodeTypeInfo[] = [
  // Content nodes
  { type: 'note', label: 'Note', icon: 'StickyNote', category: 'content', description: 'Markdown-supported text notes' },
  { type: 'image', label: 'Image', icon: 'Image', category: 'content', description: 'Display images with drag-and-drop support' },
  { type: 'link', label: 'Link', icon: 'Link', category: 'content', description: 'Web URLs with descriptions' },
  { type: 'code', label: 'Code Snippet', icon: 'Code', category: 'content', description: 'Syntax-highlighted code blocks' },
  { type: 'timestamp', label: 'Timestamp', icon: 'Clock', category: 'content', description: 'Date/time events' },
  
  // Entity nodes
  { type: 'person', label: 'Person', icon: 'User', category: 'entity', description: 'Profile cards with contact info' },
  { type: 'organization', label: 'Organization', icon: 'Building2', category: 'entity', description: 'Company/group information' },
  
  // OSINT nodes
  { type: 'domain', label: 'Domain', icon: 'Globe', category: 'osint', description: 'Website/domain details' },
  { type: 'hash', label: 'Hash', icon: 'FileDigit', category: 'osint', description: 'File hashes with threat levels' },
  { type: 'credential', label: 'Credential', icon: 'KeyRound', category: 'osint', description: 'Account/credential data' },
  { type: 'socialPost', label: 'Social Post', icon: 'MessageSquare', category: 'osint', description: 'Social media post content' },
  { type: 'router', label: 'Router', icon: 'Router', category: 'osint', description: 'Network device representation' },
  { type: 'snapshot', label: 'Snapshot', icon: 'Camera', category: 'osint', description: 'Web page snapshots' },
  
  // Utility nodes
  { type: 'group', label: 'Group', icon: 'FolderOpen', category: 'utility', description: 'Container for related nodes' },
  { type: 'map', label: 'Map', icon: 'MapPin', category: 'utility', description: 'Geographic location display' },
  { type: 'linkList', label: 'Link List', icon: 'List', category: 'utility', description: 'Collection of related links' },
  { type: 'action', label: 'Action', icon: 'CheckSquare', category: 'utility', description: 'Task/action items' },
  { type: 'iframe', label: 'Iframe', icon: 'Globe', category: 'content', description: 'Embed external webpages' },
  { type: 'annotation', label: 'Annotation', icon: 'MessageSquare', category: 'utility', description: 'Visual text annotation with arrow' },
];
