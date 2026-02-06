//! MosaicFlow Kernel Runtime
//!
//! This crate implements the kernel runtime that manages plugins, routes commands,
//! and provides the event bus for communication.
//!
//! # Components
//!
//! - **PluginRegistry**: Manages plugin lifecycle and discovery
//! - **CommandDispatcher**: Routes commands to appropriate plugins
//! - **EventBus**: Pub/sub event system for kernel and plugin events
//! - **PolicyChecker**: Validates permissions and policies

pub mod dispatcher;
pub mod event_bus;
pub mod kernel;
pub mod plugin_registry;
pub mod policy;

// Re-export main types
pub use dispatcher::CommandDispatcher;
pub use event_bus::EventBus;
pub use kernel::{Kernel, KernelMetrics, MetricsSnapshot, get_kernel, init_kernel, kernel_invoke};
pub use plugin_registry::PluginRegistry;
pub use policy::PolicyChecker;

// Re-export kernel_api types for convenience
pub use kernel_api::{
    KernelError, KernelResult, KernelEvent, EventTopic,
    PluginManifest, PluginCapability, PluginPermission,
    PluginId, PluginInfo, PluginState, Plugin,
    KernelRequest, KernelResponse,
};
