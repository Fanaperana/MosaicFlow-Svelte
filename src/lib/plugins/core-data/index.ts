/**
 * Core Data Nodes Plugin
 * 
 * Provides data-focused node types: Domain, Hash, Account, Post, Network, Capture
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node components
import DomainNode from '$lib/components/nodes/data/DomainNode.svelte';
import HashNode from '$lib/components/nodes/data/HashNode.svelte';
import CredentialNode from '$lib/components/nodes/data/CredentialNode.svelte';
import SocialPostNode from '$lib/components/nodes/data/SocialPostNode.svelte';
import RouterNode from '$lib/components/nodes/data/RouterNode.svelte';
import SnapshotNode from '$lib/components/nodes/data/SnapshotNode.svelte';

/**
 * Data node type definitions
 */
const dataNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  {
    type: 'domain',
    label: 'Website',
    description: 'Website and domain information',
    category: 'data',
    iconName: 'Globe',
    component: DomainNode,
    defaultData: {
      title: 'Domain',
      domain: '',
    },
    dimensions: { minWidth: 240, minHeight: 180, defaultWidth: 300, defaultHeight: 220 },
    colors: { bg: '#1a2e1a', border: '#4a6a4a', icon: '🌐' },
  },
  {
    type: 'hash',
    label: 'Hash',
    description: 'File or data fingerprint values',
    category: 'data',
    iconName: 'FileDigit',
    component: HashNode,
    defaultData: {
      title: 'Hash',
      hash: '',
      algorithm: 'sha256',
      threatLevel: 'unknown',
    },
    dimensions: { minWidth: 240, minHeight: 150, defaultWidth: 300, defaultHeight: 180 },
    colors: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🔐' },
  },
  {
    type: 'credential',
    label: 'Account',
    description: 'User account information',
    category: 'data',
    iconName: 'KeyRound',
    component: CredentialNode,
    defaultData: {
      title: 'Credential',
      username: '',
      email: '',
      platform: '',
      breached: false,
    },
    dimensions: { minWidth: 220, minHeight: 150, defaultWidth: 260, defaultHeight: 180 },
    colors: { bg: '#2e2e1a', border: '#6a6a4a', icon: '🔑' },
  },
  {
    type: 'socialPost',
    label: 'Post',
    description: 'Social media or forum post',
    category: 'data',
    iconName: 'MessageSquare',
    component: SocialPostNode,
    defaultData: {
      title: 'Social Post',
      platform: '',
      content: '',
    },
    dimensions: { minWidth: 250, minHeight: 180, defaultWidth: 320, defaultHeight: 250 },
    colors: { bg: '#1a2e2e', border: '#4a6a6a', icon: '💬' },
  },
  {
    type: 'router',
    label: 'Network Device',
    description: 'Network device or infrastructure',
    category: 'data',
    iconName: 'Router',
    component: RouterNode,
    defaultData: {
      title: 'Router',
      name: '',
      ipAddress: '',
    },
    dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 260, defaultHeight: 180 },
    colors: { bg: '#2e1a2e', border: '#6a4a6a', icon: '📡' },
  },
  {
    type: 'snapshot',
    label: 'Capture',
    description: 'Webpage screenshot or capture',
    category: 'data',
    iconName: 'Camera',
    component: SnapshotNode,
    defaultData: {
      title: 'Snapshot',
      url: '',
    },
    dimensions: { minWidth: 250, minHeight: 200, defaultWidth: 350, defaultHeight: 280 },
    colors: { bg: '#2e2e1a', border: '#6a6a4a', icon: '📸' },
  },
];

/**
 * Plugin module
 */
export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating data nodes plugin...`);
  api.registerNodeTypes(dataNodes);
  console.log(`[${api.manifest.id}] Registered ${dataNodes.length} data node types`);
};

export const deactivate = (): void => {
  console.log('[core.data] Deactivating data nodes plugin...');
};

// Export as module
const plugin: PluginModule = { activate, deactivate };
export default plugin;
