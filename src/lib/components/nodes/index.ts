/**
 * Node Components Index
 * 
 * This module re-exports all node components organized by category.
 * Use the registry for full node metadata and type definitions.
 * 
 * @see ./node-registry.ts for the centralized node registry (SINGLE SOURCE OF TRUTH)
 * @see ./README.md for documentation on creating new nodes
 */

// =============================================================================
// RE-EXPORTS BY CATEGORY
// =============================================================================

// Content Nodes - Text, media, and embedded content
export * from './content';

// Entity Nodes - People, organizations, and time markers
export * from './entity';

// OSINT Nodes - Security research and intelligence gathering
export * from './osint';

// Utility Nodes - Grouping, actions, and annotations
export * from './utility';

// Shared Components & Utilities
export * from './_shared';

// =============================================================================
// CENTRALIZED NODE REGISTRY EXPORTS
// =============================================================================

// Re-export everything from the centralized node registry
export {
  // Types
  type NodeCategory,
  type NodeDimensions,
  type NodeColors,
  type NodeDefinition,
  
  // Main exports
  NODE_DEFINITIONS,
  NODE_DEFINITIONS as NODE_REGISTRY, // Backwards compatibility alias
  NODE_DEFINITION_MAP,
  nodeTypes,
  NODE_CATEGORIES,
  
  // Helper functions
  getNodeDefinition,
  getNodesByCategory,
  getNodesGroupedByCategory,
  getQuickAccessNodes,
  getDefaultNodeData,
  getDefaultTitle,
  getNodeDimensions,
  getNodeColors,
  getIconName,
  getNodeLabel,
  getIconComponent,
  getIconByName,
  ICON_COMPONENTS,
} from './node-registry';

// =============================================================================
// LEGACY EXPORTS (deprecated - use category imports instead)
// =============================================================================

// Content
import { NoteNode, SimpleTextNode, ImageNode, LinkNode, CodeNode, IframeNode } from './content';
// Entity
import { PersonNode, OrganizationNode, TimestampNode } from './entity';
// OSINT
import { DomainNode, HashNode, CredentialNode, SocialPostNode, RouterNode, SnapshotNode } from './osint';
// Utility
import { GroupNode, MapNode, LinkListNode, ActionNode, AnnotationNode } from './utility';

// Individual named exports (for backwards compatibility)
export {
  // Content
  NoteNode,
  SimpleTextNode,
  ImageNode,
  LinkNode,
  CodeNode,
  IframeNode,
  // Entity
  PersonNode,
  OrganizationNode,
  TimestampNode,
  // OSINT
  DomainNode,
  HashNode,
  CredentialNode,
  SocialPostNode,
  RouterNode,
  SnapshotNode,
  // Utility
  GroupNode,
  MapNode,
  LinkListNode,
  ActionNode,
  AnnotationNode,
};