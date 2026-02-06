// Plugin Service
//
// Discovers and manages external plugins from the app's plugins directory.

use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::core::{paths::get_plugins_dir, MosaicResult, MosaicError};

/// Plugin manifest structure (matches frontend plugin.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub license: String,
    #[serde(default)]
    pub api_version: String,
    #[serde(default)]
    pub plugin_type: String,
    #[serde(default)]
    pub core: bool,
    #[serde(default)]
    pub capabilities: Vec<PluginCapability>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub frontend: Option<FrontendConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginCapability {
    #[serde(rename = "type")]
    pub capability_type: String,
    #[serde(default)]
    pub types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendConfig {
    pub main: String,
    #[serde(default)]
    pub styles: Option<String>,
}

/// Discovered plugin info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredPlugin {
    pub manifest: PluginManifest,
    pub path: String,
    pub main_url: Option<String>,
    pub styles_url: Option<String>,
}

/// Plugin Service
pub struct PluginService;

impl PluginService {
    /// Get the plugins directory path
    pub fn get_plugins_path(app_handle: &AppHandle) -> MosaicResult<PathBuf> {
        get_plugins_dir(app_handle)
    }

    /// Discover all plugins in the plugins directory
    pub fn discover_plugins(app_handle: &AppHandle) -> MosaicResult<Vec<DiscoveredPlugin>> {
        let plugins_dir = get_plugins_dir(app_handle)?;
        let mut discovered = Vec::new();

        // Read the plugins directory
        let entries = fs::read_dir(&plugins_dir).map_err(|e| {
            MosaicError::io_error(e)
        })?;

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            
            // Only process directories
            if !path.is_dir() {
                continue;
            }

            // Look for plugin.json
            let manifest_path = path.join("plugin.json");
            if !manifest_path.exists() {
                continue;
            }

            // Read and parse the manifest
            match Self::read_manifest(&manifest_path) {
                Ok(manifest) => {
                    // Skip core plugins (they're bundled)
                    if manifest.core {
                        continue;
                    }

                    // Build the plugin info
                    let plugin_path = path.to_string_lossy().to_string();
                    
                    // Resolve main URL (relative to plugin directory)
                    let main_url = manifest.frontend.as_ref().map(|f| {
                        format!("file://{}", path.join(&f.main).to_string_lossy())
                    });
                    
                    // Resolve styles URL
                    let styles_url = manifest.frontend.as_ref().and_then(|f| {
                        f.styles.as_ref().map(|s| {
                            format!("file://{}", path.join(s).to_string_lossy())
                        })
                    });

                    discovered.push(DiscoveredPlugin {
                        manifest,
                        path: plugin_path,
                        main_url,
                        styles_url,
                    });
                }
                Err(e) => {
                    eprintln!("Failed to read plugin manifest at {:?}: {}", manifest_path, e);
                    continue;
                }
            }
        }

        Ok(discovered)
    }

    /// Read a plugin manifest from a path
    fn read_manifest(path: &PathBuf) -> MosaicResult<PluginManifest> {
        let content = fs::read_to_string(path).map_err(|e| MosaicError::io_error(e))?;
        let manifest: PluginManifest = serde_json::from_str(&content).map_err(|e| {
            MosaicError::json_error(format!("Invalid plugin.json: {}", e))
        })?;
        Ok(manifest)
    }

    /// Read a specific plugin's main module content
    pub fn read_plugin_module(app_handle: &AppHandle, plugin_id: &str) -> MosaicResult<String> {
        let plugins_dir = get_plugins_dir(app_handle)?;
        
        // Find the plugin directory by ID
        let entries = fs::read_dir(&plugins_dir).map_err(|e| MosaicError::io_error(e))?;
        
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("plugin.json");
            if !manifest_path.exists() {
                continue;
            }

            if let Ok(manifest) = Self::read_manifest(&manifest_path) {
                if manifest.id == plugin_id {
                    // Found the plugin, read its main module
                    if let Some(frontend) = manifest.frontend {
                        let main_path = path.join(&frontend.main);
                        let content = fs::read_to_string(&main_path)
                            .map_err(|e| MosaicError::io_error(e))?;
                        return Ok(content);
                    } else {
                        return Err(MosaicError::new(
                            crate::core::error::ErrorCode::NotFound,
                            format!("Plugin {} has no frontend module", plugin_id)
                        ));
                    }
                }
            }
        }

        Err(MosaicError::new(
            crate::core::error::ErrorCode::NotFound,
            format!("Plugin not found: {}", plugin_id)
        ))
    }
}
