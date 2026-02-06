//! Kernel error types
//!
//! Defines all error types that can occur in the kernel and plugin system.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Result type alias for kernel operations
pub type KernelResult<T> = Result<T, KernelError>;

/// Kernel error types
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum KernelError {
    /// Plugin not found in registry
    #[error("Plugin not found: {plugin_id}")]
    PluginNotFound { plugin_id: String },

    /// Command not found in plugin
    #[error("Command not found: {command} in plugin {plugin_id}")]
    CommandNotFound { plugin_id: String, command: String },

    /// Plugin is not in a valid state for the operation
    #[error("Plugin state error: {plugin_id} is {state}, expected {expected}")]
    InvalidPluginState {
        plugin_id: String,
        state: String,
        expected: String,
    },

    /// Permission denied for operation
    #[error("Permission denied: {operation} requires {permission}")]
    PermissionDenied {
        operation: String,
        permission: String,
    },

    /// Plugin manifest is invalid
    #[error("Invalid manifest: {reason}")]
    InvalidManifest { reason: String },

    /// API version mismatch
    #[error("API version mismatch: plugin requires {required}, kernel is {current}")]
    ApiVersionMismatch { required: String, current: String },

    /// Plugin initialization failed
    #[error("Plugin initialization failed: {plugin_id} - {reason}")]
    InitializationFailed { plugin_id: String, reason: String },

    /// Command execution failed
    #[error("Command execution failed: {command} - {reason}")]
    CommandFailed { command: String, reason: String },

    /// Serialization/deserialization error
    #[error("Serialization error: {reason}")]
    SerializationError { reason: String },

    /// IO error (file operations)
    #[error("IO error: {reason}")]
    IoError { reason: String },

    /// Plugin already registered
    #[error("Plugin already registered: {plugin_id}")]
    PluginAlreadyRegistered { plugin_id: String },

    /// Internal kernel error
    #[error("Internal kernel error: {reason}")]
    InternalError { reason: String },
}

impl From<serde_json::Error> for KernelError {
    fn from(err: serde_json::Error) -> Self {
        KernelError::SerializationError {
            reason: err.to_string(),
        }
    }
}

impl From<std::io::Error> for KernelError {
    fn from(err: std::io::Error) -> Self {
        KernelError::IoError {
            reason: err.to_string(),
        }
    }
}
