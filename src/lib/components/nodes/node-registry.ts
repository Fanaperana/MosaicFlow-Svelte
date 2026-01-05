/**
 * Node Registry - Single Source of Truth
 * 
 * This is the ONLY place where node types should be defined.
 * All other files should import from here.
 * 
 * HOW TO ADD A NEW NODE:
 * 1. Add the node type to the NodeType union in types.ts
 * 2. Create your node data interface in types.ts
 * 3. Create your node component in the appropriate category folder
 * 4. Add the node definition to NODE_DEFINITIONS below
 * 5. That's it! All UI, exports, and defaults will be auto-generated.
 */

import type { NodeType, MosaicNodeData } from '$lib/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type NodeCategory = 'content' | 'entity' | 'osint' | 'utility';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeComponent = any; // Using any to avoid complex SvelteFlow NodeProps typing

export interface NodeDimensions {
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

export interface NodeColors {
  bg: string;
  border: string;
  icon: string; // emoji for SVG export
}

export interface NodeDefinition {
  /** Unique node type identifier */
  type: NodeType;
  /** Display label for UI */
  label: string;
  /** Short description for tooltips/palettes */
  description: string;
  /** Node category for grouping */
  category: NodeCategory;
  /** Lucide icon name (e.g., 'StickyNote', 'User') */
  iconName: string;
  /** Svelte component for rendering */
  component: NodeComponent;
  /** Default data when creating new node */
  defaultData: Partial<MosaicNodeData>;
  /** Size constraints */
  dimensions: NodeDimensions;
  /** Colors for SVG export */
  colors: NodeColors;
  /** Show in quick access toolbar */
  quickAccess?: boolean;
  /** Keyboard shortcut (optional) */
  shortcut?: string;
}

// ============================================================================
// NODE COMPONENT IMPORTS
// ============================================================================

// Content nodes
import NoteNode from './content/NoteNode.svelte';
import SimpleTextNode from './content/SimpleTextNode.svelte';
import ImageNode from './content/ImageNode.svelte';
import LinkNode from './content/LinkNode.svelte';
import CodeNode from './content/CodeNode.svelte';
import IframeNode from './content/IframeNode.svelte';

// Entity nodes
import PersonNode from './entity/PersonNode.svelte';
import OrganizationNode from './entity/OrganizationNode.svelte';
import TimestampNode from './entity/TimestampNode.svelte';

// OSINT nodes
import DomainNode from './osint/DomainNode.svelte';
import HashNode from './osint/HashNode.svelte';
import CredentialNode from './osint/CredentialNode.svelte';
import SocialPostNode from './osint/SocialPostNode.svelte';
import RouterNode from './osint/RouterNode.svelte';
import SnapshotNode from './osint/SnapshotNode.svelte';

// Utility nodes
import GroupNode from './utility/GroupNode.svelte';
import MapNode from './utility/MapNode.svelte';
import LinkListNode from './utility/LinkListNode.svelte';
import ActionNode from './utility/ActionNode.svelte';
import AnnotationNode from './utility/AnnotationNode.svelte';

// ============================================================================
// NODE DEFINITIONS - THE SINGLE SOURCE OF TRUTH
// ============================================================================

export const NODE_DEFINITIONS: NodeDefinition[] = [
  // ===== CONTENT NODES =====
  {
    type: 'note',
    label: 'Note',
    description: 'Markdown-supported text notes',
    category: 'content',
    iconName: 'StickyNote',
    component: NoteNode,
    defaultData: {
      title: 'New Note',
      content: '',
      viewMode: 'edit',
    },
    dimensions: { minWidth: 120, minHeight: 60, defaultWidth: 280, defaultHeight: 200 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '📝' },
    quickAccess: true,
  },
  {
    type: 'simpleText',
    label: 'Simple Text',
    description: 'Plain text without formatting',
    category: 'content',
    iconName: 'Type',
    component: SimpleTextNode,
    defaultData: {
      title: 'Text',
      content: '',
    },
    dimensions: { minWidth: 120, minHeight: 60, defaultWidth: 200, defaultHeight: 100 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '📄' },
  },
  {
    type: 'image',
    label: 'Image',
    description: 'Display images with drag-and-drop support',
    category: 'content',
    iconName: 'Image',
    component: ImageNode,
    defaultData: {
      title: 'Image',
      imageUrl: '',
      caption: '',
    },
    dimensions: { minWidth: 150, minHeight: 150, defaultWidth: 300, defaultHeight: 250 },
    colors: { bg: '#1a2e1a', border: '#4a6a4a', icon: '🖼️' },
    quickAccess: true,
  },
  {
    type: 'link',
    label: 'Link',
    description: 'Web URLs with descriptions',
    category: 'content',
    iconName: 'Link',
    component: LinkNode,
    defaultData: {
      title: 'Link',
      url: '',
      description: '',
    },
    dimensions: { minWidth: 200, minHeight: 100, defaultWidth: 250, defaultHeight: 140 },
    colors: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🔗' },
    quickAccess: true,
  },
  {
    type: 'code',
    label: 'Code Snippet',
    description: 'Syntax-highlighted code blocks',
    category: 'content',
    iconName: 'Code',
    component: CodeNode,
    defaultData: {
      title: 'Code',
      code: '',
      language: 'javascript',
    },
    dimensions: { minWidth: 300, minHeight: 200, defaultWidth: 400, defaultHeight: 300 },
    colors: { bg: '#1a2e2e', border: '#4a6a6a', icon: '💻' },
  },
  {
    type: 'iframe',
    label: 'Iframe',
    description: 'Embed external webpages',
    category: 'content',
    iconName: 'LayoutGrid',
    component: IframeNode,
    defaultData: {
      title: 'Embed',
      url: '',
    },
    dimensions: { minWidth: 300, minHeight: 250, defaultWidth: 500, defaultHeight: 400 },
    colors: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🖥️' },
  },

  // ===== ENTITY NODES =====
  {
    type: 'person',
    label: 'Person',
    description: 'Profile cards with contact info',
    category: 'entity',
    iconName: 'User',
    component: PersonNode,
    defaultData: {
      title: 'Person',
      name: '',
      email: '',
      phone: '',
      aliases: [],
    },
    dimensions: { minWidth: 220, minHeight: 180, defaultWidth: 280, defaultHeight: 220 },
    colors: { bg: '#2e1a2e', border: '#6a4a6a', icon: '👤' },
    quickAccess: true,
  },
  {
    type: 'organization',
    label: 'Organization',
    description: 'Company/group information',
    category: 'entity',
    iconName: 'Building2',
    component: OrganizationNode,
    defaultData: {
      title: 'Organization',
      name: '',
      type: '',
      website: '',
    },
    dimensions: { minWidth: 220, minHeight: 150, defaultWidth: 280, defaultHeight: 180 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '🏢' },
  },
  {
    type: 'timestamp',
    label: 'Timestamp',
    description: 'Date/time events',
    category: 'entity',
    iconName: 'Clock',
    component: TimestampNode,
    defaultData: {
      title: 'Timestamp',
      datetime: new Date().toISOString(),
      format: 'datetime',
    },
    dimensions: { minWidth: 180, minHeight: 100, defaultWidth: 220, defaultHeight: 130 },
    colors: { bg: '#2e2e1a', border: '#6a6a4a', icon: '⏰' },
    quickAccess: true,
  },

  // ===== OSINT NODES =====
  {
    type: 'domain',
    label: 'Domain',
    description: 'Website/domain details',
    category: 'osint',
    iconName: 'Globe',
    component: DomainNode,
    defaultData: {
      title: 'Domain',
      domain: '',
    },
    dimensions: { minWidth: 240, minHeight: 180, defaultWidth: 300, defaultHeight: 220 },
    colors: { bg: '#1a2e1a', border: '#4a6a4a', icon: '🌐' },
  },
  {
    type: 'hash',
    label: 'Hash',
    description: 'File hashes with threat levels',
    category: 'osint',
    iconName: 'FileDigit',
    component: HashNode,
    defaultData: {
      title: 'Hash',
      hash: '',
      algorithm: 'sha256',
      threatLevel: 'unknown',
    },
    dimensions: { minWidth: 240, minHeight: 150, defaultWidth: 300, defaultHeight: 180 },
    colors: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🔐' },
  },
  {
    type: 'credential',
    label: 'Credential',
    description: 'Account/credential data',
    category: 'osint',
    iconName: 'KeyRound',
    component: CredentialNode,
    defaultData: {
      title: 'Credential',
      username: '',
      email: '',
      platform: '',
      breached: false,
    },
    dimensions: { minWidth: 220, minHeight: 150, defaultWidth: 260, defaultHeight: 180 },
    colors: { bg: '#2e2e1a', border: '#6a6a4a', icon: '🔑' },
  },
  {
    type: 'socialPost',
    label: 'Social Post',
    description: 'Social media post content',
    category: 'osint',
    iconName: 'MessageSquare',
    component: SocialPostNode,
    defaultData: {
      title: 'Social Post',
      platform: '',
      content: '',
    },
    dimensions: { minWidth: 250, minHeight: 180, defaultWidth: 320, defaultHeight: 250 },
    colors: { bg: '#1a2e2e', border: '#4a6a6a', icon: '💬' },
  },
  {
    type: 'router',
    label: 'Router',
    description: 'Network device representation',
    category: 'osint',
    iconName: 'Router',
    component: RouterNode,
    defaultData: {
      title: 'Router',
      name: '',
      ipAddress: '',
    },
    dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 260, defaultHeight: 180 },
    colors: { bg: '#2e1a2e', border: '#6a4a6a', icon: '📡' },
  },
  {
    type: 'snapshot',
    label: 'Snapshot',
    description: 'Web page snapshots',
    category: 'osint',
    iconName: 'Camera',
    component: SnapshotNode,
    defaultData: {
      title: 'Snapshot',
      url: '',
    },
    dimensions: { minWidth: 250, minHeight: 200, defaultWidth: 350, defaultHeight: 280 },
    colors: { bg: '#2e2e1a', border: '#6a6a4a', icon: '📸' },
  },

  // ===== UTILITY NODES =====
  {
    type: 'group',
    label: 'Group',
    description: 'Container for related nodes',
    category: 'utility',
    iconName: 'FolderOpen',
    component: GroupNode,
    defaultData: {
      title: 'Group',
      label: 'Group',
      childNodeIds: [],
      collapsed: false,
    },
    dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 400, defaultHeight: 300 },
    colors: { bg: '#252530', border: '#4a4a5a', icon: '📁' },
  },
  {
    type: 'map',
    label: 'Map',
    description: 'Geographic location display',
    category: 'utility',
    iconName: 'MapPin',
    component: MapNode,
    defaultData: {
      title: 'Location',
      latitude: 0,
      longitude: 0,
      zoom: 10,
    },
    dimensions: { minWidth: 280, minHeight: 200, defaultWidth: 560, defaultHeight: 470 },
    colors: { bg: '#1a2e2e', border: '#4a6a6a', icon: '🗺️' },
  },
  {
    type: 'linkList',
    label: 'Link List',
    description: 'Collection of related links',
    category: 'utility',
    iconName: 'List',
    component: LinkListNode,
    defaultData: {
      title: 'Links',
      links: [],
    },
    dimensions: { minWidth: 220, minHeight: 150, defaultWidth: 280, defaultHeight: 200 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '📋' },
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Task/action items',
    category: 'utility',
    iconName: 'CheckSquare',
    component: ActionNode,
    defaultData: {
      title: 'Action',
      action: '',
      status: 'pending',
      priority: 'medium',
    },
    dimensions: { minWidth: 200, minHeight: 120, defaultWidth: 260, defaultHeight: 150 },
    colors: { bg: '#1a2e1a', border: '#4a6a4a', icon: '✅' },
  },
  {
    type: 'annotation',
    label: 'Annotation',
    description: 'Visual text annotation with arrow',
    category: 'utility',
    iconName: 'MessageSquare',
    component: AnnotationNode,
    defaultData: {
      title: 'Annotation',
      label: 'Double-click to edit...',
      arrowPosition: 'bottom-left',
      textColor: '#999',
      fontWeight: '400',
      fontStyle: 'normal',
      textAlign: 'left',
    },
    dimensions: { minWidth: 120, minHeight: 60, defaultWidth: 180, defaultHeight: 80 },
    colors: { bg: '#2e2e2e', border: '#5a5a5a', icon: '💭' },
    quickAccess: true,
  },
];

// ============================================================================
// DERIVED DATA STRUCTURES (auto-generated from NODE_DEFINITIONS)
// ============================================================================

/** Map of node type to definition for O(1) lookup */
export const NODE_DEFINITION_MAP: Map<NodeType, NodeDefinition> = new Map(
  NODE_DEFINITIONS.map(def => [def.type, def])
);

/** SvelteFlow nodeTypes record */
export const nodeTypes: Record<string, NodeComponent> = Object.fromEntries(
  NODE_DEFINITIONS.map(def => [def.type, def.component])
);

/** Node categories with labels */
export const NODE_CATEGORIES: { id: NodeCategory; label: string; icon: string }[] = [
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'entity', label: 'Entities', icon: '👤' },
  { id: 'osint', label: 'OSINT', icon: '🔍' },
  { id: 'utility', label: 'Utility', icon: '🔧' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get node definition by type
 */
export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return NODE_DEFINITION_MAP.get(type);
}

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: NodeCategory): NodeDefinition[] {
  return NODE_DEFINITIONS.filter(n => n.category === category);
}

/**
 * Get nodes grouped by category
 */
export function getNodesGroupedByCategory(): Record<NodeCategory, NodeDefinition[]> {
  const groups: Record<NodeCategory, NodeDefinition[]> = {
    content: [],
    entity: [],
    osint: [],
    utility: [],
  };
  
  NODE_DEFINITIONS.forEach(def => {
    groups[def.category].push(def);
  });
  
  return groups;
}

/**
 * Get quick access nodes
 */
export function getQuickAccessNodes(): NodeDefinition[] {
  return NODE_DEFINITIONS.filter(n => n.quickAccess);
}

/**
 * Get default data for a node type
 */
export function getDefaultNodeData(type: NodeType): Partial<MosaicNodeData> {
  const def = NODE_DEFINITION_MAP.get(type);
  return def?.defaultData ?? { title: type };
}

/**
 * Get default title for a node type
 */
export function getDefaultTitle(type: NodeType): string {
  const def = NODE_DEFINITION_MAP.get(type);
  return (def?.defaultData?.title as string) ?? 'Node';
}

/**
 * Get dimensions for a node type
 */
export function getNodeDimensions(type: NodeType): NodeDimensions {
  const def = NODE_DEFINITION_MAP.get(type);
  return def?.dimensions ?? {
    minWidth: 150,
    minHeight: 80,
    defaultWidth: 200,
    defaultHeight: 120,
  };
}

/**
 * Get colors for a node type (used in SVG export)
 */
export function getNodeColors(type: NodeType): NodeColors {
  const def = NODE_DEFINITION_MAP.get(type);
  return def?.colors ?? { bg: '#1a1a2e', border: '#4a4a6a', icon: '📦' };
}

/**
 * Get icon name for a node type
 */
export function getIconName(type: NodeType): string {
  const def = NODE_DEFINITION_MAP.get(type);
  return def?.iconName ?? 'Box';
}

/**
 * Get node label for a type
 */
export function getNodeLabel(type: NodeType): string {
  const def = NODE_DEFINITION_MAP.get(type);
  return def?.label ?? type;
}

// ============================================================================
// ICON COMPONENT MAPPING
// ============================================================================

import {
  StickyNote,
  Type,
  Image,
  Link,
  Code,
  LayoutGrid,
  User,
  Building2,
  Clock,
  Globe,
  FileDigit,
  KeyRound,
  MessageSquare,
  Router,
  Camera,
  FolderOpen,
  MapPin,
  List,
  CheckSquare,
  Box,
} from 'lucide-svelte';

/** Map of icon names to Lucide components */
export const ICON_COMPONENTS: Record<string, typeof StickyNote> = {
  StickyNote,
  Type,
  Image,
  Link,
  Code,
  LayoutGrid,
  User,
  Building2,
  Clock,
  Globe,
  FileDigit,
  KeyRound,
  MessageSquare,
  Router,
  Camera,
  FolderOpen,
  MapPin,
  List,
  CheckSquare,
  Box,
};

/**
 * Get Lucide icon component for a node type
 */
export function getIconComponent(type: NodeType): typeof StickyNote {
  const iconName = getIconName(type);
  return ICON_COMPONENTS[iconName] ?? Box;
}

/**
 * Get Lucide icon component by name
 */
export function getIconByName(iconName: string): typeof StickyNote {
  return ICON_COMPONENTS[iconName] ?? Box;
}
