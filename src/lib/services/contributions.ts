// Applies template and layout contributions (from plugins or built in) to the open page.

import { toast } from 'svelte-sonner';
import { autoLayout, gridLayout, type Point } from '@mosaicflow/vault-core';
import { workspace } from '$lib/stores/workspace.svelte';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import {
  layoutRegistry,
  templateRegistry,
  type LayoutInput,
  type TemplateContent,
} from '$lib/kernel/registries/contribution-registry';
import type { MosaicNode, NodeType } from '$lib/types';

function sizeOf(n: MosaicNode) {
  return { width: n.width ?? n.measured?.width ?? 200, height: n.height ?? n.measured?.height ?? 100 };
}

/** Inserts a template at the centre of the view (or `at`) as one undo step; returns the new node ids. */
export async function insertTemplate(id: string, at?: Point): Promise<string[]> {
  const template = templateRegistry.get(id);
  if (!template) throw new Error(`Template not found: ${id}`);
  if (workspace.locked) {
    toast.warning('This page is view only');
    return [];
  }
  const content: TemplateContent = typeof template.content === 'function' ? await template.content() : template.content;
  const nodes = content.nodes.filter((n) => nodeRegistry.has(n.type));
  const skipped = content.nodes.length - nodes.length;
  if (nodes.length === 0) throw new Error(`Template "${template.name}" has no node types that are available`);

  // Centre the template's top-level bounds on the view.
  const top = nodes.filter((n) => !n.parent);
  const dims = (n: (typeof nodes)[number]) => {
    const d = nodeRegistry.getDimensions(n.type);
    return { width: n.width ?? d.defaultWidth, height: n.height ?? d.defaultHeight };
  };
  const minX = Math.min(...top.map((n) => n.x));
  const minY = Math.min(...top.map((n) => n.y));
  const maxX = Math.max(...top.map((n) => n.x + dims(n).width));
  const maxY = Math.max(...top.map((n) => n.y + dims(n).height));
  const { x: vx, y: vy, zoom } = workspace.viewport;
  const origin = at ?? {
    x: (window.innerWidth / 2 - vx) / zoom - (maxX - minX) / 2,
    y: (window.innerHeight / 2 - vy) / zoom - (maxY - minY) / 2,
  };

  workspace.saveToHistory();
  const ids = new Map<string, string>();
  // Parents first so children can reference them.
  const ordered = [...nodes].sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
  for (const n of ordered) {
    const parentId = n.parent ? ids.get(n.parent) : undefined;
    const position = parentId ? { x: n.x, y: n.y } : { x: origin.x + n.x - minX, y: origin.y + n.y - minY };
    const created = workspace.createNode(n.type as NodeType, position, n.data, { recordHistory: false, size: dims(n) });
    ids.set(n.key, created.id);
    if (parentId) workspace.updateNode(created.id, { parentId });
  }
  for (const e of content.edges ?? []) {
    const source = ids.get(e.from);
    const target = ids.get(e.to);
    if (!source || !target) continue;
    workspace.createEdge(source, target, e.label, e.fromSide ? `${e.fromSide}-source` : undefined, e.toSide ? `${e.toSide}-target` : undefined, { recordHistory: false });
  }
  const created = [...ids.values()];
  workspace.setSelectedNodes(created);
  if (skipped) toast.warning(`${skipped} node${skipped === 1 ? '' : 's'} skipped: their node type isn't installed`);
  return created;
}

/**
 * Rearranges nodes with a layout: the selection when 2+ sibling nodes are selected, else every
 * top-level node. One undo step.
 */
export async function applyLayout(id: string): Promise<number> {
  const layout = layoutRegistry.get(id);
  if (!layout) throw new Error(`Layout not found: ${id}`);
  if (workspace.locked) {
    toast.warning('This page is view only');
    return 0;
  }
  const selected = workspace.nodes.filter((n) => workspace.selectedNodeIds.includes(n.id));
  const parent = selected[0]?.parentId;
  const targets = selected.length >= 2 && selected.every((n) => n.parentId === parent)
    ? selected
    : workspace.nodes.filter((n) => !n.parentId);
  if (targets.length < 2) return 0;

  const ids = new Set(targets.map((n) => n.id));
  const input: LayoutInput = {
    nodes: targets.map((n) => ({ id: n.id, type: n.type, x: n.position.x, y: n.position.y, ...sizeOf(n) })),
    edges: workspace.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ source: e.source, target: e.target })),
  };
  const result = await layout.arrange(input);
  const positions = result instanceof Map ? result : new Map(Object.entries(result));

  workspace.saveToHistory();
  let moved = 0;
  for (const n of targets) {
    const p = positions.get(n.id);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x === n.position.x && p.y === n.position.y) continue;
    workspace.updateNode(n.id, { position: { x: p.x, y: p.y } });
    moved++;
  }
  window.dispatchEvent(new CustomEvent('mosaicflow:fitView', { detail: { padding: 0.15, duration: 300 } }));
  return moved;
}

/** Layouts every user gets; plugins add more with api.registerLayouts(). */
export function registerCoreLayouts() {
  const originOf = (input: LayoutInput) => ({ x: Math.min(...input.nodes.map((n) => n.x)), y: Math.min(...input.nodes.map((n) => n.y)) });
  layoutRegistry.register({
    id: 'core.flow-right',
    name: 'Flow left to right',
    description: 'Follows the connections, sources on the left',
    pluginId: 'core',
    arrange: (input) => autoLayout(input.nodes, input.edges, { direction: 'LR', origin: originOf(input) }),
  });
  layoutRegistry.register({
    id: 'core.flow-down',
    name: 'Flow top to bottom',
    description: 'Follows the connections, sources at the top',
    pluginId: 'core',
    arrange: (input) => autoLayout(input.nodes, input.edges, { direction: 'TB', origin: originOf(input) }),
  });
  layoutRegistry.register({
    id: 'core.grid',
    name: 'Grid',
    description: 'Even rows and columns, ignoring connections',
    pluginId: 'core',
    arrange: (input) => gridLayout(input.nodes, { origin: originOf(input) }),
  });
}
