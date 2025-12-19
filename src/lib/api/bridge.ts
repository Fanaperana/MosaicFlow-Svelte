/**
 * MosaicFlow API Bridge
 * 
 * Centralized interface for all Rust backend communication.
 * This is the SINGLE source for all Tauri invoke calls.
 * 
 * Benefits:
 * - Single point of maintenance for API calls
 * - Automatic dev mode fallback
 * - Type-safe interface matching Rust commands
 * - Error handling standardization
 */

import { invoke } from '@tauri-apps/api/core';

// Check if we're in Tauri environment (single source of truth)
export const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/**
 * Safe invoke wrapper with dev mode fallback
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  devFallback?: () => T | Promise<T>
): Promise<T> {
  if (!isTauri) {
    if (devFallback) {
      console.log(`[DEV] ${command}`, args);
      return devFallback();
    }
    throw new Error(`Tauri not available and no fallback for: ${command}`);
  }
  
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`[API] ${command} failed:`, error);
    throw error;
  }
}
