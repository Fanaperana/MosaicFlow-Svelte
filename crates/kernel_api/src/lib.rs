//! MosaicFlow Kernel API
//!
//! This crate provides the stable API types and traits for the MosaicFlow plugin system.
//! It is the foundation of the microkernel architecture, defining:
//!
//! - Plugin manifest structures
//! - Command request/response types
//! - Event types for the kernel event bus
//! - Plugin traits that plugins must implement
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                        Frontend (Svelte)                     │
//! │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
//! │  │   Registry  │  │ Kernel API  │  │   Plugin Loader     │  │
//! │  │  (Nodes,    │  │  Client     │  │   (Dynamic Import)  │  │
//! │  │   Panels)   │  │             │  │                     │  │
//! │  └─────────────┘  └─────────────┘  └─────────────────────┘  │
//! └───────────────────────────┬─────────────────────────────────┘
//!                             │ kernel_invoke(plugin_id, cmd, payload)
//!                             ▼
//! ┌─────────────────────────────────────────────────────────────┐
//! │                     Tauri Layer                              │
//! │  ┌─────────────────────────────────────────────────────────┐│
//! │  │              kernel_invoke command handler              ││
//! │  └─────────────────────────────────────────────────────────┘│
//! └───────────────────────────┬─────────────────────────────────┘
//!                             │
//!                             ▼
//! ┌─────────────────────────────────────────────────────────────┐
//! │                   Kernel Runtime                             │
//! │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
//! │  │   Plugin    │  │   Event     │  │      Policy         │  │
//! │  │  Registry   │  │    Bus      │  │     Checker         │  │
//! │  └─────────────┘  └─────────────┘  └─────────────────────┘  │
//! │                         │                                    │
//! │         ┌───────────────┼───────────────┐                   │
//! │         ▼               ▼               ▼                   │
//! │  ┌───────────┐   ┌───────────┐   ┌───────────┐             │
//! │  │  Core     │   │ Community │   │  Premium  │             │
//! │  │ Plugins   │   │  Plugins  │   │  Plugins  │             │
//! │  └───────────┘   └───────────┘   └───────────┘             │
//! └─────────────────────────────────────────────────────────────┘
//! ```
//!
//! # Key Concepts
//!
//! - **Plugin**: A self-contained module that extends MosaicFlow functionality
//! - **Kernel**: The minimal core that loads and manages plugins
//! - **Registry**: Frontend registries for nodes, panels, commands, etc.
//! - **Event Bus**: Pub/sub system for kernel and plugin events

pub mod error;
pub mod event;
pub mod manifest;
pub mod plugin;
pub mod request;
pub mod response;

// Re-exports for convenience
pub use error::{KernelError, KernelResult};
pub use event::{KernelEvent, EventTopic};
pub use manifest::{PluginManifest, PluginCapability, PluginPermission};
pub use plugin::{PluginId, PluginInfo, PluginState, Plugin, BuiltinPluginRegistration, PluginFactory};
pub use request::KernelRequest;
pub use response::KernelResponse;

/// Kernel API version for compatibility checking
pub const KERNEL_API_VERSION: &str = "0.1.0";

/// Check if a plugin's required API version is compatible with the current kernel
pub fn is_api_compatible(required_version: &str) -> bool {
    // Simple semver major version check for now
    // In production, use the semver crate
    let current_major = KERNEL_API_VERSION.split('.').next().unwrap_or("0");
    let required_major = required_version.split('.').next().unwrap_or("0");
    current_major == required_major
}
