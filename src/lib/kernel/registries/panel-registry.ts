/**
 * Panel Registry
 * 
 * Registry for panel components provided by plugins.
 * Panels are UI components that can be displayed in sidebars, modals, etc.
 */

import type { Component } from 'svelte';

// =============================================================================
// TYPES
// =============================================================================

export type PanelLocation = 
  | 'left-sidebar'
  | 'right-sidebar'
  | 'bottom-panel'
  | 'modal'
  | 'floating';

export interface PanelRegistration {
  /** Unique panel identifier */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Icon name (Lucide) */
  iconName?: string;
  /** Svelte component */
  component: Component;
  /** Preferred location */
  location: PanelLocation;
  /** Default width (for sidebars) */
  defaultWidth?: number;
  /** Default height (for bottom panels) */
  defaultHeight?: number;
  /** Plugin that provides this panel */
  pluginId: string;
  /** Priority for ordering (higher = first) */
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
    if (existing) {
      console.warn(
        `[PanelRegistry] Panel "${registration.id}" already registered by "${existing.pluginId}", overwriting`
      );
    }

    this.registrations.set(registration.id, registration);
    this.notifyListeners();
    
    console.log(`[PanelRegistry] Registered panel: ${registration.id} from ${registration.pluginId}`);
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
    return Array.from(this.registrations.values());
  }

  getByLocation(location: PanelLocation): PanelRegistration[] {
    return this.getAll()
      .filter(reg => reg.location === location)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
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
