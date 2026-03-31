/**
 * Core Data Nodes Plugin
 * 
 * Provides data-focused node types: Domain, Hash, Account, Post, Network, Capture
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node metadata from packages
import { metadata as domainMetadata } from '@mosaicflow/node-domain/plugin';
import { metadata as hashMetadata } from '@mosaicflow/node-hash/plugin';
import { metadata as credentialMetadata } from '@mosaicflow/node-credential/plugin';
import { metadata as socialPostMetadata } from '@mosaicflow/node-social-post/plugin';
import { metadata as routerMetadata } from '@mosaicflow/node-router/plugin';
import { metadata as snapshotMetadata } from '@mosaicflow/node-snapshot/plugin';

const dataNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  domainMetadata,
  hashMetadata,
  credentialMetadata,
  socialPostMetadata,
  routerMetadata,
  snapshotMetadata,
];

export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating data nodes plugin...`);
  api.registerNodeTypes(dataNodes);
  console.log(`[${api.manifest.id}] Registered ${dataNodes.length} data node types`);
};

export const deactivate = (): void => {
  console.log('[core.data] Deactivating data nodes plugin...');
};

const plugin: PluginModule = { activate, deactivate };
export default plugin;
