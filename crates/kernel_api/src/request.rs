//! Kernel request types
//!
//! Defines the request structure for the kernel_invoke command.

use serde::{Deserialize, Serialize};

/// A request to invoke a plugin command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelRequest {
    /// Target plugin ID
    pub plugin_id: String,
    
    /// Command to invoke
    pub command: String,
    
    /// Command payload (JSON)
    pub payload: serde_json::Value,
    
    /// Request ID for correlation (optional)
    #[serde(default)]
    pub request_id: Option<String>,
    
    /// Request metadata
    #[serde(default)]
    pub metadata: RequestMetadata,
}

impl KernelRequest {
    /// Create a new kernel request
    pub fn new(
        plugin_id: impl Into<String>,
        command: impl Into<String>,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            plugin_id: plugin_id.into(),
            command: command.into(),
            payload,
            request_id: None,
            metadata: RequestMetadata::default(),
        }
    }

    /// Add a request ID
    pub fn with_request_id(mut self, id: impl Into<String>) -> Self {
        self.request_id = Some(id.into());
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, metadata: RequestMetadata) -> Self {
        self.metadata = metadata;
        self
    }
}

/// Request metadata for context and tracing
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestMetadata {
    /// Timestamp when request was created
    #[serde(default)]
    pub timestamp: Option<u64>,
    
    /// Request timeout in milliseconds
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    
    /// Source of the request (e.g., "frontend", "plugin:xxx")
    #[serde(default)]
    pub source: Option<String>,
    
    /// Additional context
    #[serde(default)]
    pub context: serde_json::Value,
}
