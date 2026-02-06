//! Kernel response types
//!
//! Defines the response structure for kernel_invoke commands.

use serde::{Deserialize, Serialize};
use crate::error::KernelError;

/// Response from a kernel command invocation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelResponse {
    /// Whether the request succeeded
    pub success: bool,
    
    /// Response data (present on success)
    #[serde(default)]
    pub data: Option<serde_json::Value>,
    
    /// Error information (present on failure)
    #[serde(default)]
    pub error: Option<KernelError>,
    
    /// Correlated request ID (if provided in request)
    #[serde(default)]
    pub request_id: Option<String>,
    
    /// Response metadata
    #[serde(default)]
    pub metadata: ResponseMetadata,
}

impl KernelResponse {
    /// Create a success response with data
    pub fn success(data: serde_json::Value) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            request_id: None,
            metadata: ResponseMetadata::default(),
        }
    }

    /// Create an error response
    pub fn error(error: KernelError) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            request_id: None,
            metadata: ResponseMetadata::default(),
        }
    }

    /// Create an empty success response
    pub fn ok() -> Self {
        Self::success(serde_json::Value::Null)
    }

    /// Add request ID correlation
    pub fn with_request_id(mut self, id: Option<String>) -> Self {
        self.request_id = id;
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, metadata: ResponseMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    /// Check if response is successful
    pub fn is_ok(&self) -> bool {
        self.success
    }

    /// Get data if successful
    pub fn get_data(&self) -> Option<&serde_json::Value> {
        if self.success {
            self.data.as_ref()
        } else {
            None
        }
    }

    /// Convert to Result
    pub fn into_result(self) -> Result<serde_json::Value, KernelError> {
        if self.success {
            Ok(self.data.unwrap_or(serde_json::Value::Null))
        } else {
            Err(self.error.unwrap_or(KernelError::InternalError {
                reason: "Unknown error".to_string(),
            }))
        }
    }
}

/// Response metadata
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseMetadata {
    /// Time taken to process the request in milliseconds
    #[serde(default)]
    pub duration_ms: Option<u64>,
    
    /// Plugin that handled the request
    #[serde(default)]
    pub handled_by: Option<String>,
    
    /// Additional metadata
    #[serde(default)]
    pub extra: serde_json::Value,
}

impl ResponseMetadata {
    /// Create metadata with duration
    pub fn with_duration(duration_ms: u64) -> Self {
        Self {
            duration_ms: Some(duration_ms),
            handled_by: None,
            extra: serde_json::Value::Null,
        }
    }
}
