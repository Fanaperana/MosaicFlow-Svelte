/**
 * Core Content Nodes Plugin
 * 
 * Provides the content node types: Note, SimpleText, Image, Link, Code, Iframe
 */

import type { PluginAPI, PluginModule } from '$lib/kernel/plugin-loader';
import type { NodeTypeRegistration } from '$lib/kernel/registries/node-registry';

// Import node components
import NoteNode from '$lib/components/nodes/content/NoteNode.svelte';
import SimpleTextNode from '$lib/components/nodes/content/SimpleTextNode.svelte';
import ImageNode from '$lib/components/nodes/content/ImageNode.svelte';
import LinkNode from '$lib/components/nodes/content/LinkNode.svelte';
import CodeNode from '$lib/components/nodes/content/CodeNode.svelte';
import IframeNode from '$lib/components/nodes/content/IframeNode.svelte';

/**
 * Content node type definitions
 */
const contentNodes: Omit<NodeTypeRegistration, 'pluginId'>[] = [
  {
    type: 'note',
    label: 'Note',
    description: 'Markdown-supported text notes',
    category: 'content',
    iconName: 'StickyNote',
    component: NoteNode,
    defaultData: {
      title: 'New Note',
      content: '',
      viewMode: 'edit',
    },
    dimensions: { minWidth: 120, minHeight: 60, defaultWidth: 280, defaultHeight: 200 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '📝' },
    quickAccess: true,
  },
  {
    type: 'simpleText',
    label: 'Simple Text',
    description: 'Plain text without formatting',
    category: 'content',
    iconName: 'Type',
    component: SimpleTextNode,
    defaultData: {
      title: 'Text',
      content: '',
      bgOpacity: 0,
      borderWidth: 0,
    },
    dimensions: { minWidth: 120, minHeight: 60, defaultWidth: 200, defaultHeight: 100 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '📄' },
  },
  {
    type: 'image',
    label: 'Image',
    description: 'Display images with drag-and-drop support',
    category: 'content',
    iconName: 'Image',
    component: ImageNode,
    defaultData: {
      title: 'Image',
      imageUrl: '',
      caption: '',
    },
    dimensions: { minWidth: 150, minHeight: 150, defaultWidth: 300, defaultHeight: 250 },
    colors: { bg: '#1a2e1a', border: '#4a6a4a', icon: '🖼️' },
    quickAccess: true,
  },
  {
    type: 'link',
    label: 'Link',
    description: 'Web URLs with descriptions',
    category: 'content',
    iconName: 'Link',
    component: LinkNode,
    defaultData: {
      title: 'Link',
      url: '',
      description: '',
    },
    dimensions: { minWidth: 200, minHeight: 100, defaultWidth: 250, defaultHeight: 140 },
    colors: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🔗' },
    quickAccess: true,
  },
  {
    type: 'code',
    label: 'Code Snippet',
    description: 'Syntax-highlighted code blocks',
    category: 'content',
    iconName: 'Code',
    component: CodeNode,
    defaultData: {
      title: 'Code',
      code: '',
      language: 'javascript',
    },
    dimensions: { minWidth: 300, minHeight: 200, defaultWidth: 400, defaultHeight: 300 },
    colors: { bg: '#1a2e2e', border: '#4a6a6a', icon: '💻' },
  },
  {
    type: 'iframe',
    label: 'Iframe',
    description: 'Embed external webpages',
    category: 'content',
    iconName: 'LayoutGrid',
    component: IframeNode,
    defaultData: {
      title: 'Embed',
      url: '',
    },
    dimensions: { minWidth: 300, minHeight: 250, defaultWidth: 500, defaultHeight: 400 },
    colors: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🖥️' },
  },
];

/**
 * Plugin module
 */
export const activate = (api: PluginAPI): void => {
  console.log(`[${api.manifest.id}] Activating content nodes plugin...`);
  api.registerNodeTypes(contentNodes);
  console.log(`[${api.manifest.id}] Registered ${contentNodes.length} content node types`);
};

export const deactivate = (): void => {
  console.log('[core.content] Deactivating content nodes plugin...');
};

// Export as module
const plugin: PluginModule = { activate, deactivate };
export default plugin;
