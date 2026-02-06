//! Plugin manifest types
//!
//! Defines the structure of plugin.json manifest files.

use serde::{Deserialize, Serialize};

/// Plugin manifest - the main configuration file for a plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    /// Unique plugin identifier (e.g., "com.mosaicflow.core.notes")
    pub id: String,

    /// Human-readable plugin name
    pub name: String,

    /// Plugin version (semver)
    pub version: String,

    /// Plugin description
    pub description: String,

    /// Plugin author
    pub author: String,

    /// License identifier
    #[serde(default)]
    pub license: Option<String>,

    /// Plugin homepage/repository URL
    #[serde(default)]
    pub homepage: Option<String>,

    /// Required kernel API version (semver range)
    pub api_version: String,

    /// Plugin capabilities
    #[serde(default)]
    pub capabilities: Vec<PluginCapability>,

    /// Required permissions
    #[serde(default)]
    pub permissions: Vec<PluginPermission>,

    /// Dependencies on other plugins
    #[serde(default)]
    pub dependencies: Vec<PluginDependency>,

    /// Frontend entry point (relative path to JS/TS module)
    #[serde(default)]
    pub frontend: Option<FrontendEntry>,

    /// Backend entry point (for WASM plugins in the future)
    #[serde(default)]
    pub backend: Option<BackendEntry>,

    /// Plugin-specific configuration schema
    #[serde(default)]
    pub config_schema: Option<serde_json::Value>,

    /// Default configuration values
    #[serde(default)]
    pub default_config: Option<serde_json::Value>,

    /// Plugin type classification
    #[serde(default = "default_plugin_type")]
    pub plugin_type: PluginType,

    /// Whether this is a core plugin (bundled with the app)
    #[serde(default)]
    pub core: bool,

    /// Minimum MosaicFlow version required
    #[serde(default)]
    pub min_app_version: Option<String>,
}

fn default_plugin_type() -> PluginType {
    PluginType::Community
}

/// Plugin type classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum PluginType {
    /// Core plugins bundled with the app
    Core,
    /// Community/open-source plugins
    #[default]
    Community,
    /// Premium/commercial plugins
    Premium,
}

/// Plugin capability declarations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PluginCapability {
    /// Provides node types
    NodeTypes {
        /// List of node type IDs provided
        types: Vec<String>,
    },
    /// Provides panel components
    Panels {
        /// List of panel IDs provided
        panels: Vec<String>,
    },
    /// Provides commands
    Commands {
        /// List of command IDs provided
        commands: Vec<String>,
    },
    /// Provides context menu items
    ContextMenus {
        /// List of context menu contribution IDs
        menus: Vec<String>,
    },
    /// Provides edge types
    EdgeTypes {
        /// List of edge type IDs provided
        types: Vec<String>,
    },
    /// Provides themes
    Themes {
        /// List of theme IDs provided
        themes: Vec<String>,
    },
    /// Provides import/export formats
    Formats {
        /// List of format IDs provided
        formats: Vec<String>,
    },
    /// Custom capability
    Custom {
        /// Custom capability name
        name: String,
        /// Additional metadata
        #[serde(default)]
        metadata: serde_json::Value,
    },
}

/// Plugin permission requests
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PluginPermission {
    /// Read files in vault
    FileRead,
    /// Write files in vault
    FileWrite,
    /// Make network requests
    Network,
    /// Access clipboard
    Clipboard,
    /// Show notifications
    Notifications,
    /// Access system shell
    Shell,
    /// Access local storage
    Storage,
    /// Execute backend commands
    BackendCommands,
    /// Custom permission with description
    Custom(String),
}

/// Dependency on another plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDependency {
    /// Plugin ID of the dependency
    pub id: String,
    /// Required version (semver range)
    pub version: String,
    /// Whether the dependency is optional
    #[serde(default)]
    pub optional: bool,
}

/// Frontend entry point configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendEntry {
    /// Path to the main module (relative to plugin root)
    pub main: String,
    /// Path to styles (optional)
    #[serde(default)]
    pub styles: Option<String>,
}

/// Backend entry point configuration (for future WASM support)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendEntry {
    /// Path to WASM module (relative to plugin root)
    pub wasm: String,
}

impl PluginManifest {
    /// Validate the manifest
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.id.is_empty() {
            errors.push("Plugin ID cannot be empty".to_string());
        }

        if self.name.is_empty() {
            errors.push("Plugin name cannot be empty".to_string());
        }

        if self.version.is_empty() {
            errors.push("Plugin version cannot be empty".to_string());
        }

        if self.api_version.is_empty() {
            errors.push("API version cannot be empty".to_string());
        }

        // Validate plugin ID format (reverse domain notation)
        if !self.id.contains('.') && !self.core {
            errors.push("Plugin ID should use reverse domain notation (e.g., com.example.plugin)".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Check if this plugin provides a specific capability type
    pub fn has_capability(&self, cap_type: &str) -> bool {
        self.capabilities.iter().any(|cap| {
            match cap {
                PluginCapability::NodeTypes { .. } => cap_type == "nodeTypes",
                PluginCapability::Panels { .. } => cap_type == "panels",
                PluginCapability::Commands { .. } => cap_type == "commands",
                PluginCapability::ContextMenus { .. } => cap_type == "contextMenus",
                PluginCapability::EdgeTypes { .. } => cap_type == "edgeTypes",
                PluginCapability::Themes { .. } => cap_type == "themes",
                PluginCapability::Formats { .. } => cap_type == "formats",
                PluginCapability::Custom { name, .. } => name == cap_type,
            }
        })
    }

    /// Get all node types provided by this plugin
    pub fn get_node_types(&self) -> Vec<&str> {
        self.capabilities
            .iter()
            .filter_map(|cap| match cap {
                PluginCapability::NodeTypes { types } => Some(types.iter().map(|s| s.as_str())),
                _ => None,
            })
            .flatten()
            .collect()
    }
}
