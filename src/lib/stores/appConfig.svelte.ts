// App configuration store
// Manages global app state including the workspace container folder

class AppConfig {
  // Main container folder for all workspaces
  containerPath = $state<string | null>(null);
  private _initialized = $state(false);
  
  // Current workspace path
  currentWorkspacePath = $state<string | null>(null);
  
  // Recent workspaces
  recentWorkspaces = $state<Array<{
    name: string;
    path: string;
    lastOpened: string;
  }>>([]);

  get initialized(): boolean {
    return this._initialized;
  }

  async initialize() {
    await this.loadConfig();
  }

  async loadConfig() {
    try {
      // Try to load from localStorage first
      const stored = localStorage.getItem('mosaicflow-config');
      if (stored) {
        const config = JSON.parse(stored);
        this.containerPath = config.containerPath || null;
        this.recentWorkspaces = config.recentWorkspaces || [];
      }
      
      this._initialized = true;
    } catch (error) {
      console.error('Failed to load config:', error);
      this._initialized = true;
    }
  }

  async saveConfig() {
    try {
      const config = {
        containerPath: this.containerPath,
        recentWorkspaces: this.recentWorkspaces,
      };
      localStorage.setItem('mosaicflow-config', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  setContainerPath(path: string) {
    this.containerPath = path;
    this.saveConfig();
  }

  addRecentWorkspace(name: string, path: string) {
    // Remove if already exists
    this.recentWorkspaces = this.recentWorkspaces.filter(w => w.path !== path);
    
    // Add to front
    this.recentWorkspaces.unshift({
      name,
      path,
      lastOpened: new Date().toISOString(),
    });
    
    // Keep only last 10
    this.recentWorkspaces = this.recentWorkspaces.slice(0, 10);
    
    this.saveConfig();
  }

  clearConfig() {
    this.containerPath = null;
    this.recentWorkspaces = [];
    this.currentWorkspacePath = null;
    localStorage.removeItem('mosaicflow-config');
  }
}

export const appConfig = new AppConfig();
