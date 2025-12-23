// MosaicFlow Core Module
//
// This module provides the foundational utilities and types used across all
// other modules. It follows the principle of single responsibility and DRY.

pub mod error;
pub mod fs;
pub mod id;
pub mod paths;
pub mod result;
pub mod time;

// Re-export commonly used items
pub use error::MosaicError;
pub use fs::{
    copy_file, ensure_dir, file_exists, list_subdirs, read_json, read_string, remove_dir_all,
    rename, write_json, write_string,
};
pub use id::{generate_short_id, generate_uuid};
pub use paths::{get_config_path, get_data_dir, sanitize_name, CanvasPaths, VaultPaths};
pub use result::MosaicResult;
pub use time::{now_iso, now_timestamp};
