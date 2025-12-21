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

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/**
 * Safe invoke wrapper for Tauri commands
 * Falls back to devFallback function in dev mode (browser without Tauri)
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  devFallback?: () => T | Promise<T>
): Promise<T> {
  // In dev mode (no Tauri), use fallback if provided
  if (!isTauri) {
    if (devFallback) {
      console.log(`[DEV] ${command} using fallback`);
      return devFallback();
    }
    throw new Error(`[DEV] No fallback for ${command}`);
  }
  
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`[API] ${command} failed:`, error);
    throw error;
  }
}
