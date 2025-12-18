// Vault Service - TypeScript wrapper for Rust vault commands
// Provides type-safe interface to interact with MosaicVault system

import { invoke } from '@tauri-apps/api/core';

// Types matching Rust structs
export interface VaultInfo {
  path: string;
  name: string;
  created_at: string;
  updated_at: string;
  canvas_count: number;
}

export interface CanvasInfo {
  id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface AppConfig {
  current_vault_path: string | null;
  recent_vaults: RecentVault[];
}

export interface RecentVault {
  name: string;
  path: string;
  last_opened: string;
}

export interface VaultOperationResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// Check if we're in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/**
 * Load app configuration from Rust backend
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (!isTauri) {
    // Fallback to localStorage for development
    const stored = localStorage.getItem('mosaicflow-vault-config');
    if (stored) {
      return JSON.parse(stored);
    }
    return { current_vault_path: null, recent_vaults: [] };
  }
  
  try {
    return await invoke<AppConfig>('load_app_config');
  } catch (error) {
    console.error('Failed to load app config:', error);
    return { current_vault_path: null, recent_vaults: [] };
  }
}

/**
 * Save app configuration to Rust backend
 */
export async function saveAppConfig(config: AppConfig): Promise<boolean> {
  if (!isTauri) {
    localStorage.setItem('mosaicflow-vault-config', JSON.stringify(config));
    return true;
  }
  
  try {
    const result = await invoke<VaultOperationResult>('save_app_config', { config });
    return result.success;
  } catch (error) {
    console.error('Failed to save app config:', error);
    return false;
  }
}

/**
 * Create a new vault at the specified path
 */
export async function createVault(path: string, name: string): Promise<VaultOperationResult> {
  if (!isTauri) {
    // Mock for development
    return {
      success: true,
      message: 'Vault created (mock)',
      data: {
        path,
        name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        canvas_count: 1,
      },
    };
  }
  
  try {
    return await invoke<VaultOperationResult>('create_vault', { path, name });
  } catch (error) {
    console.error('Failed to create vault:', error);
    return { success: false, message: String(error) };
  }
}

/**
 * Open an existing vault
 */
export async function openVault(path: string): Promise<VaultInfo | null> {
  if (!isTauri) {
    // Mock for development
    return {
      path,
      name: 'Mock Vault',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      canvas_count: 1,
    };
  }
  
  try {
    return await invoke<VaultInfo>('open_vault', { path });
  } catch (error) {
    console.error('Failed to open vault:', error);
    return null;
  }
}

/**
 * Check if a path is a valid vault
 */
export async function isValidVault(path: string): Promise<boolean> {
  if (!isTauri) {
    return false;
  }
  
  try {
    return await invoke<boolean>('is_valid_vault', { path });
  } catch (error) {
    console.error('Failed to check vault:', error);
    return false;
  }
}

/**
 * Get vault info without opening it
 */
export async function getVaultInfo(path: string): Promise<VaultInfo | null> {
  if (!isTauri) {
    return null;
  }
  
  try {
    return await invoke<VaultInfo | null>('get_vault_info', { path });
  } catch (error) {
    console.error('Failed to get vault info:', error);
    return null;
  }
}

/**
 * Rename a vault
 */
export async function renameVault(vaultPath: string, newName: string): Promise<VaultInfo | null> {
  if (!isTauri) {
    return null;
  }
  
  try {
    return await invoke<VaultInfo>('rename_vault', { vaultPath, newName });
  } catch (error) {
    console.error('Failed to rename vault:', error);
    return null;
  }
}

/**
 * List all canvases in a vault
 */
export async function listCanvases(vaultPath: string): Promise<CanvasInfo[]> {
  if (!isTauri) {
    // Mock for development
    return [
      {
        id: 'mock-canvas-1',
        name: 'Untitled',
        path: `${vaultPath}/canvases/Untitled`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }
  
  try {
    return await invoke<CanvasInfo[]>('list_canvases', { vaultPath });
  } catch (error) {
    console.error('Failed to list canvases:', error);
    return [];
  }
}

/**
 * Create a new canvas in the vault
 */
export async function createCanvas(vaultPath: string, name: string): Promise<CanvasInfo | null> {
  if (!isTauri) {
    // Mock for development
    return {
      id: `mock-${Date.now()}`,
      name,
      path: `${vaultPath}/canvases/${name}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  
  try {
    return await invoke<CanvasInfo>('create_canvas', { vaultPath, name });
  } catch (error) {
    console.error('Failed to create canvas:', error);
    return null;
  }
}

/**
 * Rename a canvas
 */
export async function renameCanvas(canvasPath: string, newName: string): Promise<CanvasInfo | null> {
  if (!isTauri) {
    return null;
  }
  
  try {
    return await invoke<CanvasInfo>('rename_canvas', { canvasPath, newName });
  } catch (error) {
    console.error('Failed to rename canvas:', error);
    return null;
  }
}

/**
 * Delete a canvas
 */
export async function deleteCanvas(canvasPath: string): Promise<boolean> {
  if (!isTauri) {
    return true;
  }
  
  try {
    const result = await invoke<VaultOperationResult>('delete_canvas', { canvasPath });
    return result.success;
  } catch (error) {
    console.error('Failed to delete canvas:', error);
    return false;
  }
}

/**
 * Format timestamp from Rust (milliseconds since epoch) to readable date
 */
export function formatTimestamp(timestamp: string): string {
  const ms = parseInt(timestamp, 10);
  if (isNaN(ms)) {
    return timestamp; // Already formatted
  }
  return new Date(ms).toISOString();
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(formatTimestamp(timestamp));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}
