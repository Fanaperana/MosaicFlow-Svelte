/**
 * Template and layout registries: plugin contributions that work on the open page.
 *
 * Templates insert a ready-made set of nodes and edges (one undo step).
 * Layouts rearrange existing nodes (also one undo step).
 */

import type { Point } from '@mosaicflow/vault-core';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

export interface TemplateNode {
  /** Local key, referenced by edges and `parent` within the template. */
  key: string;
  type: string;
  /** Position relative to the template's top-left (or to the parent group). */
  x: number;
  y: number;
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
  /** Key of a group node in the same template that contains this node. */
  parent?: string;
}

export interface TemplateEdge {
  from: string;
  to: string;
  label?: string;
  fromSide?: HandleSide;
  toSide?: HandleSide;
}

export interface TemplateContent {
  nodes: TemplateNode[];
  edges?: TemplateEdge[];
}

export interface TemplateRegistration {
  id: string;
  name: string;
  description?: string;
  /** Static content, or a function for templates that change (dates, prompts, ...). */
  content: TemplateContent | (() => TemplateContent | Promise<TemplateContent>);
  pluginId: string;
}

export interface LayoutInput {
  nodes: { id: string; type: string; x: number; y: number; width: number; height: number }[];
  edges: { source: string; target: string }[];
}

export interface LayoutRegistration {
  id: string;
  name: string;
  description?: string;
  /** Returns a new top-left position for (some of) the given nodes. */
  arrange: (input: LayoutInput) => Map<string, Point> | Record<string, Point> | Promise<Map<string, Point> | Record<string, Point>>;
  pluginId: string;
}

class ContributionRegistry<T extends { id: string; pluginId: string; name: string }> {
  private items = new Map<string, T>();
  private listeners = new Set<() => void>();

  register(item: T): void {
    const existing = this.items.get(item.id);
    if (existing && existing.pluginId !== item.pluginId) {
      throw new Error(`"${item.id}" is already registered by ${existing.pluginId}`);
    }
    this.items.set(item.id, item);
    this.notify();
  }

  unregisterByPlugin(pluginId: string): void {
    let changed = false;
    for (const [id, item] of this.items) {
      if (item.pluginId === pluginId) {
        this.items.delete(id);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  getAll(): T[] {
    return [...this.items.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}

export const templateRegistry = new ContributionRegistry<TemplateRegistration>();
export const layoutRegistry = new ContributionRegistry<LayoutRegistration>();

export interface ThemeRegistration {
  id: string;
  name: string;
  description?: string;
  /** CSS custom properties set on the root element, e.g. { '--mf-bg': '#101418' }. */
  variables: Record<string, string>;
  /** Extra CSS, injected while the theme is active. */
  css?: string;
  pluginId: string;
}

export const themeRegistry = new ContributionRegistry<ThemeRegistration>();
