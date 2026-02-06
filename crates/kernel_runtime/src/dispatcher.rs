//! Command Dispatcher
//!
//! Routes kernel requests to the appropriate plugins.

use std::time::Instant;
use kernel_api::{
    KernelRequest, KernelResponse, KernelError, KernelResult,
    response::ResponseMetadata,
};
use crate::plugin_registry::PluginRegistry;

/// Command dispatcher that routes requests to plugins
pub struct CommandDispatcher {
    /// Reference to the plugin registry
    registry: std::sync::Arc<PluginRegistry>,
}

impl CommandDispatcher {
    /// Create a new command dispatcher
    pub fn new(registry: std::sync::Arc<PluginRegistry>) -> Self {
        Self { registry }
    }

    /// Dispatch a request to the appropriate plugin
    pub fn dispatch(&self, request: &KernelRequest) -> KernelResponse {
        let start = Instant::now();
        
        // Get the plugin
        let plugin = match self.registry.get_plugin(&request.plugin_id) {
            Some(p) => p,
            None => {
                return KernelResponse::error(KernelError::PluginNotFound {
                    plugin_id: request.plugin_id.clone(),
                })
                .with_request_id(request.request_id.clone());
            }
        };

        // Check if plugin supports the command
        let supported = plugin.supported_commands();
        if !supported.contains(&request.command) {
            return KernelResponse::error(KernelError::CommandNotFound {
                plugin_id: request.plugin_id.clone(),
                command: request.command.clone(),
            })
            .with_request_id(request.request_id.clone());
        }

        // Execute the command
        let result = plugin.handle_command(request);
        let duration = start.elapsed().as_millis() as u64;

        match result {
            Ok(mut response) => {
                response.metadata = ResponseMetadata {
                    duration_ms: Some(duration),
                    handled_by: Some(request.plugin_id.clone()),
                    extra: serde_json::Value::Null,
                };
                response.with_request_id(request.request_id.clone())
            }
            Err(e) => {
                KernelResponse::error(e)
                    .with_request_id(request.request_id.clone())
                    .with_metadata(ResponseMetadata {
                        duration_ms: Some(duration),
                        handled_by: Some(request.plugin_id.clone()),
                        extra: serde_json::Value::Null,
                    })
            }
        }
    }

    /// Dispatch and return a result instead of response
    pub fn dispatch_result(&self, request: &KernelRequest) -> KernelResult<serde_json::Value> {
        self.dispatch(request).into_result()
    }
}
