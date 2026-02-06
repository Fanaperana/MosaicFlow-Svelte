//! Kernel
//!
//! The main kernel that ties together all runtime components.

use std::sync::Arc;
use kernel_api::{
    KernelRequest, KernelResponse, KernelEvent, EventTopic,
    PluginInfo, BuiltinPluginRegistration, KernelResult,
};
use crate::{
    plugin_registry::PluginRegistry,
    dispatcher::CommandDispatcher,
    event_bus::EventBus,
    policy::PolicyChecker,
};

/// The MosaicFlow kernel
pub struct Kernel {
    /// Plugin registry
    pub registry: Arc<PluginRegistry>,
    
    /// Command dispatcher
    pub dispatcher: CommandDispatcher,
    
    /// Event bus
    pub event_bus: Arc<EventBus>,
    
    /// Policy checker
    pub policy: Arc<PolicyChecker>,
    
    /// Whether kernel is initialized
    initialized: bool,
}

impl Kernel {
    /// Create a new kernel instance
    pub fn new() -> Self {
        let registry = Arc::new(PluginRegistry::new());
        let event_bus = Arc::new(EventBus::default());
        let policy = Arc::new(PolicyChecker::default());
        let dispatcher = CommandDispatcher::new(Arc::clone(&registry));

        Self {
            registry,
            dispatcher,
            event_bus,
            policy,
            initialized: false,
        }
    }

    /// Initialize the kernel and load all builtin plugins
    pub fn initialize(&mut self) -> KernelResult<()> {
        if self.initialized {
            return Ok(());
        }

        // Emit initialization started event
        self.event_bus.emit_kernel(
            EventTopic::Custom("kernel:initializing".to_string()),
            serde_json::json!({}),
        );

        // Load all registered builtin plugins
        let results = self.registry.load_all_builtins();
        
        // Emit events for each plugin
        for (id, result) in &results {
            match result {
                Ok(_) => {
                    self.event_bus.emit_kernel(
                        EventTopic::PluginLoaded,
                        serde_json::json!({ "pluginId": id }),
                    );
                }
                Err(e) => {
                    self.event_bus.emit_kernel(
                        EventTopic::PluginError,
                        serde_json::json!({ 
                            "pluginId": id, 
                            "error": format!("{}", e) 
                        }),
                    );
                }
            }
        }

        self.initialized = true;

        // Emit initialization complete event
        self.event_bus.emit_kernel(
            EventTopic::Custom("kernel:initialized".to_string()),
            serde_json::json!({
                "loadedPlugins": results.iter()
                    .filter(|(_, r)| r.is_ok())
                    .map(|(id, _)| id)
                    .collect::<Vec<_>>()
            }),
        );

        Ok(())
    }

    /// Register a builtin plugin
    pub fn register_builtin(&self, registration: BuiltinPluginRegistration) -> KernelResult<()> {
        self.registry.register_builtin(registration)
    }

    /// Invoke a plugin command
    pub fn invoke(&self, request: &KernelRequest) -> KernelResponse {
        self.dispatcher.dispatch(request)
    }

    /// Invoke with raw parameters (convenience method)
    pub fn invoke_raw(
        &self,
        plugin_id: &str,
        command: &str,
        payload: serde_json::Value,
    ) -> KernelResponse {
        let request = KernelRequest::new(plugin_id, command, payload);
        self.invoke(&request)
    }

    /// Emit an event
    pub fn emit(&self, event: KernelEvent) {
        self.event_bus.emit(event);
    }

    /// Emit a kernel event
    pub fn emit_kernel(&self, topic: EventTopic, payload: serde_json::Value) {
        self.event_bus.emit_kernel(topic, payload);
    }

    /// Get plugin info
    pub fn get_plugin_info(&self, plugin_id: &str) -> Option<PluginInfo> {
        self.registry.get_plugin_info(plugin_id)
    }

    /// List all plugins
    pub fn list_plugins(&self) -> Vec<PluginInfo> {
        self.registry.list_plugins()
    }

    /// List loaded plugin IDs
    pub fn list_loaded_plugins(&self) -> Vec<String> {
        self.registry.list_loaded_plugins()
    }

    /// Check if kernel is initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }

    /// Shutdown the kernel
    pub fn shutdown(&mut self) -> KernelResult<()> {
        // Emit shutdown event
        self.event_bus.emit_kernel(
            EventTopic::Custom("kernel:shutdown".to_string()),
            serde_json::json!({}),
        );

        // Unload all plugins
        for id in self.registry.list_loaded_plugins() {
            let _ = self.registry.unload_plugin(&id);
            self.event_bus.emit_kernel(
                EventTopic::PluginUnloaded,
                serde_json::json!({ "pluginId": id }),
            );
        }

        self.initialized = false;
        Ok(())
    }
}

impl Default for Kernel {
    fn default() -> Self {
        Self::new()
    }
}

// Global kernel instance for Tauri integration
use parking_lot::RwLock;
use std::sync::OnceLock;

static KERNEL: OnceLock<RwLock<Kernel>> = OnceLock::new();

/// Get or create the global kernel instance
pub fn get_kernel() -> &'static RwLock<Kernel> {
    KERNEL.get_or_init(|| RwLock::new(Kernel::new()))
}

/// Initialize the global kernel
pub fn init_kernel() -> KernelResult<()> {
    get_kernel().write().initialize()
}

/// Invoke a command on the global kernel
pub fn kernel_invoke(
    plugin_id: &str,
    command: &str,
    payload: serde_json::Value,
) -> KernelResponse {
    get_kernel().read().invoke_raw(plugin_id, command, payload)
}
