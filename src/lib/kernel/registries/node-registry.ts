/**
 * Node Type Registry
 * 
 * Registry for node types provided by plugins.
 * This is the new plugin-based registry that replaces the hardcoded node definitions.
 */

import type { MosaicNodeData } from '$lib/types';

// =============================================================================
// TYPES
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeComponent = any; // Using any to avoid complex SvelteFlow NodeProps typing

export type NodeCategory = 'content' | 'entity' | 'data' | 'utility' | 'custom';

export interface NodeDimensions {
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

export interface NodeColors {
  bg: string;
  border: string;
  icon: string; // emoji for SVG export
}

/**
 * Node type registration from a plugin
 */
export interface NodeTypeRegistration {
  /** Unique node type identifier */
  type: string;
  /** Display label for UI */
  label: string;
  /** Short description for tooltips/palettes */
  description: string;
  /** Node category for grouping */
  category: NodeCategory;
  /** Lucide icon name */
  iconName: string;
  /** Svelte component for rendering */
  component: NodeComponent;
  /** Default data when creating new node */
  defaultData: Partial<MosaicNodeData>;
  /** Size constraints */
  dimensions: NodeDimensions;
  /** Colors for SVG export */
  colors: NodeColors;
  /** Show in quick access toolbar */
  quickAccess?: boolean;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Plugin that provides this node */
  pluginId: string;
}

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Node type registry - manages all registered node types
 */
class NodeRegistry {
  private registrations = new Map<string, NodeTypeRegistration>();
  private listeners = new Set<() => void>();

  /**
   * Register a node type
   */
  register(registration: NodeTypeRegistration): void {
    const existing = this.registrations.get(registration.type);
    if (existing) {
      console.warn(
        `[NodeRegistry] Node type "${registration.type}" already registered by "${existing.pluginId}", overwriting with "${registration.pluginId}"`
      );
    }

    this.registrations.set(registration.type, registration);
    this.notifyListeners();
    
    console.log(`[NodeRegistry] Registered node type: ${registration.type} from ${registration.pluginId}`);
  }

  /**
   * Register multiple node types at once
   */
  registerAll(registrations: NodeTypeRegistration[]): void {
    for (const reg of registrations) {
      this.registrations.set(reg.type, reg);
    }
    this.notifyListeners();
    
    console.log(`[NodeRegistry] Registered ${registrations.length} node types`);
  }

  /**
   * Unregister a node type
   */
  unregister(type: string): boolean {
    const removed = this.registrations.delete(type);
    if (removed) {
      this.notifyListeners();
      console.log(`[NodeRegistry] Unregistered node type: ${type}`);
    }
    return removed;
  }

  /**
   * Unregister all node types from a plugin
   */
  unregisterByPlugin(pluginId: string): number {
    let count = 0;
    for (const [type, reg] of this.registrations) {
      if (reg.pluginId === pluginId) {
        this.registrations.delete(type);
        count++;
      }
    }
    if (count > 0) {
      this.notifyListeners();
      console.log(`[NodeRegistry] Unregistered ${count} node types from ${pluginId}`);
    }
    return count;
  }

  /**
   * Get a node type registration
   */
  get(type: string): NodeTypeRegistration | undefined {
    return this.registrations.get(type);
  }

  /**
   * Check if a node type is registered
   */
  has(type: string): boolean {
    return this.registrations.has(type);
  }

  /**
   * Get all registrations
   */
  getAll(): NodeTypeRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get all registrations as a map
   */
  getAllAsMap(): Map<string, NodeTypeRegistration> {
    return new Map(this.registrations);
  }

  /**
   * Get registrations by category
   */
  getByCategory(category: NodeCategory): NodeTypeRegistration[] {
    return this.getAll().filter(reg => reg.category === category);
  }

  /**
   * Get registrations grouped by category
   */
  getGroupedByCategory(): Map<NodeCategory, NodeTypeRegistration[]> {
    const groups = new Map<NodeCategory, NodeTypeRegistration[]>();
    
    for (const reg of this.registrations.values()) {
      const list = groups.get(reg.category) || [];
      list.push(reg);
      groups.set(reg.category, list);
    }
    
    return groups;
  }

  /**
   * Get quick access nodes
   */
  getQuickAccess(): NodeTypeRegistration[] {
    return this.getAll().filter(reg => reg.quickAccess);
  }

  /**
   * Get node types object for xyflow
   */
  getNodeTypes(): Record<string, NodeComponent> {
    const types: Record<string, NodeComponent> = {};
    for (const [type, reg] of this.registrations) {
      types[type] = reg.component;
    }
    return types;
  }

  /**
   * Get default data for a node type
   */
  getDefaultData(type: string): Partial<MosaicNodeData> {
    const reg = this.registrations.get(type);
    return reg?.defaultData ?? { title: 'New Node' };
  }

  /**
   * Get dimensions for a node type
   */
  getDimensions(type: string): NodeDimensions {
    const reg = this.registrations.get(type);
    return reg?.dimensions ?? {
      minWidth: 100,
      minHeight: 60,
      defaultWidth: 200,
      defaultHeight: 150,
    };
  }

  /**
   * Get colors for a node type
   */
  getColors(type: string): NodeColors {
    const reg = this.registrations.get(type);
    return reg?.colors ?? {
      bg: '#1a1a2e',
      border: '#4a4a6a',
      icon: '📦',
    };
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('[NodeRegistry] Listener error:', e);
      }
    }
  }

  /**
   * Get count of registered types
   */
  get size(): number {
    return this.registrations.size;
  }
}

// Singleton instance
export const nodeRegistry = new NodeRegistry();
