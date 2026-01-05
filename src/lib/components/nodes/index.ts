/**
 * Node Components Index
 * 
 * This module re-exports all node components organized by category.
 * Use the registry for full node metadata and type definitions.
 * 
 * @see ./registry.ts for the centralized node registry
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
// NODE TYPES MAP (for SvelteFlow)
// =============================================================================

// Re-export the centralized nodeTypes from registry
export { nodeTypes, NODE_REGISTRY, getNodeDefinition, getNodesByCategory, getDefaultNodeData, NODE_CATEGORIES } from './registry';

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