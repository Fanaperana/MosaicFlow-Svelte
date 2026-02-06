//! Kernel
//!
//! The main kernel that ties together all runtime components.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use kernel_api::{
    KernelRequest, KernelResponse, KernelEvent, EventTopic,
    PluginInfo, BuiltinPluginRegistration, KernelResult,
};
use tracing::{info, warn, error, debug, instrument};
use crate::{
    plugin_registry::PluginRegistry,
    dispatcher::CommandDispatcher,
    event_bus::EventBus,
    policy::PolicyChecker,
};

/// Runtime metrics for observability
#[derive(Debug, Default)]
pub struct KernelMetrics {
    /// Total commands dispatched
    pub commands_dispatched: AtomicU64,
    /// Total commands that succeeded
    pub commands_succeeded: AtomicU64,
    /// Total commands that failed
    pub commands_failed: AtomicU64,
    /// Total events emitted
    pub events_emitted: AtomicU64,
}

impl KernelMetrics {
    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            commands_dispatched: self.commands_dispatched.load(Ordering::Relaxed),
            commands_succeeded: self.commands_succeeded.load(Ordering::Relaxed),
            commands_failed: self.commands_failed.load(Ordering::Relaxed),
            events_emitted: self.events_emitted.load(Ordering::Relaxed),
        }
    }
}

/// Point-in-time snapshot of kernel metrics (safe to serialize / log)
#[derive(Debug, Clone, serde::Serialize)]
pub struct MetricsSnapshot {
    pub commands_dispatched: u64,
    pub commands_succeeded: u64,
    pub commands_failed: u64,
    pub events_emitted: u64,
}

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
    
    /// Runtime metrics
    pub metrics: Arc<KernelMetrics>,
    
    /// Whether kernel is initialized
    initialized: bool,
}

impl Kernel {
    /// Create a new kernel instance
    pub fn new() -> Self {
        let registry = Arc::new(PluginRegistry::new());
        let event_bus = Arc::new(EventBus::default());
        let policy = Arc::new(PolicyChecker::default());
        let metrics = Arc::new(KernelMetrics::default());
        let dispatcher = CommandDispatcher::new(
            Arc::clone(&registry),
            Arc::clone(&metrics),
        );

        Self {
            registry,
            dispatcher,
            event_bus,
            policy,
            metrics,
            initialized: false,
        }
    }

    /// Initialize the kernel and load all builtin plugins
    #[instrument(skip(self), name = "kernel_init")]
    pub fn initialize(&mut self) -> KernelResult<()> {
        if self.initialized {
            debug!("Kernel already initialized, skipping");
            return Ok(());
        }

        info!("Kernel initializing...");

        // Emit initialization started event
        self.emit_kernel(
            EventTopic::Custom("kernel:initializing".to_string()),
            serde_json::json!({}),
        );

        // Load all registered builtin plugins
        let results = self.registry.load_all_builtins();

        let mut loaded = 0u32;
        let mut failed = 0u32;

        // Emit events for each plugin
        for (id, result) in &results {
            match result {
                Ok(_) => {
                    loaded += 1;
                    self.emit_kernel(
                        EventTopic::PluginLoaded,
                        serde_json::json!({ "pluginId": id }),
                    );
                }
                Err(e) => {
                    failed += 1;
                    error!(plugin_id = %id, error = %e, "Failed to load builtin plugin");
                    self.emit_kernel(
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

        info!(loaded, failed, "Kernel initialized");

        // Emit initialization complete event
        self.emit_kernel(
            EventTopic::Custom("kernel:initialized".to_string()),
            serde_json::json!({
                "loadedPlugins": results.iter()
                    .filter(|(_, r)| r.is_ok())
                    .map(|(id, _)| id)
                    .collect::<Vec<_>>(),
                "failedPlugins": results.iter()
                    .filter(|(_, r)| r.is_err())
                    .map(|(id, _)| id)
                    .collect::<Vec<_>>(),
            }),
        );

        Ok(())
    }

    /// Register a builtin plugin
    pub fn register_builtin(&self, registration: BuiltinPluginRegistration) -> KernelResult<()> {
        info!(plugin_id = %registration.id, "Registering builtin plugin");
        self.registry.register_builtin(registration)
    }

    /// Invoke a plugin command
    pub fn invoke(&self, request: &KernelRequest) -> KernelResponse {
        let response = self.dispatcher.dispatch(request);
        response
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
        self.metrics.events_emitted.fetch_add(1, Ordering::Relaxed);
        self.event_bus.emit(event);
    }

    /// Emit a kernel event
    pub fn emit_kernel(&self, topic: EventTopic, payload: serde_json::Value) {
        self.metrics.events_emitted.fetch_add(1, Ordering::Relaxed);
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

    /// Get a snapshot of current metrics
    pub fn metrics_snapshot(&self) -> MetricsSnapshot {
        self.metrics.snapshot()
    }

    /// Shutdown the kernel
    #[instrument(skip(self), name = "kernel_shutdown")]
    pub fn shutdown(&mut self) -> KernelResult<()> {
        info!("Kernel shutting down...");

        // Emit shutdown event
        self.emit_kernel(
            EventTopic::Custom("kernel:shutdown".to_string()),
            serde_json::json!({}),
        );

        // Unload all plugins
        let plugin_ids = self.registry.list_loaded_plugins();
        for id in &plugin_ids {
            match self.registry.unload_plugin(id) {
                Ok(_) => {
                    self.event_bus.emit_kernel(
                        EventTopic::PluginUnloaded,
                        serde_json::json!({ "pluginId": id }),
                    );
                }
                Err(e) => {
                    error!(plugin_id = %id, error = %e, "Error unloading plugin during shutdown");
                }
            }
        }

        self.initialized = false;
        info!(unloaded = plugin_ids.len(), "Kernel shut down");
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
