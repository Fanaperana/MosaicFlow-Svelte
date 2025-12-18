// MosaicVault Store
// Manages the vault state including current vault, canvases, and configuration

import {
  type VaultInfo,
  type CanvasInfo,
  type AppConfig,
  type RecentVault,
  loadAppConfig,
  saveAppConfig,
  createVault as createVaultApi,
  openVault as openVaultApi,
  listCanvases as listCanvasesApi,
  createCanvas as createCanvasApi,
  renameCanvas as renameCanvasApi,
  deleteCanvas as deleteCanvasApi,
  renameVault as renameVaultApi,
  formatRelativeTime,
} from '$lib/services/vaultService';

// App view states
export type AppView = 'vault-picker' | 'canvas-list' | 'canvas';

class VaultStore {
  // Configuration
  private _config = $state<AppConfig>({
    current_vault_path: null,
    recent_vaults: [],
  });
  
  // Current vault
  currentVault = $state<VaultInfo | null>(null);
  
  // Canvases in current vault
  canvases = $state<CanvasInfo[]>([]);
  
  // Current canvas being edited
  currentCanvas = $state<CanvasInfo | null>(null);
  
  // App view state
  appView = $state<AppView>('vault-picker');
  
  // Loading states
  isLoading = $state(false);
  isInitialized = $state(false);
  
  // Error state
  error = $state<string | null>(null);

  // Getters
  get config(): AppConfig {
    return this._config;
  }

  get recentVaults(): RecentVault[] {
    return this._config.recent_vaults;
  }

  get hasVault(): boolean {
    return this.currentVault !== null;
  }

  get hasCanvas(): boolean {
    return this.currentCanvas !== null;
  }

  get currentVaultPath(): string | null {
    return this.currentVault?.path ?? null;
  }

  get currentCanvasPath(): string | null {
    return this.currentCanvas?.path ?? null;
  }

  /**
   * Initialize the vault store
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.isLoading = true;
    this.error = null;
    
    try {
      // Load configuration
      this._config = await loadAppConfig();
      
      // If there's a current vault path, try to open it
      if (this._config.current_vault_path) {
        const vault = await openVaultApi(this._config.current_vault_path);
        if (vault) {
          this.currentVault = vault;
          this.canvases = await listCanvasesApi(vault.path);
          
          // If there's only one canvas, open it directly
          if (this.canvases.length === 1) {
            this.currentCanvas = this.canvases[0];
            this.appView = 'canvas';
          } else if (this.canvases.length > 0) {
            this.appView = 'canvas-list';
          } else {
            // Create a default canvas
            const newCanvas = await createCanvasApi(vault.path, 'Untitled');
            if (newCanvas) {
              this.canvases = [newCanvas];
              this.currentCanvas = newCanvas;
              this.appView = 'canvas';
            }
          }
        } else {
          // Vault no longer exists, clear it
          this._config.current_vault_path = null;
          await this.saveConfig();
        }
      }
      
      this.isInitialized = true;
    } catch (err) {
      this.error = String(err);
      console.error('Failed to initialize vault store:', err);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Save configuration
   */
  private async saveConfig(): Promise<void> {
    await saveAppConfig(this._config);
  }

  /**
   * Add vault to recent list
   */
  private addToRecent(vault: VaultInfo): void {
    // Remove if already exists
    this._config.recent_vaults = this._config.recent_vaults.filter(
      (v) => v.path !== vault.path
    );
    
    // Add to front
    this._config.recent_vaults.unshift({
      name: vault.name,
      path: vault.path,
      last_opened: new Date().toISOString(),
    });
    
    // Keep only last 10
    this._config.recent_vaults = this._config.recent_vaults.slice(0, 10);
    
    this.saveConfig();
  }

  /**
   * Remove vault from recent list
   */
  removeFromRecent(path: string): void {
    this._config.recent_vaults = this._config.recent_vaults.filter(
      (v) => v.path !== path
    );
    this.saveConfig();
  }

  /**
   * Create a new vault
   */
  async createVault(parentPath: string, name: string): Promise<VaultInfo | null> {
    this.isLoading = true;
    this.error = null;
    
    try {
      const vaultPath = `${parentPath}/${name.replace(/[^a-zA-Z0-9-_\s]/g, '_')}`;
      const result = await createVaultApi(vaultPath, name);
      
      if (result.success && result.data) {
        const vault = result.data as VaultInfo;
        this.currentVault = vault;
        this._config.current_vault_path = vault.path;
        this.addToRecent(vault);
        
        // Load canvases (should have one default "Untitled" canvas)
        this.canvases = await listCanvasesApi(vault.path);
        
        // Open the first canvas directly
        if (this.canvases.length > 0) {
          this.currentCanvas = this.canvases[0];
          this.appView = 'canvas';
        }
        
        return vault;
      } else {
        this.error = result.message;
        return null;
      }
    } catch (err) {
      this.error = String(err);
      console.error('Failed to create vault:', err);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Open an existing vault
   */
  async openVault(path: string): Promise<VaultInfo | null> {
    this.isLoading = true;
    this.error = null;
    
    try {
      const vault = await openVaultApi(path);
      
      if (vault) {
        this.currentVault = vault;
        this._config.current_vault_path = vault.path;
        this.addToRecent(vault);
        
        // Load canvases
        this.canvases = await listCanvasesApi(vault.path);
        
        // If there's only one canvas, open it directly
        if (this.canvases.length === 1) {
          this.currentCanvas = this.canvases[0];
          this.appView = 'canvas';
        } else if (this.canvases.length > 0) {
          // Show canvas list if multiple canvases
          this.appView = 'canvas-list';
        } else {
          // Create a default canvas
          const newCanvas = await createCanvasApi(vault.path, 'Untitled');
          if (newCanvas) {
            this.canvases = [newCanvas];
            this.currentCanvas = newCanvas;
            this.appView = 'canvas';
          }
        }
        
        return vault;
      } else {
        this.error = 'Failed to open vault';
        return null;
      }
    } catch (err) {
      this.error = String(err);
      console.error('Failed to open vault:', err);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Close current vault and go back to vault picker
   */
  closeVault(): void {
    this.currentVault = null;
    this.currentCanvas = null;
    this.canvases = [];
    this._config.current_vault_path = null;
    this.appView = 'vault-picker';
    this.saveConfig();
  }

  /**
   * Create a new canvas in current vault
   */
  async createCanvas(name: string = 'Untitled'): Promise<CanvasInfo | null> {
    if (!this.currentVault) {
      this.error = 'No vault open';
      return null;
    }
    
    this.isLoading = true;
    this.error = null;
    
    try {
      const canvas = await createCanvasApi(this.currentVault.path, name);
      
      if (canvas) {
        this.canvases = [...this.canvases, canvas];
        this.currentCanvas = canvas;
        this.appView = 'canvas';
        return canvas;
      } else {
        this.error = 'Failed to create canvas';
        return null;
      }
    } catch (err) {
      this.error = String(err);
      console.error('Failed to create canvas:', err);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Open a canvas
   */
  openCanvas(canvas: CanvasInfo): void {
    this.currentCanvas = canvas;
    this.appView = 'canvas';
  }

  /**
   * Close current canvas and show canvas list
   */
  closeCanvas(): void {
    this.currentCanvas = null;
    this.appView = this.canvases.length > 0 ? 'canvas-list' : 'vault-picker';
  }

  /**
   * Rename current canvas
   */
  async renameCurrentCanvas(newName: string): Promise<boolean> {
    if (!this.currentCanvas) return false;
    
    try {
      const updatedCanvas = await renameCanvasApi(this.currentCanvas.path, newName);
      
      if (updatedCanvas) {
        // Update in canvases list
        this.canvases = this.canvases.map((c) =>
          c.id === this.currentCanvas!.id ? updatedCanvas : c
        );
        this.currentCanvas = updatedCanvas;
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to rename canvas:', err);
      return false;
    }
  }

  /**
   * Delete a canvas
   */
  async deleteCanvasById(canvasPath: string): Promise<boolean> {
    try {
      const success = await deleteCanvasApi(canvasPath);
      
      if (success) {
        this.canvases = this.canvases.filter((c) => c.path !== canvasPath);
        
        // If we deleted the current canvas, close it
        if (this.currentCanvas?.path === canvasPath) {
          this.currentCanvas = null;
          
          if (this.canvases.length > 0) {
            this.appView = 'canvas-list';
          } else {
            // Create a new default canvas
            await this.createCanvas('Untitled');
          }
        }
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete canvas:', err);
      return false;
    }
  }

  /**
   * Rename current vault
   */
  async renameCurrentVault(newName: string): Promise<boolean> {
    if (!this.currentVault) return false;
    
    try {
      const updatedVault = await renameVaultApi(this.currentVault.path, newName);
      
      if (updatedVault) {
        this.currentVault = updatedVault;
        this._config.current_vault_path = updatedVault.path;
        
        // Update in recent list
        this._config.recent_vaults = this._config.recent_vaults.map((v) =>
          v.path === this.currentVault!.path
            ? { ...v, name: newName, path: updatedVault.path }
            : v
        );
        
        await this.saveConfig();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to rename vault:', err);
      return false;
    }
  }

  /**
   * Refresh canvases list
   */
  async refreshCanvases(): Promise<void> {
    if (!this.currentVault) return;
    
    try {
      this.canvases = await listCanvasesApi(this.currentVault.path);
    } catch (err) {
      console.error('Failed to refresh canvases:', err);
    }
  }

  /**
   * Format relative time helper
   */
  formatRelativeTime(timestamp: string): string {
    return formatRelativeTime(timestamp);
  }
}

export const vaultStore = new VaultStore();
