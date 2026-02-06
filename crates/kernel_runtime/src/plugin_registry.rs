//! Plugin Registry
//!
//! Manages plugin discovery, loading, and lifecycle.

use std::collections::HashMap;
use parking_lot::RwLock;
use kernel_api::{
    Plugin, PluginId, PluginInfo, PluginState, PluginManifest,
    KernelError, KernelResult, BuiltinPluginRegistration,
};

/// Registry for managing plugins
pub struct PluginRegistry {
    /// Registered builtin plugin factories
    builtin_factories: RwLock<HashMap<PluginId, BuiltinPluginRegistration>>,
    
    /// Plugin info (metadata about discovered plugins)
    plugin_info: RwLock<HashMap<PluginId, PluginInfo>>,
    
    /// Loaded plugin instances (active plugins)
    loaded_plugins: RwLock<HashMap<PluginId, Box<dyn Plugin>>>,
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginRegistry {
    /// Create a new plugin registry
    pub fn new() -> Self {
        Self {
            builtin_factories: RwLock::new(HashMap::new()),
            plugin_info: RwLock::new(HashMap::new()),
            loaded_plugins: RwLock::new(HashMap::new()),
        }
    }

    /// Register a builtin plugin factory
    pub fn register_builtin(&self, registration: BuiltinPluginRegistration) -> KernelResult<()> {
        let id = registration.id.clone();
        
        // Check if already registered
        if self.builtin_factories.read().contains_key(&id) {
            return Err(KernelError::PluginAlreadyRegistered { plugin_id: id });
        }

        self.builtin_factories.write().insert(id, registration);
        Ok(())
    }

    /// Register plugin info from manifest
    pub fn register_plugin_info(&self, info: PluginInfo) -> KernelResult<()> {
        let id = info.manifest.id.clone();
        
        if self.plugin_info.read().contains_key(&id) {
            return Err(KernelError::PluginAlreadyRegistered { plugin_id: id });
        }

        self.plugin_info.write().insert(id, info);
        Ok(())
    }

    /// Load a builtin plugin by ID
    pub fn load_builtin(&self, plugin_id: &str) -> KernelResult<()> {
        // Get the factory
        let factory = {
            let factories = self.builtin_factories.read();
            factories.get(plugin_id).map(|r| r.factory)
        };

        let factory = factory.ok_or_else(|| KernelError::PluginNotFound {
            plugin_id: plugin_id.to_string(),
        })?;

        // Create plugin instance
        let mut plugin = factory();
        
        // Initialize it
        plugin.initialize()?;

        // Update plugin info state
        if let Some(info) = self.plugin_info.write().get_mut(plugin_id) {
            info.state = PluginState::Active;
        } else {
            // Create plugin info from manifest
            let manifest = plugin.manifest().clone();
            let mut info = PluginInfo::new(manifest, "builtin".to_string());
            info.state = PluginState::Active;
            self.plugin_info.write().insert(plugin_id.to_string(), info);
        }

        // Store the loaded plugin
        self.loaded_plugins.write().insert(plugin_id.to_string(), plugin);

        Ok(())
    }

    /// Unload a plugin
    pub fn unload_plugin(&self, plugin_id: &str) -> KernelResult<()> {
        let mut loaded = self.loaded_plugins.write();
        
        if let Some(mut plugin) = loaded.remove(plugin_id) {
            // Shutdown the plugin
            plugin.shutdown()?;
            
            // Update state
            if let Some(info) = self.plugin_info.write().get_mut(plugin_id) {
                info.state = PluginState::Disabled;
            }
        }

        Ok(())
    }

    /// Get a loaded plugin reference
    pub fn get_plugin(&self, plugin_id: &str) -> Option<impl std::ops::Deref<Target = Box<dyn Plugin>> + '_> {
        let guard = self.loaded_plugins.read();
        if guard.contains_key(plugin_id) {
            Some(parking_lot::RwLockReadGuard::map(guard, |m| m.get(plugin_id).unwrap()))
        } else {
            None
        }
    }

    /// Check if a plugin is loaded
    pub fn is_loaded(&self, plugin_id: &str) -> bool {
        self.loaded_plugins.read().contains_key(plugin_id)
    }

    /// Get plugin info
    pub fn get_plugin_info(&self, plugin_id: &str) -> Option<PluginInfo> {
        self.plugin_info.read().get(plugin_id).cloned()
    }

    /// Get all plugin infos
    pub fn list_plugins(&self) -> Vec<PluginInfo> {
        self.plugin_info.read().values().cloned().collect()
    }

    /// Get all loaded plugin IDs
    pub fn list_loaded_plugins(&self) -> Vec<String> {
        self.loaded_plugins.read().keys().cloned().collect()
    }

    /// Get plugin manifest
    pub fn get_manifest(&self, plugin_id: &str) -> Option<PluginManifest> {
        self.plugin_info
            .read()
            .get(plugin_id)
            .map(|info| info.manifest.clone())
    }

    /// Load all registered builtin plugins
    pub fn load_all_builtins(&self) -> Vec<(String, KernelResult<()>)> {
        let ids: Vec<String> = self.builtin_factories.read().keys().cloned().collect();
        
        ids.into_iter()
            .map(|id| {
                let result = self.load_builtin(&id);
                (id, result)
            })
            .collect()
    }
}
