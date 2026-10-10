// MosaicFlow Commands
//
// Tauri command handlers - thin wrappers around services
// These are the entry points from the frontend

pub mod canvas;
pub mod config;
pub mod export;
pub mod history;
pub mod kernel;
pub mod mcp;
pub mod open_files;
pub mod plugin;
pub mod state;
pub mod vault;
pub mod workspace;

// Re-export all commands for easy registration
pub use canvas::*;
pub use config::*;
pub use export::*;
pub use history::*;
pub use kernel::*;
pub use mcp::*;
pub use open_files::take_pending_open_files;
pub use plugin::*;
pub use state::*;
pub use vault::*;
pub use workspace::*;
