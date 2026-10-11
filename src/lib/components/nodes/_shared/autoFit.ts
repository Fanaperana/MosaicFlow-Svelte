// Grows a node to fit its content. When the user resizes it smaller than its content, the node
// keeps that height (data.fixedHeight) and its content scrolls; resizing it back to fit resumes growing.

import { workspace } from '$lib/stores/workspace.svelte';

const MAX_AUTO_HEIGHT = 1600;
const MAX_DEPTH = 6;
const SKIP = new Set(['IMG', 'CANVAS', 'VIDEO', 'IFRAME', 'svg']);

/** How far the content overflows vertically: the largest clipped or scrollable overflow inside `root`. */
function overflowOf(root: HTMLElement): number {
  let worst = 0;
  let level: Element[] = [root];
  for (let depth = 0; depth <= MAX_DEPTH && level.length; depth++) {
    const next: Element[] = [];
    for (const el of level) {
      if (!(el instanceof HTMLElement) || SKIP.has(el.tagName)) continue;
      const extra = el.scrollHeight - el.clientHeight;
      if (extra > 1 && el.clientHeight > 0) {
        const overflow = getComputedStyle(el).overflowY;
        if (overflow !== 'visible') {
          worst = Math.max(worst, extra);
          continue; // Content inside a clipping box is covered by its own overflow.
        }
      }
      next.push(...el.children);
    }
    level = next;
  }
  return worst;
}

export interface AutoFitOptions {
  id: string;
  /** False keeps the node at whatever size the user gives it. */
  enabled?: boolean;
}

export function autoFit(element: HTMLElement, options: AutoFitOptions) {
  let { id: nodeId, enabled = true } = options;
  let frame = 0;
  let resizing = false;
  let lastOverflow = Infinity;
  let width = -1;
  const flowNode = element.closest<HTMLElement>('.svelte-flow__node');

  function check() {
    frame = 0;
    if (!enabled || resizing || workspace.locked) return;
    const node = workspace.getNode(nodeId);
    if (!node || node.data.fixedHeight || node.data.sizeLocked) return;
    const overflow = Math.ceil(overflowOf(element));
    // Content that grows with its box (e.g. height: 100% + padding) would never fit; stop instead of looping.
    if (overflow <= 0 || overflow >= lastOverflow) {
      lastOverflow = overflow > 0 ? overflow : Infinity;
      return;
    }
    lastOverflow = overflow;
    const height = node.height ?? flowNode?.offsetHeight;
    if (!height || height >= MAX_AUTO_HEIGHT) return;
    workspace.growNode(nodeId, Math.min(height + overflow, MAX_AUTO_HEIGHT));
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(check);
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as Element | null)?.closest('.svelte-flow__resize-control')) resizing = true;
  }

  // Ending a resize decides whether the user pinned the height below the content.
  function onPointerUp() {
    if (!resizing) return;
    requestAnimationFrame(() => {
      resizing = false;
      lastOverflow = Infinity;
      const node = workspace.getNode(nodeId);
      if (!enabled || !node || workspace.locked) return;
      const clipped = overflowOf(element) > 1;
      if (clipped !== !!node.data.fixedHeight) workspace.updateNodeData(nodeId, { fixedHeight: clipped || undefined });
    });
  }

  const mutations = new MutationObserver(() => {
    lastOverflow = Infinity;
    schedule();
  });
  mutations.observe(element, { childList: true, subtree: true, characterData: true });
  // Typing in inputs and textareas changes no DOM nodes.
  const onInput = () => {
    lastOverflow = Infinity;
    schedule();
  };
  element.addEventListener('input', onInput, true);
  const resizes = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width !== width) {
      width = entry.contentRect.width;
      lastOverflow = Infinity;
    }
    schedule();
  });
  resizes.observe(element);
  element.addEventListener('load', schedule, true);
  flowNode?.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp, true);
  schedule();

  return {
    update(next: AutoFitOptions) {
      nodeId = next.id;
      enabled = next.enabled ?? true;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
      element.removeEventListener('input', onInput, true);
      element.removeEventListener('load', schedule, true);
      flowNode?.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    },
  };
}
