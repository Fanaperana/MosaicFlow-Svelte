// Jump to a node on any canvas (wikilinks, search results, backlinks).

import { tick } from 'svelte';
import { extractWikilinks, type IndexedNode } from '@mosaicflow/vault-core';
import { toast } from 'svelte-sonner';
import { vaultStore } from '$lib/stores/vault.svelte';
import { knowledge } from '$lib/stores/knowledge.svelte';
import type { CanvasInfo } from '$lib/services/vaultService';

let pendingFocus: string | null = null;

function focusOnCanvas(nodeId: string) {
  window.dispatchEvent(new CustomEvent('mosaicflow:focusNode', { detail: { id: nodeId } }));
}

export async function openNode(canvasId: string, nodeId: string) {
  if (vaultStore.currentCanvas?.id === canvasId) {
    focusOnCanvas(nodeId);
    return;
  }
  const canvas = vaultStore.canvases.find((c) => c.id === canvasId);
  if (!canvas) {
    toast.error('Canvas not found');
    return;
  }
  pendingFocus = nodeId;
  await vaultStore.openCanvas(canvas);
}

/** Called after a canvas finished loading. Returns whether a node was focused. */
export async function consumePendingFocus(): Promise<boolean> {
  const id = pendingFocus;
  pendingFocus = null;
  if (!id) return false;
  await tick();
  // Give the flow one frame to measure the freshly loaded nodes.
  requestAnimationFrame(() => focusOnCanvas(id));
  return true;
}

/** A canvas whose name matches, case-insensitively. */
export function findCanvasByName(name: string): CanvasInfo | undefined {
  const key = name.trim().toLowerCase();
  return key ? vaultStore.canvases.find((c) => c.name.toLowerCase() === key) : undefined;
}

export interface LinkTarget {
  canvas: CanvasInfo;
  node: IndexedNode | null;
}

/** Resolves "[[ref]]" text to a node, or to a whole page when only a canvas name matches. */
export function resolveWikilink(ref: string): LinkTarget | null {
  const [link] = extractWikilinks(`[[${ref}]]`);
  if (!link) return null;
  const node = knowledge.index.resolve(link, vaultStore.currentCanvas?.id);
  if (node) {
    const canvas = vaultStore.canvases.find((c) => c.id === node.canvasId);
    return canvas ? { canvas, node } : null;
  }
  const canvas = findCanvasByName(link.canvas ?? link.target);
  return canvas ? { canvas, node: null } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Label of a rendered [[link]]: id links show the node's current title; unresolved links are marked broken. */
export function wikilinkLabel(ref: string): { label: string; broken?: boolean } | null {
  const [link] = extractWikilinks(`[[${ref}]]`);
  if (!link) return null;
  const target = resolveWikilink(ref);
  if (target?.node) {
    return link.target.toLowerCase() === target.node.id.toLowerCase() ? { label: target.node.title || 'Untitled' } : null;
  }
  if (target) return null;
  return { label: UUID.test(link.target) ? 'Missing node' : link.target, broken: true };
}

/** Resolves "[[ref]]" text (ref may be "Canvas#Title" or a canvas name) and opens it. */
export async function openWikilink(ref: string) {
  await knowledge.loadVault();
  const target = resolveWikilink(ref);
  if (target?.node) {
    await openNode(target.canvas.id, target.node.id);
  } else if (target) {
    if (vaultStore.currentCanvas?.id !== target.canvas.id) vaultStore.openCanvas(target.canvas);
  } else {
    const [link] = extractWikilinks(`[[${ref}]]`);
    if (!link) return;
    toast.info(`No page or node titled "${link.target}"${link.canvas ? ` in ${link.canvas}` : ''}`, {
      description: 'Create a node or canvas with that title to link it.',
    });
  }
}
