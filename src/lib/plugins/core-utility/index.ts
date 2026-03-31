/**
 * Core Utility Nodes Plugin
 * 
 * Provides the utility node types: Group, Map, LinkList, Action, Annotation
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node metadata from packages
import { metadata as groupMetadata } from '@mosaicflow/node-group/plugin';
import { metadata as mapMetadata } from '@mosaicflow/node-map/plugin';
import { metadata as linkListMetadata } from '@mosaicflow/node-link-list/plugin';
import { metadata as actionMetadata } from '@mosaicflow/node-action/plugin';
import { metadata as annotationMetadata } from '@mosaicflow/node-annotation/plugin';

const utilityNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  groupMetadata,
  mapMetadata,
  linkListMetadata,
  actionMetadata,
  annotationMetadata,
];

export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating utility nodes plugin...`);
  api.registerNodeTypes(utilityNodes);
  console.log(`[${api.manifest.id}] Registered ${utilityNodes.length} utility node types`);
};

export const deactivate = (): void => {
  console.log('[core.utility] Deactivating utility nodes plugin...');
};

const plugin: PluginModule = { activate, deactivate };
export default plugin;
