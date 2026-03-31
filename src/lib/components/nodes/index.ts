/**
 * Node Components Index
 * 
 * This module re-exports all node components organized by category.
 * Node metadata and type definitions live in the plugin registry:
 * @see $lib/kernel/registries/node-registry.ts (SINGLE SOURCE OF TRUTH)
 */

// =============================================================================
// RE-EXPORTS BY CATEGORY
// =============================================================================

// Content Nodes - Text, media, and embedded content
export * from './content';

// Entity Nodes - People, organizations, and time markers
export * from './entity';

// Data Nodes - Structured data like domains, hashes, accounts
export * from './data';

// Utility Nodes - Grouping, actions, and annotations
export * from './utility';

// Shared Components & Utilities
export * from './_shared';