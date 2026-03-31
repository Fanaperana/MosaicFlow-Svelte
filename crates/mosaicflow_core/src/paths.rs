// MosaicFlow Path Utilities
//
// Portable path handling and name sanitization
// NOTE: Tauri-specific path resolution (get_data_dir, etc.) lives in src-tauri

use std::path::PathBuf;

use crate::result::MosaicResult;

/// Sanitize a name for use as a folder name
pub fn sanitize_name(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .to_string();

    // Prevent empty names
    if sanitized.is_empty() {
        return "untitled".to_string();
    }

    // Prevent Windows reserved filenames
    let upper = sanitized.to_uppercase();
    let reserved = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
        "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8",
        "LPT9",
    ];
    if reserved.contains(&upper.as_str()) {
        return format!("{}_", sanitized);
    }

    sanitized
}

/// Standard paths within a vault
pub struct VaultPaths {
    pub root: PathBuf,
    pub vault_json: PathBuf,
    pub canvases: PathBuf,
    pub assets: PathBuf,
    pub attachments: PathBuf,
    pub config: PathBuf,
}

impl VaultPaths {
    pub fn from_root(root: &PathBuf) -> Self {
        Self {
            root: root.clone(),
            vault_json: root.join("vault.json"),
            canvases: root.join("canvases"),
            assets: root.join("assets"),
            attachments: root.join("attachments"),
            config: root.join(".mosaicflow"),
        }
    }

    /// Check if this is a valid vault directory
    pub fn is_valid(&self) -> bool {
        self.vault_json.exists()
    }

    /// Create all required directories
    pub fn create_all(&self) -> MosaicResult<()> {
        crate::fs::ensure_dir(&self.root)?;
        crate::fs::ensure_dir(&self.canvases)?;
        crate::fs::ensure_dir(&self.assets)?;
        crate::fs::ensure_dir(&self.attachments)?;
        crate::fs::ensure_dir(&self.config)?;
        Ok(())
    }
}

/// Standard paths within a canvas
pub struct CanvasPaths {
    pub root: PathBuf,
    pub mosaic: PathBuf,
    pub meta_json: PathBuf,
    pub state_json: PathBuf,
    pub workspace_json: PathBuf,
    pub nodes: PathBuf,
    pub edges: PathBuf,
    pub images: PathBuf,
    pub attachments: PathBuf,
}

impl CanvasPaths {
    pub fn from_root(root: &PathBuf) -> Self {
        let mosaic = root.join(".mosaic");
        Self {
            root: root.clone(),
            mosaic: mosaic.clone(),
            meta_json: mosaic.join("meta.json"),
            state_json: mosaic.join("state.json"),
            workspace_json: root.join("workspace.json"),
            nodes: root.join("nodes"),
            edges: root.join("edges"),
            images: root.join("images"),
            attachments: root.join("attachments"),
        }
    }

    /// Check if this is a valid canvas directory (v2 format)
    pub fn is_valid_v2(&self) -> bool {
        self.meta_json.exists()
    }

    /// Check if this is a valid canvas directory (v1 format)
    pub fn is_valid_v1(&self) -> bool {
        self.root.join("canvas.json").exists()
    }

    /// Create all required directories
    pub fn create_all(&self) -> MosaicResult<()> {
        crate::fs::ensure_dir(&self.root)?;
        crate::fs::ensure_dir(&self.mosaic)?;
        crate::fs::ensure_dir(&self.nodes)?;
        crate::fs::ensure_dir(&self.edges)?;
        crate::fs::ensure_dir(&self.images)?;
        crate::fs::ensure_dir(&self.attachments)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_name() {
        assert_eq!(sanitize_name("Hello World"), "Hello World");
        assert_eq!(sanitize_name("Test/Path"), "Test_Path");
        assert_eq!(sanitize_name("  spaces  "), "spaces");
        assert_eq!(sanitize_name("under_score-dash"), "under_score-dash");
    }
}
