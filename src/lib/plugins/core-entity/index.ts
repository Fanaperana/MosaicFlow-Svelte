/**
 * Core Entity Nodes Plugin
 * 
 * Provides the entity node types: Person, Organization, Timestamp
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node components
import PersonNode from '$lib/components/nodes/entity/PersonNode.svelte';
import OrganizationNode from '$lib/components/nodes/entity/OrganizationNode.svelte';
import TimestampNode from '$lib/components/nodes/entity/TimestampNode.svelte';

/**
 * Entity node type definitions
 */
const entityNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  {
    type: 'person',
    label: 'Person',
    description: 'Profile cards with contact info',
    category: 'entity',
    iconName: 'User',
    component: PersonNode,
    defaultData: {
      title: 'Person',
      name: '',
      email: '',
      phone: '',
      aliases: [],
    },
    dimensions: { minWidth: 220, minHeight: 180, defaultWidth: 280, defaultHeight: 220 },
    colors: { bg: '#2e1a2e', border: '#6a4a6a', icon: '👤' },
    quickAccess: true,
  },
  {
    type: 'organization',
    label: 'Organization',
    description: 'Company/group information',
    category: 'entity',
    iconName: 'Building2',
    component: OrganizationNode,
    defaultData: {
      title: 'Organization',
      name: '',
      type: '',
      website: '',
    },
    dimensions: { minWidth: 220, minHeight: 150, defaultWidth: 280, defaultHeight: 180 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '🏢' },
  },
  {
    type: 'timestamp',
    label: 'Timestamp',
    description: 'Date/time events',
    category: 'entity',
    iconName: 'Clock',
    component: TimestampNode,
    defaultData: {
      title: 'Timestamp',
      datetime: new Date().toISOString(),
      format: 'datetime',
    },
    dimensions: { minWidth: 180, minHeight: 100, defaultWidth: 167, defaultHeight: 28 },
    colors: { bg: '#2e2e1a', border: '#6a6a4a', icon: '⏰' },
    quickAccess: true,
  },
];

/**
 * Plugin module
 */
export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating entity nodes plugin...`);
  api.registerNodeTypes(entityNodes);
  console.log(`[${api.manifest.id}] Registered ${entityNodes.length} entity node types`);
};

export const deactivate = (): void => {
  console.log('[core.entity] Deactivating entity nodes plugin...');
};

// Export as module
const plugin: PluginModule = { activate, deactivate };
export default plugin;
