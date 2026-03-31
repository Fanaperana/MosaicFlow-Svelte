/**
 * Core Entity Nodes Plugin
 * 
 * Provides the entity node types: Person, Organization, Timestamp
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node metadata from packages
import { metadata as personMetadata } from '@mosaicflow/node-person/plugin';
import { metadata as organizationMetadata } from '@mosaicflow/node-organization/plugin';
import { metadata as timestampMetadata } from '@mosaicflow/node-timestamp/plugin';

const entityNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  personMetadata,
  organizationMetadata,
  timestampMetadata,
];

export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating entity nodes plugin...`);
  api.registerNodeTypes(entityNodes);
  console.log(`[${api.manifest.id}] Registered ${entityNodes.length} entity node types`);
};

export const deactivate = (): void => {
  console.log('[core.entity] Deactivating entity nodes plugin...');
};

const plugin: PluginModule = { activate, deactivate };
export default plugin;
