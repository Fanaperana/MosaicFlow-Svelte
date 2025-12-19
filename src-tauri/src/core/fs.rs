// MosaicFlow File System Utilities
//
// Centralized file operations - ALL I/O goes through here

use serde::{de::DeserializeOwned, Serialize};
use std::fs;
use std::path::Path;

use super::result::MosaicResult;

/// Read and parse JSON file
pub fn read_json<T: DeserializeOwned>(path: &Path) -> MosaicResult<T> {
    let content = fs::read_to_string(path)?;
    let data = serde_json::from_str(&content)?;
    Ok(data)
}

/// Write data as pretty JSON to file
pub fn write_json<T: Serialize>(path: &Path, data: &T) -> MosaicResult<()> {
    let content = serde_json::to_string_pretty(data)?;
    
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    
    fs::write(path, content)?;
    Ok(())
}

/// Ensure directory exists, create if not
pub fn ensure_dir(path: &Path) -> MosaicResult<()> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    Ok(())
}

/// Check if path exists
pub fn exists(path: &Path) -> bool {
    path.exists()
}

/// Check if file exists (alias for exists)
pub fn file_exists(path: &Path) -> bool {
    path.exists()
}

/// Remove file
pub fn remove_file(path: &Path) -> MosaicResult<()> {
    fs::remove_file(path)?;
    Ok(())
}

/// Remove directory and all contents
pub fn remove_dir_all(path: &Path) -> MosaicResult<()> {
    fs::remove_dir_all(path)?;
    Ok(())
}

/// Rename/move file or directory
pub fn rename(from: &Path, to: &Path) -> MosaicResult<()> {
    fs::rename(from, to)?;
    Ok(())
}

/// List directory entries
pub fn list_dir(path: &Path) -> MosaicResult<Vec<std::path::PathBuf>> {
    if !path.exists() {
        return Ok(vec![]);
    }
    
    let entries = fs::read_dir(path)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();
    
    Ok(entries)
}

/// List subdirectories only
pub fn list_subdirs(path: &Path) -> MosaicResult<Vec<std::path::PathBuf>> {
    if !path.exists() {
        return Ok(vec![]);
    }
    
    let entries = fs::read_dir(path)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();
    
    Ok(entries)
}

/// Copy file
pub fn copy_file(from: &Path, to: &Path) -> MosaicResult<u64> {
    // Ensure parent directory exists
    if let Some(parent) = to.parent() {
        ensure_dir(parent)?;
    }
    
    let bytes = fs::copy(from, to)?;
    Ok(bytes)
}

/// Read file as string
pub fn read_string(path: &Path) -> MosaicResult<String> {
    let content = fs::read_to_string(path)?;
    Ok(content)
}

/// Write string to file
pub fn write_string(path: &Path, content: &str) -> MosaicResult<()> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    
    fs::write(path, content)?;
    Ok(())
}

/// Read file as bytes
pub fn read_bytes(path: &Path) -> MosaicResult<Vec<u8>> {
    let content = fs::read(path)?;
    Ok(content)
}

/// Write bytes to file
pub fn write_bytes(path: &Path, content: &[u8]) -> MosaicResult<()> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    
    fs::write(path, content)?;
    Ok(())
}
