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

/// Parsed kernel API version (lazy-evaluated at first use)
pub fn kernel_api_version() -> semver::Version {
    semver::Version::parse(KERNEL_API_VERSION).expect("KERNEL_API_VERSION must be valid semver")
}

/// Check if a plugin's required API version is compatible with the current kernel.
///
/// Uses semver compatibility: a plugin requiring `0.1.0` is compatible with kernel `0.1.x`
/// but not `0.2.0`. For `1.x.y`, standard major-version compat applies.
pub fn is_api_compatible(required_version: &str) -> bool {
    let Ok(required) = semver::Version::parse(required_version) else {
        return false;
    };
    let current = kernel_api_version();
    // semver compat: same major, required minor <= current minor
    // For 0.x.y: both major and minor must match (0.x is treated as breaking)
    if current.major == 0 {
        required.major == current.major && required.minor == current.minor
    } else {
        required.major == current.major && required.minor <= current.minor
    }
}

/// Parse a version string, returning a KernelError on failure
pub fn parse_version(version: &str) -> KernelResult<semver::Version> {
    semver::Version::parse(version).map_err(|e| KernelError::InvalidManifest {
        reason: format!("Invalid semver '{}': {}", version, e),
    })
}

/// Parse a version requirement string, returning a KernelError on failure
pub fn parse_version_req(req: &str) -> KernelResult<semver::VersionReq> {
    semver::VersionReq::parse(req).map_err(|e| KernelError::InvalidManifest {
        reason: format!("Invalid semver requirement '{}': {}", req, e),
    })
}
