// Plugin Service
//
// Discovers user plugins in {APP_DATA}/plugins and serves their files to the frontend.
// Every file read is confined to the plugin's own directory.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

use crate::core::error::ErrorCode;
use crate::core::{paths::get_plugins_dir, MosaicError, MosaicResult};

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
    pub homepage: String,
    #[serde(default)]
    pub api_version: String,
    #[serde(default)]
    pub plugin_type: String,
    #[serde(default)]
    pub core: bool,
    #[serde(default)]
    pub capabilities: Vec<PluginCapability>,
    /// Strings or objects (`{"custom": ...}`, `{"id","version"}`) as documented; not interpreted here.
    #[serde(default)]
    pub permissions: Vec<serde_json::Value>,
    #[serde(default)]
    pub dependencies: Vec<serde_json::Value>,
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

    /// Discover all non-core plugins in the plugins directory
    pub fn discover_plugins(app_handle: &AppHandle) -> MosaicResult<Vec<DiscoveredPlugin>> {
        let mut discovered = Vec::new();

        for (dir, manifest) in Self::plugin_dirs(app_handle)? {
            if manifest.core {
                continue;
            }
            let file_url = |rel: &str| {
                Self::resolve_inside(&dir, rel).map(|p| format!("file://{}", p.to_string_lossy()))
            };
            let main_url = manifest.frontend.as_ref().and_then(|f| file_url(&f.main));
            let styles_url = manifest
                .frontend
                .as_ref()
                .and_then(|f| f.styles.as_deref().and_then(file_url));

            discovered.push(DiscoveredPlugin {
                path: dir.to_string_lossy().to_string(),
                manifest,
                main_url,
                styles_url,
            });
        }

        Ok(discovered)
    }

    /// Read a plugin's main module (frontend.main)
    pub fn read_plugin_module(app_handle: &AppHandle, plugin_id: &str) -> MosaicResult<String> {
        let (dir, manifest) = Self::find_plugin(app_handle, plugin_id)?;
        let main = manifest.frontend.map(|f| f.main).ok_or_else(|| {
            MosaicError::new(
                ErrorCode::NotFound,
                format!("Plugin {} has no frontend module", plugin_id),
            )
        })?;
        Self::read_inside(&dir, &main, plugin_id)
    }

    /// Read any text file that belongs to a plugin (e.g. its stylesheet)
    pub fn read_plugin_file(
        app_handle: &AppHandle,
        plugin_id: &str,
        file: &str,
    ) -> MosaicResult<String> {
        let (dir, _) = Self::find_plugin(app_handle, plugin_id)?;
        Self::read_inside(&dir, file, plugin_id)
    }

    fn plugin_dirs(app_handle: &AppHandle) -> MosaicResult<Vec<(PathBuf, PluginManifest)>> {
        let plugins_dir = get_plugins_dir(app_handle)?;
        let entries = fs::read_dir(&plugins_dir).map_err(MosaicError::io_error)?;
        let mut out = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            let manifest_path = path.join("plugin.json");
            if !path.is_dir() || !manifest_path.exists() {
                continue;
            }
            match Self::read_manifest(&manifest_path) {
                Ok(manifest) => out.push((path, manifest)),
                Err(e) => eprintln!(
                    "Failed to read plugin manifest at {:?}: {}",
                    manifest_path, e
                ),
            }
        }
        Ok(out)
    }

    fn find_plugin(
        app_handle: &AppHandle,
        plugin_id: &str,
    ) -> MosaicResult<(PathBuf, PluginManifest)> {
        Self::plugin_dirs(app_handle)?
            .into_iter()
            .find(|(_, m)| m.id == plugin_id && !m.core)
            .ok_or_else(|| {
                MosaicError::new(
                    ErrorCode::NotFound,
                    format!("Plugin not found: {}", plugin_id),
                )
            })
    }

    /// Resolves `rel` against `dir`, refusing anything that escapes the plugin directory.
    fn resolve_inside(dir: &Path, rel: &str) -> Option<PathBuf> {
        // Both sides are canonicalized so the comparison also holds for Windows `\\?\` paths.
        let root = dir.canonicalize().ok()?;
        let target = dir.join(rel).canonicalize().ok()?;
        (target.starts_with(&root) && target.is_file()).then_some(target)
    }

    fn read_inside(dir: &Path, rel: &str, plugin_id: &str) -> MosaicResult<String> {
        let path = Self::resolve_inside(dir, rel).ok_or_else(|| {
            MosaicError::new(
                ErrorCode::PermissionDenied,
                format!(
                    "Plugin {} file {:?} is missing or outside its directory",
                    plugin_id, rel
                ),
            )
        })?;
        fs::read_to_string(&path).map_err(MosaicError::io_error)
    }

    fn read_manifest(path: &Path) -> MosaicResult<PluginManifest> {
        let content = fs::read_to_string(path).map_err(MosaicError::io_error)?;
        serde_json::from_str(&content)
            .map_err(|e| MosaicError::json_error(format!("Invalid plugin.json: {}", e)))
    }
}
