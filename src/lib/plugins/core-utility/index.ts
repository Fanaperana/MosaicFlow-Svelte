/**
 * Core Utility Nodes Plugin
 * 
 * Provides the utility node types: Group, Map, LinkList, Action, Annotation
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node components
import GroupNode from '$lib/components/nodes/utility/GroupNode.svelte';
import MapNode from '$lib/components/nodes/utility/MapNode.svelte';
import LinkListNode from '$lib/components/nodes/utility/LinkListNode.svelte';
import ActionNode from '$lib/components/nodes/utility/ActionNode.svelte';
import AnnotationNode from '$lib/components/nodes/utility/AnnotationNode.svelte';

/**
 * Utility node type definitions
 */
const utilityNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  {
    type: 'group',
    label: 'Group',
    description: 'Container for related nodes',
    category: 'utility',
    iconName: 'FolderOpen',
    component: GroupNode,
    defaultData: {
      title: 'Group',
      collapsed: false,
    },
    dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 400, defaultHeight: 300 },
    colors: { bg: '#1a1a1a', border: '#4a4a4a', icon: '📁' },
    quickAccess: true,
  },
  {
    type: 'map',
    label: 'Map',
    description: 'Interactive map view',
    category: 'utility',
    iconName: 'Map',
    component: MapNode,
    defaultData: {
      title: 'Map',
      latitude: 0,
      longitude: 0,
      zoom: 2,
    },
    dimensions: { minWidth: 300, minHeight: 250, defaultWidth: 400, defaultHeight: 350 },
    colors: { bg: '#1a2e1a', border: '#4a6a4a', icon: '🗺️' },
  },
  {
    type: 'linkList',
    label: 'Link List',
    description: 'Collection of links',
    category: 'utility',
    iconName: 'List',
    component: LinkListNode,
    defaultData: {
      title: 'Links',
      links: [],
    },
    dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 280, defaultHeight: 220 },
    colors: { bg: '#2e1a1a', border: '#6a4a4a', icon: '📋' },
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Actionable task or button',
    category: 'utility',
    iconName: 'Zap',
    component: ActionNode,
    defaultData: {
      title: 'Action',
      actionType: 'button',
      label: 'Click me',
    },
    dimensions: { minWidth: 150, minHeight: 80, defaultWidth: 200, defaultHeight: 100 },
    colors: { bg: '#2e2e1a', border: '#6a6a4a', icon: '⚡' },
  },
  {
    type: 'annotation',
    label: 'Annotation',
    description: 'Free-form annotation or callout',
    category: 'utility',
    iconName: 'MessageCircle',
    component: AnnotationNode,
    defaultData: {
      title: '',
      content: '',
      style: 'callout',
    },
    dimensions: { minWidth: 100, minHeight: 60, defaultWidth: 200, defaultHeight: 120 },
    colors: { bg: '#2e1a2e', border: '#6a4a6a', icon: '💭' },
  },
];

/**
 * Plugin module
 */
export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating utility nodes plugin...`);
  api.registerNodeTypes(utilityNodes);
  console.log(`[${api.manifest.id}] Registered ${utilityNodes.length} utility node types`);
};

export const deactivate = (): void => {
  console.log('[core.utility] Deactivating utility nodes plugin...');
};

// Export as module
const plugin: PluginModule = { activate, deactivate };
export default plugin;
