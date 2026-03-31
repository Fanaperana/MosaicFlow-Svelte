/**
 * Node Components Index
 * 
 * Node components now live in individual @mosaicflow/node-* packages.
 * This barrel re-exports the shared SDK utilities for backwards compatibility.
 * 
 * @see packages/node-* for individual node components
 * @see $lib/kernel/registries/node-registry.ts (SINGLE SOURCE OF TRUTH)
 */

// Shared Components & Utilities
export * from './_shared';