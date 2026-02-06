//! Command Dispatcher
//!
//! Routes kernel requests to the appropriate plugins.
//! Includes panic safety so a misbehaving plugin cannot crash the kernel.

use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Instant;
use kernel_api::{
    KernelRequest, KernelResponse, KernelError, KernelResult,
    response::ResponseMetadata,
};
use tracing::{debug, error, warn, instrument};
use crate::plugin_registry::PluginRegistry;
use crate::kernel::KernelMetrics;

/// Command dispatcher that routes requests to plugins
pub struct CommandDispatcher {
    /// Reference to the plugin registry
    registry: Arc<PluginRegistry>,
    /// Shared metrics counters
    metrics: Arc<KernelMetrics>,
}

impl CommandDispatcher {
    /// Create a new command dispatcher
    pub fn new(registry: Arc<PluginRegistry>, metrics: Arc<KernelMetrics>) -> Self {
        Self { registry, metrics }
    }

    /// Dispatch a request to the appropriate plugin.
    ///
    /// This method is **panic-safe**: if a plugin panics during command handling,
    /// the panic is caught and converted into a `KernelError::CommandFailed`.
    #[instrument(
        skip(self, request),
        fields(
            plugin_id = %request.plugin_id,
            command = %request.command,
            request_id = ?request.request_id,
        ),
        name = "dispatch"
    )]
    pub fn dispatch(&self, request: &KernelRequest) -> KernelResponse {
        self.metrics.commands_dispatched.fetch_add(1, Ordering::Relaxed);
        let start = Instant::now();
        
        // Get the plugin
        let plugin = match self.registry.get_plugin(&request.plugin_id) {
            Some(p) => p,
            None => {
                warn!(plugin_id = %request.plugin_id, "Plugin not found");
                self.metrics.commands_failed.fetch_add(1, Ordering::Relaxed);
                return KernelResponse::error(KernelError::PluginNotFound {
                    plugin_id: request.plugin_id.clone(),
                })
                .with_request_id(request.request_id.clone());
            }
        };

        // Check if plugin supports the command
        let supported = plugin.supported_commands();
        if !supported.contains(&request.command) {
            warn!(
                plugin_id = %request.plugin_id,
                command = %request.command,
                "Command not found in plugin"
            );
            self.metrics.commands_failed.fetch_add(1, Ordering::Relaxed);
            return KernelResponse::error(KernelError::CommandNotFound {
                plugin_id: request.plugin_id.clone(),
                command: request.command.clone(),
            })
            .with_request_id(request.request_id.clone());
        }

        // Execute the command with panic safety
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            plugin.handle_command(request)
        }));

        let duration = start.elapsed().as_millis() as u64;

        let metadata = ResponseMetadata {
            duration_ms: Some(duration),
            handled_by: Some(request.plugin_id.clone()),
            extra: serde_json::Value::Null,
        };

        match result {
            Ok(Ok(mut response)) => {
                debug!(duration_ms = duration, "Command succeeded");
                self.metrics.commands_succeeded.fetch_add(1, Ordering::Relaxed);
                response.metadata = metadata;
                response.with_request_id(request.request_id.clone())
            }
            Ok(Err(e)) => {
                debug!(duration_ms = duration, error = %e, "Command returned error");
                self.metrics.commands_failed.fetch_add(1, Ordering::Relaxed);
                KernelResponse::error(e)
                    .with_request_id(request.request_id.clone())
                    .with_metadata(metadata)
            }
            Err(panic_info) => {
                // Plugin panicked — convert to a safe error response
                let panic_msg = if let Some(s) = panic_info.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = panic_info.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "unknown panic".to_string()
                };
                error!(
                    plugin_id = %request.plugin_id,
                    command = %request.command,
                    panic = %panic_msg,
                    "Plugin panicked during command execution"
                );
                self.metrics.commands_failed.fetch_add(1, Ordering::Relaxed);
                KernelResponse::error(KernelError::CommandFailed {
                    command: request.command.clone(),
                    reason: format!("Plugin panicked: {}", panic_msg),
                })
                .with_request_id(request.request_id.clone())
                .with_metadata(metadata)
            }
        }
    }

    /// Dispatch and return a result instead of response
    pub fn dispatch_result(&self, request: &KernelRequest) -> KernelResult<serde_json::Value> {
        self.dispatch(request).into_result()
    }
}
