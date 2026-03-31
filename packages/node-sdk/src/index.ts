/**
 * @mosaicflow/node-sdk
 *
 * Shared SDK for building MosaicFlow node packages.
 * Provides base components, utilities, types, and styles.
 */

// Components
export { default as NodeWrapper } from './NodeWrapper.svelte';
export { default as NodeHeader } from './NodeHeader.svelte';
export { default as NodeField } from './NodeField.svelte';
export { default as NodeHandles } from './NodeHandles.svelte';
export { default as NodeFloatingToolbar } from './NodeFloatingToolbar.svelte';

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
} from './utils';

// Types
export type { BaseNodeData } from './types';
