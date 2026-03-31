// MosaicFlow Core Module
//
// Re-exports from mosaicflow_core crate + Tauri-specific path utilities.
// The portable utilities live in crates/mosaicflow_core.

pub mod paths;

// Re-export everything from the core crate
pub use mosaicflow_core::error;
pub use mosaicflow_core::fs;
pub use mosaicflow_core::id;
pub use mosaicflow_core::result;
pub use mosaicflow_core::time;

// Re-export commonly used items
pub use mosaicflow_core::{
    copy_file, ensure_dir, file_exists, generate_short_id, generate_uuid, list_subdirs, now_iso,
    now_timestamp, read_json, read_string, remove_dir_all, rename, sanitize_name, write_json,
    write_string, CanvasPaths, ErrorCode, MosaicError, MosaicResult, VaultPaths,
};

// Re-export Tauri-specific path utilities
pub use paths::{get_config_path, get_data_dir, get_plugins_dir};
