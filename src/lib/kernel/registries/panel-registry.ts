/**
 * Panel Registry: sidebar views contributed by plugins (shown right of the canvas).
 * Panels are framework-free, like plugin nodes: render(container, ctx) → { update?, destroy? }.
 */

/** What a panel receives on render and on every update. */
export interface PanelContext {
  /** The open page, or null when none is open. */
  page: { id: string; name: string } | null;
  /** Sanitized markdown → HTML, with [[wikilinks]] and #tags. */
  renderMarkdown: (text: string) => string;
  /** Navigate to "[[ref]]" (a node title, "Page#Title" or a page name). */
  openWikilink: (ref: string) => void;
  close: () => void;
}

/** `update` runs again whenever the page or its nodes/edges change. */
export type PanelRenderer = (
  container: HTMLElement,
  ctx: PanelContext
) => { update?: (ctx: PanelContext) => void; destroy?: () => void } | void;

export interface PanelRegistration {
  id: string;
  /** Ribbon tooltip and panel header */
  label: string;
  description?: string;
  /** Lucide icon name for the ribbon button */
  iconName?: string;
  render: PanelRenderer;
  /** Initial width in px (users can resize) */
  defaultWidth?: number;
  pluginId: string;
  /** Ribbon order (higher = first) */
  priority?: number;
}

// =============================================================================
// REGISTRY
// =============================================================================

class PanelRegistry {
  private registrations = new Map<string, PanelRegistration>();
  private listeners = new Set<() => void>();

  register(registration: PanelRegistration): void {
    const existing = this.registrations.get(registration.id);
    if (existing && existing.pluginId !== registration.pluginId) {
      throw new Error(`Panel "${registration.id}" is already registered by "${existing.pluginId}"`);
    }
    this.registrations.set(registration.id, registration);
    this.notifyListeners();
  }

  unregister(id: string): boolean {
    const removed = this.registrations.delete(id);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  unregisterByPlugin(pluginId: string): number {
    let count = 0;
    for (const [id, reg] of this.registrations) {
      if (reg.pluginId === pluginId) {
        this.registrations.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.notifyListeners();
    }
    return count;
  }

  get(id: string): PanelRegistration | undefined {
    return this.registrations.get(id);
  }

  has(id: string): boolean {
    return this.registrations.has(id);
  }

  getAll(): PanelRegistration[] {
    return Array.from(this.registrations.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.label.localeCompare(b.label)
    );
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('[PanelRegistry] Listener error:', e);
      }
    }
  }

  get size(): number {
    return this.registrations.size;
  }
}

export const panelRegistry = new PanelRegistry();
