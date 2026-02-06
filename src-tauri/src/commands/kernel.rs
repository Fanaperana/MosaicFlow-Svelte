//! Kernel Commands
//!
//! Tauri command handlers for the kernel system.
//! This provides the single entry point `kernel_invoke` for all plugin commands.

use kernel_api::{KernelRequest, KernelResponse, PluginInfo};
use kernel_runtime::{get_kernel, init_kernel};
use serde::{Deserialize, Serialize};

/// Request structure for kernel_invoke command
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeRequest {
    pub plugin_id: String,
    pub command: String,
    pub payload: serde_json::Value,
    #[serde(default)]
    pub request_id: Option<String>,
}

/// Response wrapper for Tauri serialization
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeResponse {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
    pub request_id: Option<String>,
    pub duration_ms: Option<u64>,
}

impl From<KernelResponse> for InvokeResponse {
    fn from(response: KernelResponse) -> Self {
        Self {
            success: response.success,
            data: response.data,
            error: response.error.map(|e| e.to_string()),
            request_id: response.request_id,
            duration_ms: response.metadata.duration_ms,
        }
    }
}

/// Main kernel invoke command - routes all plugin commands
#[tauri::command]
pub fn kernel_invoke(request: InvokeRequest) -> InvokeResponse {
    let kernel_request = KernelRequest {
        plugin_id: request.plugin_id,
        command: request.command,
        payload: request.payload,
        request_id: request.request_id,
        metadata: Default::default(),
    };

    let response = get_kernel().read().invoke(&kernel_request);
    response.into()
}

/// Initialize the kernel
#[tauri::command]
pub fn kernel_init() -> Result<(), String> {
    init_kernel().map_err(|e| e.to_string())
}

/// List all plugins
#[tauri::command]
pub fn kernel_list_plugins() -> Vec<PluginInfo> {
    get_kernel().read().list_plugins()
}

/// Get plugin info
#[tauri::command]
pub fn kernel_get_plugin_info(plugin_id: String) -> Option<PluginInfo> {
    get_kernel().read().get_plugin_info(&plugin_id)
}

/// Check if kernel is initialized
#[tauri::command]
pub fn kernel_is_initialized() -> bool {
    get_kernel().read().is_initialized()
}

/// Emit a kernel event from frontend
#[tauri::command]
pub fn kernel_emit_event(topic: String, payload: serde_json::Value) {
    use kernel_api::EventTopic;
    get_kernel().read().emit_kernel(EventTopic::Custom(topic), payload);
}
