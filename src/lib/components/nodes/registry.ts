/**
 * Node Type Registry
 * 
 * Central registry for all node types.
 * Makes it easy to add new nodes following a consistent pattern.
 * 
 * HOW TO ADD A NEW NODE:
 * 1. Create your node data interface in types/node-data.ts
 * 2. Create your node component in the appropriate category folder
 * 3. Register it in this file
 * 4. Update NODE_TYPE_INFO for UI metadata
 */

import type { NodeType } from '$lib/types';

// ============================================================================
// NODE CATEGORY DEFINITIONS
// ============================================================================

export type NodeCategory = 'content' | 'entity' | 'osint' | 'utility';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeComponent = any;

export interface NodeTypeDefinition {
  type: NodeType;
  label: string;
  description: string;
  category: NodeCategory;
  icon: string;
  component: NodeComponent;
  defaultData: Record<string, unknown>;
}

// ============================================================================
// NODE IMPORTS - Organized by category
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
// NODE TYPE MAP (for SvelteFlow)
// ============================================================================

export const nodeTypes: Record<string, NodeComponent> = {
  // Content
  note: NoteNode,
  simpleText: SimpleTextNode,
  image: ImageNode,
  link: LinkNode,
  code: CodeNode,
  iframe: IframeNode,
  
  // Entity
  person: PersonNode,
  organization: OrganizationNode,
  timestamp: TimestampNode,
  
  // OSINT
  domain: DomainNode,
  hash: HashNode,
  credential: CredentialNode,
  socialPost: SocialPostNode,
  router: RouterNode,
  snapshot: SnapshotNode,
  
  // Utility
  group: GroupNode,
  map: MapNode,
  linkList: LinkListNode,
  action: ActionNode,
  annotation: AnnotationNode,
};

// ============================================================================
// NODE REGISTRY WITH METADATA
// ============================================================================

export const NODE_REGISTRY: NodeTypeDefinition[] = [
  // ===== CONTENT NODES =====
  {
    type: 'note',
    label: 'Note',
    description: 'Markdown-supported text notes',
    category: 'content',
    icon: 'StickyNote',
    component: NoteNode,
    defaultData: {
      title: 'Note',
      content: '',
      viewMode: 'edit',
    },
  },
  {
    type: 'simpleText',
    label: 'Simple Text',
    description: 'Plain text without formatting',
    category: 'content',
    icon: 'Type',
    component: SimpleTextNode,
    defaultData: {
      title: 'Text',
      content: '',
    },
  },
  {
    type: 'image',
    label: 'Image',
    description: 'Display images with drag-and-drop support',
    category: 'content',
    icon: 'Image',
    component: ImageNode,
    defaultData: {
      title: 'Image',
      imageUrl: '',
      caption: '',
    },
  },
  {
    type: 'link',
    label: 'Link',
    description: 'Web URLs with descriptions',
    category: 'content',
    icon: 'Link',
    component: LinkNode,
    defaultData: {
      title: 'Link',
      url: '',
      description: '',
    },
  },
  {
    type: 'code',
    label: 'Code Snippet',
    description: 'Syntax-highlighted code blocks',
    category: 'content',
    icon: 'Code',
    component: CodeNode,
    defaultData: {
      title: 'Code',
      code: '',
      language: 'javascript',
    },
  },
  {
    type: 'iframe',
    label: 'Iframe',
    description: 'Embed external webpages',
    category: 'content',
    icon: 'Globe',
    component: IframeNode,
    defaultData: {
      title: 'Embed',
      url: '',
    },
  },
  
  // ===== ENTITY NODES =====
  {
    type: 'person',
    label: 'Person',
    description: 'Profile cards with contact info',
    category: 'entity',
    icon: 'User',
    component: PersonNode,
    defaultData: {
      title: 'Person',
      name: '',
      email: '',
      phone: '',
    },
  },
  {
    type: 'organization',
    label: 'Organization',
    description: 'Company/group information',
    category: 'entity',
    icon: 'Building2',
    component: OrganizationNode,
    defaultData: {
      title: 'Organization',
      name: '',
      type: '',
      website: '',
    },
  },
  {
    type: 'timestamp',
    label: 'Timestamp',
    description: 'Date/time events',
    category: 'entity',
    icon: 'Clock',
    component: TimestampNode,
    defaultData: {
      title: 'Timestamp',
      datetime: new Date().toISOString(),
      format: 'datetime',
    },
  },
  
  // ===== OSINT NODES =====
  {
    type: 'domain',
    label: 'Domain',
    description: 'Website/domain details',
    category: 'osint',
    icon: 'Globe',
    component: DomainNode,
    defaultData: {
      title: 'Domain',
      domain: '',
    },
  },
  {
    type: 'hash',
    label: 'Hash',
    description: 'File hashes with threat levels',
    category: 'osint',
    icon: 'FileDigit',
    component: HashNode,
    defaultData: {
      title: 'Hash',
      hash: '',
      algorithm: 'sha256',
      threatLevel: 'unknown',
    },
  },
  {
    type: 'credential',
    label: 'Credential',
    description: 'Account/credential data',
    category: 'osint',
    icon: 'KeyRound',
    component: CredentialNode,
    defaultData: {
      title: 'Credential',
      username: '',
      email: '',
      platform: '',
    },
  },
  {
    type: 'socialPost',
    label: 'Social Post',
    description: 'Social media post content',
    category: 'osint',
    icon: 'MessageSquare',
    component: SocialPostNode,
    defaultData: {
      title: 'Social Post',
      platform: '',
      content: '',
    },
  },
  {
    type: 'router',
    label: 'Router',
    description: 'Network device representation',
    category: 'osint',
    icon: 'Router',
    component: RouterNode,
    defaultData: {
      title: 'Router',
      name: '',
      ipAddress: '',
    },
  },
  {
    type: 'snapshot',
    label: 'Snapshot',
    description: 'Web page snapshots',
    category: 'osint',
    icon: 'Camera',
    component: SnapshotNode,
    defaultData: {
      title: 'Snapshot',
      url: '',
    },
  },
  
  // ===== UTILITY NODES =====
  {
    type: 'group',
    label: 'Group',
    description: 'Container for related nodes',
    category: 'utility',
    icon: 'FolderOpen',
    component: GroupNode,
    defaultData: {
      title: 'Group',
      label: 'Group',
      childNodeIds: [],
      collapsed: false,
    },
  },
  {
    type: 'map',
    label: 'Map',
    description: 'Geographic location display',
    category: 'utility',
    icon: 'MapPin',
    component: MapNode,
    defaultData: {
      title: 'Location',
      latitude: 0,
      longitude: 0,
      zoom: 10,
    },
  },
  {
    type: 'linkList',
    label: 'Link List',
    description: 'Collection of related links',
    category: 'utility',
    icon: 'List',
    component: LinkListNode,
    defaultData: {
      title: 'Links',
      links: [],
    },
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Task/action items',
    category: 'utility',
    icon: 'CheckSquare',
    component: ActionNode,
    defaultData: {
      title: 'Action',
      action: '',
      status: 'pending',
      priority: 'medium',
    },
  },
  {
    type: 'annotation',
    label: 'Annotation',
    description: 'Visual text annotation with arrow',
    category: 'utility',
    icon: 'MessageSquare',
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
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get node definition by type
 */
export function getNodeDefinition(type: NodeType): NodeTypeDefinition | undefined {
  return NODE_REGISTRY.find(n => n.type === type);
}

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: NodeCategory): NodeTypeDefinition[] {
  return NODE_REGISTRY.filter(n => n.category === category);
}

/**
 * Get default data for a node type
 */
export function getDefaultNodeData(type: NodeType): Record<string, unknown> {
  const def = getNodeDefinition(type);
  return def?.defaultData ?? { title: type };
}

/**
 * Get all category labels
 */
export const NODE_CATEGORIES: { id: NodeCategory; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'entity', label: 'Entities' },
  { id: 'osint', label: 'OSINT' },
  { id: 'utility', label: 'Utility' },
];
