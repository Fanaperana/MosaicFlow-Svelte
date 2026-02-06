//! Plugin types and traits
//!
//! Defines the core plugin abstraction and related types.

use serde::{Deserialize, Serialize};
use crate::manifest::PluginManifest;
use crate::request::KernelRequest;
use crate::response::KernelResponse;
use crate::error::KernelResult;

/// Unique plugin identifier
pub type PluginId = String;

/// Plugin state in the lifecycle
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PluginState {
    /// Plugin is discovered but not loaded
    Discovered,
    /// Plugin is loading
    Loading,
    /// Plugin is loaded and ready
    Loaded,
    /// Plugin is enabled and active
    Active,
    /// Plugin is disabled
    Disabled,
    /// Plugin encountered an error
    Error,
    /// Plugin is being unloaded
    Unloading,
}

impl Default for PluginState {
    fn default() -> Self {
        Self::Discovered
    }
}

impl std::fmt::Display for PluginState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PluginState::Discovered => write!(f, "discovered"),
            PluginState::Loading => write!(f, "loading"),
            PluginState::Loaded => write!(f, "loaded"),
            PluginState::Active => write!(f, "active"),
            PluginState::Disabled => write!(f, "disabled"),
            PluginState::Error => write!(f, "error"),
            PluginState::Unloading => write!(f, "unloading"),
        }
    }
}

/// Plugin runtime information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    /// Plugin manifest
    pub manifest: PluginManifest,
    
    /// Current state
    pub state: PluginState,
    
    /// Plugin directory path
    pub path: String,
    
    /// Error message if in error state
    #[serde(default)]
    pub error: Option<String>,
    
    /// Plugin configuration (user settings)
    #[serde(default)]
    pub config: serde_json::Value,
    
    /// Load order (lower = earlier)
    #[serde(default)]
    pub load_order: i32,
}

impl PluginInfo {
    /// Create new plugin info from manifest
    pub fn new(manifest: PluginManifest, path: String) -> Self {
        let load_order = if manifest.core { -100 } else { 0 };
        Self {
            manifest,
            state: PluginState::Discovered,
            path,
            error: None,
            config: serde_json::Value::Null,
            load_order,
        }
    }

    /// Get the plugin ID
    pub fn id(&self) -> &str {
        &self.manifest.id
    }

    /// Check if plugin is in a loadable state
    pub fn is_loadable(&self) -> bool {
        matches!(self.state, PluginState::Discovered | PluginState::Disabled)
    }

    /// Check if plugin is active
    pub fn is_active(&self) -> bool {
        self.state == PluginState::Active
    }

    /// Set error state with message
    pub fn set_error(&mut self, message: impl Into<String>) {
        self.state = PluginState::Error;
        self.error = Some(message.into());
    }
}

/// Trait for backend plugins to implement
/// 
/// This trait defines the interface that backend plugins must implement.
/// Initially, plugins are "builtin modules" - Rust trait objects.
/// In the future, WASM plugins will implement this via a WASM runtime adapter.
pub trait Plugin: Send + Sync {
    /// Get the plugin ID
    fn id(&self) -> &str;

    /// Get the plugin manifest
    fn manifest(&self) -> &PluginManifest;

    /// Initialize the plugin
    fn initialize(&mut self) -> KernelResult<()>;

    /// Shutdown the plugin
    fn shutdown(&mut self) -> KernelResult<()>;

    /// Handle a command request
    fn handle_command(&self, request: &KernelRequest) -> KernelResult<KernelResponse>;

    /// Get list of supported commands
    fn supported_commands(&self) -> Vec<String>;
}

/// Plugin factory function type
pub type PluginFactory = fn() -> Box<dyn Plugin>;

/// Registration info for builtin plugins
#[derive(Clone)]
pub struct BuiltinPluginRegistration {
    /// Plugin ID
    pub id: String,
    /// Factory function to create the plugin
    pub factory: PluginFactory,
}

impl std::fmt::Debug for BuiltinPluginRegistration {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BuiltinPluginRegistration")
            .field("id", &self.id)
            .finish()
    }
}
