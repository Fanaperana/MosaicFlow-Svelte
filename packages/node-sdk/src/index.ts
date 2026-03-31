/**
 * @mosaicflow/node-sdk
 *
 * Shared SDK for building MosaicFlow node packages.
 * Re-exports components and utilities from the canonical _shared source.
 */

// Components
export { default as NodeWrapper } from '$lib/components/nodes/_shared/NodeWrapper.svelte';
export { default as NodeHeader } from '$lib/components/nodes/_shared/NodeHeader.svelte';
export { default as NodeField } from '$lib/components/nodes/_shared/NodeField.svelte';
export { default as NodeHandles } from '$lib/components/nodes/_shared/NodeHandles.svelte';
export { default as NodeFloatingToolbar } from '$lib/components/nodes/_shared/NodeFloatingToolbar.svelte';

// Utilities
export {
  hexToRgba,
  darkenColor,
  lightenColor,
  getNodeStyles,
  nodeStyleToString,
  getNodeDimensions,
  type NodeStyleProps,
  type NodeDimensions,
} from '$lib/components/nodes/_shared/utils';

// Types
export type { BaseNodeData, NodeType } from './types';
