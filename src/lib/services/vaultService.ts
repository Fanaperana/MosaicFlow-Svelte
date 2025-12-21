// Vault Service - TypeScript wrapper for Rust vault commands
// Provides type-safe interface to interact with MosaicVault system

import { invoke } from '@tauri-apps/api/core';

// Types matching Rust structs
export interface VaultInfo {
  id: string;
  path: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  canvas_count: number;
}

export interface CanvasInfo {
  id: string;
  vault_id: string;
  name: string;
  description: string;
  path: string;
  created_at: string;
  updated_at: string;
  tags: string[];
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

/**
 * Load app configuration from Rust backend
 */
export async function loadAppConfig(): Promise<AppConfig> {
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
  try {
    const result = await invoke<boolean>('save_app_config', { config });
    return result;
  } catch (error) {
    console.error('Failed to save app config:', error);
    return false;
  }
}

/**
 * Create a new vault at the specified path
 */
export async function createVault(path: string, name: string): Promise<VaultOperationResult> {
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
export async function createCanvas(vaultPath: string, vaultId: string, name: string, description?: string): Promise<CanvasInfo | null> {
  try {
    return await invoke<CanvasInfo>('create_canvas', { vaultPath, vaultId, name, description });
  } catch (error) {
    console.error('Failed to create canvas:', error);
    return null;
  }
}

/**
 * Rename a canvas
 */
export async function renameCanvas(canvasPath: string, newName: string): Promise<CanvasInfo | null> {
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
