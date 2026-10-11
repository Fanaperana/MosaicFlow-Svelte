// Net label hover state: the name lights every label of that net (like KiCad) and the hovered tag
// anchors a popover listing the net's other labels.

export interface NetAnchor {
  edgeId: string;
  end: 'source' | 'target';
  rect: { left: number; top: number; bottom: number; right: number };
}

const HIDE_DELAY = 220;

/** The net an edge in label mode belongs to: its label, or "NET" when it has none. */
export function netNameOf(label: unknown): string {
  return (typeof label === 'string' && label.trim()) || 'NET';
}

class NetHover {
  name = $state('');
  anchor = $state<NetAnchor | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  enter(name: string, edgeId: string, end: 'source' | 'target', el: HTMLElement) {
    clearTimeout(this.hideTimer);
    const r = el.getBoundingClientRect();
    this.name = name;
    this.anchor = { edgeId, end, rect: { left: r.left, top: r.top, bottom: r.bottom, right: r.right } };
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
