// MosaicFlow Core Module
// 
// This module provides the foundational utilities and types used across all
// other modules. It follows the principle of single responsibility and DRY.

pub mod error;
pub mod result;
pub mod time;
pub mod id;
pub mod fs;
pub mod paths;

// Re-export commonly used items
pub use error::MosaicError;
pub use result::MosaicResult;
pub use time::{now_iso, now_timestamp};
pub use id::{generate_uuid, generate_short_id};
pub use fs::{
    read_json, write_json, ensure_dir, 
    list_subdirs, rename, remove_dir_all,
    read_string, write_string, file_exists,
    copy_file
};
pub use paths::{sanitize_name, get_data_dir, get_config_path, VaultPaths, CanvasPaths};
