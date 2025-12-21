/**
 * Vault API
 * 
 * All vault-related backend operations.
 */

import { safeInvoke } from './bridge';
import type { VaultInfo } from './types';
import { devStorage } from './dev-storage';

export async function create(
  path: string,
  name: string,
  description?: string
): Promise<VaultInfo> {
  return safeInvoke('create_vault', { path, name, description }, () =>
    devStorage.createVault(path, name, description)
  );
}

export async function open(path: string): Promise<VaultInfo> {
  return safeInvoke('open_vault', { path }, () =>
    devStorage.openVault(path)
  );
}

export async function rename(vaultPath: string, newName: string): Promise<VaultInfo> {
  return safeInvoke('rename_vault', { vaultPath, newName }, () =>
    devStorage.renameVault(vaultPath, newName)
  );
}

export async function updateDescription(
  vaultPath: string,
  description: string
): Promise<VaultInfo> {
  return safeInvoke('update_vault_description', {
    vaultPath,
    description
  });
}

export async function isValid(path: string): Promise<boolean> {
  return safeInvoke('is_valid_vault', { path }, () =>
    devStorage.isValidVault(path)
  );
}

export async function getInfo(path: string): Promise<VaultInfo | null> {
  return safeInvoke('get_vault_info', { path }, () =>
    devStorage.getVaultInfo(path)
  );
}
