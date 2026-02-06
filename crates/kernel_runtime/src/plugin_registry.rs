//! Plugin Registry
//!
//! Manages plugin discovery, loading, and lifecycle.

use std::collections::HashMap;
use parking_lot::RwLock;
use kernel_api::{
    Plugin, PluginId, PluginInfo, PluginState, PluginManifest,
    KernelError, KernelResult, BuiltinPluginRegistration,
};
use tracing::{info, warn, error, debug, instrument};

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
            warn!(plugin_id = %id, "Builtin plugin already registered");
            return Err(KernelError::PluginAlreadyRegistered { plugin_id: id });
        }

        debug!(plugin_id = %id, "Registered builtin plugin factory");
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

    /// Load a builtin plugin by ID.
    ///
    /// Validates API compatibility before loading.
    #[instrument(skip(self), fields(plugin_id = %plugin_id), name = "load_builtin")]
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

        // Validate API compatibility before initializing
        let manifest = plugin.manifest();
        if !manifest.is_compatible() {
            let err = KernelError::ApiVersionMismatch {
                required: manifest.api_version.clone(),
                current: kernel_api::KERNEL_API_VERSION.to_string(),
            };
            error!(plugin_id = %plugin_id, required = %manifest.api_version, "API version mismatch");
            return Err(err);
        }

        // Validate manifest
        if let Err(validation_errors) = manifest.validate() {
            let msg = validation_errors.join("; ");
            error!(plugin_id = %plugin_id, errors = %msg, "Manifest validation failed");
            return Err(KernelError::InvalidManifest { reason: msg });
        }
        
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

        info!(plugin_id = %plugin_id, "Plugin loaded and active");
        Ok(())
    }

    /// Unload a plugin
    #[instrument(skip(self), fields(plugin_id = %plugin_id), name = "unload_plugin")]
    pub fn unload_plugin(&self, plugin_id: &str) -> KernelResult<()> {
        let mut loaded = self.loaded_plugins.write();
        
        if let Some(mut plugin) = loaded.remove(plugin_id) {
            // Shutdown the plugin
            plugin.shutdown()?;
            
            // Update state
            if let Some(info) = self.plugin_info.write().get_mut(plugin_id) {
                info.state = PluginState::Disabled;
            }

            info!(plugin_id = %plugin_id, "Plugin unloaded");
        } else {
            debug!(plugin_id = %plugin_id, "Plugin was not loaded, nothing to unload");
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

    /// Total number of registered plugin factories
    pub fn registered_count(&self) -> usize {
        self.builtin_factories.read().len()
    }

    /// Total number of currently loaded plugins
    pub fn loaded_count(&self) -> usize {
        self.loaded_plugins.read().len()
    }

    /// Load all registered builtin plugins
    pub fn load_all_builtins(&self) -> Vec<(String, KernelResult<()>)> {
        let ids: Vec<String> = self.builtin_factories.read().keys().cloned().collect();
        info!(count = ids.len(), "Loading all builtin plugins");
        
        ids.into_iter()
            .map(|id| {
                let result = self.load_builtin(&id);
                (id, result)
            })
            .collect()
    }
}
