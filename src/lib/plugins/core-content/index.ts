/**
 * Core Content Nodes Plugin
 * 
 * Provides the content node types: Note, SimpleText, Image, Link, Code, Iframe
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node metadata from packages
import { metadata as noteMetadata } from '@mosaicflow/node-note/plugin';
import { metadata as simpleTextMetadata } from '@mosaicflow/node-simple-text/plugin';
import { metadata as imageMetadata } from '@mosaicflow/node-image/plugin';
import { metadata as linkMetadata } from '@mosaicflow/node-link/plugin';
import { metadata as codeMetadata } from '@mosaicflow/node-code/plugin';
import { metadata as iframeMetadata } from '@mosaicflow/node-iframe/plugin';

const contentNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  noteMetadata,
  simpleTextMetadata,
  imageMetadata,
  linkMetadata,
  codeMetadata,
  iframeMetadata,
];

export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating content nodes plugin...`);
  api.registerNodeTypes(contentNodes);
  console.log(`[${api.manifest.id}] Registered ${contentNodes.length} content node types`);
};

export const deactivate = (): void => {
  console.log('[core.content] Deactivating content nodes plugin...');
};

const plugin: PluginModule = { activate, deactivate };
export default plugin;
