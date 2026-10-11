// Net labels: tags on node sides (many-to-many) and edges shown as labels (one-to-one). Labels with the
// same name on a page form one net. Hovering a tag lights the whole net and anchors a popover listing it.

import { workspace } from './workspace.svelte';
import type { NodeNetLabel, NodeSide } from '$lib/types';

export interface NetAnchor {
  /** Member key of the hovered tag (see NetMember.key). */
  key: string;
  rect: { left: number; top: number; bottom: number; right: number };
}

export interface NetMember {
  /** `node:<nodeId>:<labelId>` or `edge:<edgeId>:<source|target>`. */
  key: string;
  nodeId: string;
  side?: NodeSide;
  /** For edge labels: the edge, so the two ends of one edge can be told apart. */
  edgeId?: string;
}

const HIDE_DELAY = 220;

/** The net an edge in label mode belongs to: its label, or "NET" when it has none. */
export function netNameOf(label: unknown): string {
  return (typeof label === 'string' && label.trim()) || 'NET';
}

export function nodeNetLabels(data: Record<string, unknown> | undefined): NodeNetLabel[] {
  return Array.isArray(data?.netLabels) ? (data.netLabels as NodeNetLabel[]) : [];
}

const sideOf = (handle: string | null | undefined) => (handle?.split('-')[0] as NodeSide | undefined) ?? undefined;

/** Every label of a net on the open page. */
export function netMembers(name: string): NetMember[] {
  const out: NetMember[] = [];
  for (const n of workspace.nodes) {
    for (const l of nodeNetLabels(n.data)) if (l.name === name) out.push({ key: `node:${n.id}:${l.id}`, nodeId: n.id, side: l.side });
  }
  for (const e of workspace.edges) {
    if (e.data?.display !== 'label' || netNameOf(e.label) !== name) continue;
    out.push({ key: `edge:${e.id}:source`, nodeId: e.source, side: sideOf(e.sourceHandle), edgeId: e.id });
    out.push({ key: `edge:${e.id}:target`, nodeId: e.target, side: sideOf(e.targetHandle), edgeId: e.id });
  }
  return out;
}

/** Names of the nets on the open page with their label counts, most used first. */
export function netNames(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  const add = (name: string, n = 1) => counts.set(name, (counts.get(name) ?? 0) + n);
  for (const n of workspace.nodes) for (const l of nodeNetLabels(n.data)) add(l.name);
  for (const e of workspace.edges) if (e.data?.display === 'label') add(netNameOf(e.label), 2);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

class NetHover {
  name = $state('');
  anchor = $state<NetAnchor | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  enter(name: string, key: string, el: HTMLElement) {
    clearTimeout(this.hideTimer);
    const r = el.getBoundingClientRect();
    this.name = name;
    this.anchor = { key, rect: { left: r.left, top: r.top, bottom: r.bottom, right: r.right } };
  }

  /** Hides after a short delay so the pointer can move from the tag into the popover. */
  leave() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.close(), HIDE_DELAY);
  }

  hold() {
    clearTimeout(this.hideTimer);
  }

  close() {
    clearTimeout(this.hideTimer);
    this.name = '';
    this.anchor = null;
  }
}

export const netHover = new NetHover();
