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

/**
 * Safe invoke wrapper for Tauri commands
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`[API] ${command} failed:`, error);
    throw error;
  }
}
