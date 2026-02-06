/**
 * MosaicFlow Kernel Client
 * 
 * Frontend client for communicating with the kernel runtime.
 * Provides a type-safe interface for plugin commands and events.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  KernelRequest,
  KernelResponse,
  PluginInfo,
} from './types';

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/**
 * Kernel client for invoking plugin commands
 */
class KernelClient {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the kernel
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    await this.initPromise;
    this.initialized = true;
  }

  private async _doInit(): Promise<void> {
    if (!isTauri) {
      console.log('[Kernel] Running in dev mode without Tauri');
      return;
    }

    try {
      await invoke('kernel_init');
      console.log('[Kernel] Initialized successfully');
    } catch (error) {
      console.error('[Kernel] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Invoke a plugin command
   */
  async invoke<T = unknown>(
    pluginId: string,
    command: string,
    payload: unknown = {}
  ): Promise<KernelResponse<T>> {
    const request: KernelRequest = {
      pluginId,
      command,
      payload,
      requestId: crypto.randomUUID(),
    };

    if (!isTauri) {
      // Dev mode fallback
      console.log(`[Kernel] Dev mode invoke: ${pluginId}/${command}`, payload);
      return {
        success: false,
        error: 'Kernel not available in dev mode',
        requestId: request.requestId,
      };
    }

    try {
      const response = await invoke<KernelResponse<T>>('kernel_invoke', { request });
      return response;
    } catch (error) {
      console.error(`[Kernel] Invoke failed: ${pluginId}/${command}`, error);
      return {
        success: false,
        error: String(error),
        requestId: request.requestId,
      };
    }
  }

  /**
   * Invoke and unwrap the result (throws on error)
   */
  async invokeOrThrow<T = unknown>(
    pluginId: string,
    command: string,
    payload: unknown = {}
  ): Promise<T> {
    const response = await this.invoke<T>(pluginId, command, payload);
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    
    return response.data as T;
  }

  /**
   * List all plugins
   */
  async listPlugins(): Promise<PluginInfo[]> {
    if (!isTauri) {
      return [];
    }

    try {
      return await invoke<PluginInfo[]>('kernel_list_plugins');
    } catch (error) {
      console.error('[Kernel] Failed to list plugins:', error);
      return [];
    }
  }

  /**
   * Get plugin info
   */
  async getPluginInfo(pluginId: string): Promise<PluginInfo | null> {
    if (!isTauri) {
      return null;
    }

    try {
      return await invoke<PluginInfo | null>('kernel_get_plugin_info', { pluginId });
    } catch (error) {
      console.error('[Kernel] Failed to get plugin info:', error);
      return null;
    }
  }

  /**
   * Check if kernel is initialized
   */
  async isInitialized(): Promise<boolean> {
    if (!isTauri) {
      return false;
    }

    try {
      return await invoke<boolean>('kernel_is_initialized');
    } catch (error) {
      return false;
    }
  }

  /**
   * Emit a kernel event
   */
  async emitEvent(topic: string, payload: unknown = {}): Promise<void> {
    if (!isTauri) {
      console.log(`[Kernel] Dev mode emit: ${topic}`, payload);
      return;
    }

    try {
      await invoke('kernel_emit_event', { topic, payload });
    } catch (error) {
      console.error('[Kernel] Failed to emit event:', error);
    }
  }
}

// Singleton instance
export const kernel = new KernelClient();

/**
 * Helper function for quick invokes
 */
export async function kernelInvoke<T = unknown>(
  pluginId: string,
  command: string,
  payload: unknown = {}
): Promise<KernelResponse<T>> {
  return kernel.invoke<T>(pluginId, command, payload);
}

/**
 * Helper function that throws on error
 */
export async function kernelInvokeOrThrow<T = unknown>(
  pluginId: string,
  command: string,
  payload: unknown = {}
): Promise<T> {
  return kernel.invokeOrThrow<T>(pluginId, command, payload);
}
