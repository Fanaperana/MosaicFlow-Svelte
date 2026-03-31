// MosaicFlow Core
//
// Portable foundation utilities used across all MosaicFlow crates.
// This crate has NO tauri dependency - it's pure Rust.

pub mod error;
pub mod fs;
pub mod id;
pub mod paths;
pub mod result;
pub mod time;

// Re-export commonly used items
pub use error::{ErrorCode, MosaicError};
pub use fs::{
    copy_file, ensure_dir, file_exists, list_subdirs, read_json, read_string, remove_dir_all,
    rename, write_json, write_string,
};
pub use id::{generate_prefixed_id, generate_short_id, generate_uuid};
pub use paths::{sanitize_name, CanvasPaths, VaultPaths};
pub use result::MosaicResult;
pub use time::{now_iso, now_timestamp};
