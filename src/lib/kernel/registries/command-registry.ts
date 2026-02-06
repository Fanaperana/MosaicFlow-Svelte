/**
 * Command Registry
 * 
 * Registry for commands provided by plugins.
 * Commands are actions that can be invoked via keyboard shortcuts,
 * command palette, or programmatically.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CommandRegistration {
  /** Unique command identifier (e.g., "core.save", "plugin.myAction") */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Icon name (Lucide) */
  iconName?: string;
  /** Keyboard shortcut (e.g., "Cmd+S", "Ctrl+Shift+P") */
  shortcut?: string;
  /** Command handler */
  handler: (args?: unknown) => void | Promise<void>;
  /** Plugin that provides this command */
  pluginId: string;
  /** Whether command is enabled */
  enabled?: boolean | (() => boolean);
  /** Category for grouping in command palette */
  category?: string;
}

// =============================================================================
// REGISTRY
// =============================================================================

class CommandRegistry {
  private registrations = new Map<string, CommandRegistration>();
  private listeners = new Set<() => void>();

  register(registration: CommandRegistration): void {
    const existing = this.registrations.get(registration.id);
    if (existing) {
      console.warn(
        `[CommandRegistry] Command "${registration.id}" already registered by "${existing.pluginId}", overwriting`
      );
    }

    this.registrations.set(registration.id, registration);
    this.notifyListeners();
    
    console.log(`[CommandRegistry] Registered command: ${registration.id} from ${registration.pluginId}`);
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

  get(id: string): CommandRegistration | undefined {
    return this.registrations.get(id);
  }

  has(id: string): boolean {
    return this.registrations.has(id);
  }

  getAll(): CommandRegistration[] {
    return Array.from(this.registrations.values());
  }

  getByCategory(category: string): CommandRegistration[] {
    return this.getAll().filter(reg => reg.category === category);
  }

  getEnabled(): CommandRegistration[] {
    return this.getAll().filter(reg => {
      if (typeof reg.enabled === 'function') {
        return reg.enabled();
      }
      return reg.enabled !== false;
    });
  }

  /**
   * Execute a command by ID
   */
  async execute(id: string, args?: unknown): Promise<void> {
    const reg = this.registrations.get(id);
    if (!reg) {
      console.error(`[CommandRegistry] Command not found: ${id}`);
      return;
    }

    // Check if enabled
    const enabled = typeof reg.enabled === 'function' ? reg.enabled() : reg.enabled !== false;
    if (!enabled) {
      console.warn(`[CommandRegistry] Command is disabled: ${id}`);
      return;
    }

    try {
      await reg.handler(args);
    } catch (error) {
      console.error(`[CommandRegistry] Command execution failed: ${id}`, error);
      throw error;
    }
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
        console.error('[CommandRegistry] Listener error:', e);
      }
    }
  }

  get size(): number {
    return this.registrations.size;
  }
}

export const commandRegistry = new CommandRegistry();
