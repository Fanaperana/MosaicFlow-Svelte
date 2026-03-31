/**
 * Re-export registry types for node packages.
 * Node plugin.ts files should import from '@mosaicflow/node-sdk/registry' instead of '$lib/kernel/registries/node-registry'.
 */
export type {
  NodeTypeRegistration,
  NodeCategory,
  NodeDimensions,
  NodeColors,
} from '$lib/kernel/registries/node-registry';

export { nodeRegistry } from '$lib/kernel/registries/node-registry';
