// MosaicFlow Error Types
//
// Centralized error handling for all modules

use serde::{Deserialize, Serialize};
use std::fmt;

/// Unified error type for all MosaicFlow operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MosaicError {
    /// Error code for programmatic handling
    pub code: ErrorCode,
    /// Human-readable message
    pub message: String,
    /// Optional context for debugging
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    // File system errors
    NotFound,
    AlreadyExists,
    PermissionDenied,
    IoError,

    // Data errors
    InvalidJson,
    InvalidFormat,
    MigrationFailed,

    // Vault errors
    VaultNotFound,
    VaultAlreadyExists,
    InvalidVault,

    // Canvas errors
    CanvasNotFound,
    CanvasAlreadyExists,
    InvalidCanvas,

    // State errors
    StateNotFound,
    StateSaveFailed,

    // Generic
    Unknown,
}

impl MosaicError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            context: None,
        }
    }

    pub fn with_context(mut self, context: impl Into<String>) -> Self {
        self.context = Some(context.into());
        self
    }

    // Convenience constructors
    pub fn not_found(item: &str) -> Self {
        Self::new(ErrorCode::NotFound, format!("{} not found", item))
    }

    pub fn already_exists(item: &str) -> Self {
        Self::new(ErrorCode::AlreadyExists, format!("{} already exists", item))
    }

    pub fn io_error(err: impl fmt::Display) -> Self {
        Self::new(ErrorCode::IoError, format!("I/O error: {}", err))
    }

    pub fn json_error(err: impl fmt::Display) -> Self {
        Self::new(ErrorCode::InvalidJson, format!("JSON error: {}", err))
    }

    pub fn vault_not_found(path: &str) -> Self {
        Self::new(
            ErrorCode::VaultNotFound,
            format!("Vault not found at: {}", path),
        )
    }

    pub fn canvas_not_found(path: &str) -> Self {
        Self::new(
            ErrorCode::CanvasNotFound,
            format!("Canvas not found at: {}", path),
        )
    }
}

impl fmt::Display for MosaicError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:?}] {}", self.code, self.message)
    }
}

impl std::error::Error for MosaicError {}

// Conversion from common error types
impl From<std::io::Error> for MosaicError {
    fn from(err: std::io::Error) -> Self {
        use std::io::ErrorKind;
        let code = match err.kind() {
            ErrorKind::NotFound => ErrorCode::NotFound,
            ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
            ErrorKind::AlreadyExists => ErrorCode::AlreadyExists,
            _ => ErrorCode::IoError,
        };
        Self::new(code, err.to_string())
    }
}

impl From<serde_json::Error> for MosaicError {
    fn from(err: serde_json::Error) -> Self {
        Self::json_error(err)
    }
}

// For Tauri command return
impl From<MosaicError> for String {
    fn from(err: MosaicError) -> Self {
        serde_json::to_string(&err).unwrap_or_else(|_| err.message)
    }
}
