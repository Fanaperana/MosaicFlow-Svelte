// MosaicVault - Vault Management System
// Handles all low-level vault operations using Rust for performance

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Vault metadata stored in vault.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMetadata {
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: String,
}

/// Canvas metadata stored in each canvas folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasMetadata {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Vault info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub canvas_count: usize,
}

/// Canvas info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
}

/// App configuration stored locally
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub current_vault_path: Option<String>,
    pub recent_vaults: Vec<RecentVault>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentVault {
    pub name: String,
    pub path: String,
    pub last_opened: String,
}

/// Result type for vault operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultOperationResult {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

impl VaultOperationResult {
    pub fn success(message: &str) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            data: None,
        }
    }

    pub fn success_with_data(message: &str, data: serde_json::Value) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            data: Some(data),
        }
    }

    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            message: message.to_string(),
            data: None,
        }
    }
}

/// Get the app config directory path
fn get_config_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))
}

/// Get the app config file path
fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = get_config_dir(app_handle)?;
    Ok(config_dir.join("config.json"))
}

/// Load app configuration
#[tauri::command]
pub async fn load_app_config(app_handle: tauri::AppHandle) -> Result<AppConfig, String> {
    let config_path = get_config_path(&app_handle)?;
    
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))
    } else {
        Ok(AppConfig::default())
    }
}

/// Save app configuration
#[tauri::command]
pub async fn save_app_config(
    app_handle: tauri::AppHandle,
    config: AppConfig,
) -> Result<VaultOperationResult, String> {
    let config_dir = get_config_dir(&app_handle)?;
    
    // Ensure config directory exists
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    
    let config_path = get_config_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    
    Ok(VaultOperationResult::success("Configuration saved"))
}

/// Create a new vault at the specified path
#[tauri::command]
pub async fn create_vault(path: String, name: String) -> Result<VaultOperationResult, String> {
    let vault_path = Path::new(&path);
    
    // Check if directory already exists
    if vault_path.exists() {
        // Check if it's already a vault
        let vault_json = vault_path.join("vault.json");
        if vault_json.exists() {
            return Ok(VaultOperationResult::error("A vault already exists at this location"));
        }
    }
    
    // Create vault directory
    fs::create_dir_all(&vault_path)
        .map_err(|e| format!("Failed to create vault directory: {}", e))?;
    
    // Create vault structure
    let dirs = ["canvases", "assets", "attachments", ".mosaicflow"];
    for dir in dirs {
        let dir_path = vault_path.join(dir);
        fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create {} directory: {}", dir, e))?;
    }
    
    // Create vault metadata
    let now = chrono_now();
    let metadata = VaultMetadata {
        name: name.clone(),
        created_at: now.clone(),
        updated_at: now,
        version: "1.0.0".to_string(),
    };
    
    let vault_json_path = vault_path.join("vault.json");
    let content = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize vault metadata: {}", e))?;
    
    fs::write(&vault_json_path, content)
        .map_err(|e| format!("Failed to write vault.json: {}", e))?;
    
    // Create default canvas
    let _canvas_result = create_canvas_internal(&vault_path, "Untitled")?;
    
    let vault_info = VaultInfo {
        path: path.clone(),
        name,
        created_at: metadata.created_at.clone(),
        updated_at: metadata.updated_at.clone(),
        canvas_count: 1,
    };
    
    Ok(VaultOperationResult::success_with_data(
        "Vault created successfully",
        serde_json::to_value(vault_info).unwrap(),
    ))
}

/// Open an existing vault
#[tauri::command]
pub async fn open_vault(path: String) -> Result<VaultInfo, String> {
    let vault_path = Path::new(&path);
    
    if !vault_path.exists() {
        return Err("Vault directory does not exist".to_string());
    }
    
    let vault_json_path = vault_path.join("vault.json");
    if !vault_json_path.exists() {
        return Err("Not a valid MosaicFlow vault (vault.json not found)".to_string());
    }
    
    let content = fs::read_to_string(&vault_json_path)
        .map_err(|e| format!("Failed to read vault.json: {}", e))?;
    
    let metadata: VaultMetadata = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse vault.json: {}", e))?;
    
    // Count canvases
    let canvases_path = vault_path.join("canvases");
    let canvas_count = if canvases_path.exists() {
        fs::read_dir(&canvases_path)
            .map(|entries| entries.filter_map(|e| e.ok()).count())
            .unwrap_or(0)
    } else {
        0
    };
    
    Ok(VaultInfo {
        path,
        name: metadata.name,
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
        canvas_count,
    })
}

/// List all canvases in a vault
#[tauri::command]
pub async fn list_canvases(vault_path: String) -> Result<Vec<CanvasInfo>, String> {
    let canvases_dir = Path::new(&vault_path).join("canvases");
    
    if !canvases_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut canvases = Vec::new();
    
    let entries = fs::read_dir(&canvases_dir)
        .map_err(|e| format!("Failed to read canvases directory: {}", e))?;
    
    for entry in entries.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            let canvas_json = entry_path.join("canvas.json");
            if canvas_json.exists() {
                if let Ok(content) = fs::read_to_string(&canvas_json) {
                    if let Ok(metadata) = serde_json::from_str::<CanvasMetadata>(&content) {
                        canvases.push(CanvasInfo {
                            id: metadata.id,
                            name: metadata.name,
                            path: entry_path.to_string_lossy().to_string(),
                            created_at: metadata.created_at,
                            updated_at: metadata.updated_at,
                        });
                    }
                }
            }
        }
    }
    
    // Sort by updated_at descending
    canvases.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    Ok(canvases)
}

/// Create a new canvas in the vault
#[tauri::command]
pub async fn create_canvas(vault_path: String, name: String) -> Result<CanvasInfo, String> {
    let vault = Path::new(&vault_path);
    create_canvas_internal(&vault, &name)
}

/// Internal function to create a canvas
fn create_canvas_internal(vault_path: &Path, name: &str) -> Result<CanvasInfo, String> {
    let canvases_dir = vault_path.join("canvases");
    
    // Ensure canvases directory exists
    if !canvases_dir.exists() {
        fs::create_dir_all(&canvases_dir)
            .map_err(|e| format!("Failed to create canvases directory: {}", e))?;
    }
    
    // Generate unique ID and folder name
    let id = generate_id();
    let folder_name = sanitize_folder_name(name);
    let canvas_path = canvases_dir.join(&folder_name);
    
    // Handle name collision
    let final_path = if canvas_path.exists() {
        let unique_folder = format!("{}_{}", folder_name, &id[..8]);
        canvases_dir.join(unique_folder)
    } else {
        canvas_path
    };
    
    // Create canvas directory structure
    fs::create_dir_all(&final_path)
        .map_err(|e| format!("Failed to create canvas directory: {}", e))?;
    
    let subdirs = ["nodes", "edges", "images", "attachments"];
    for subdir in subdirs {
        let subdir_path = final_path.join(subdir);
        fs::create_dir_all(&subdir_path)
            .map_err(|e| format!("Failed to create {} directory: {}", subdir, e))?;
    }
    
    // Create canvas metadata
    let now = chrono_now();
    let metadata = CanvasMetadata {
        id: id.clone(),
        name: name.to_string(),
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    
    let canvas_json_path = final_path.join("canvas.json");
    let content = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize canvas metadata: {}", e))?;
    
    fs::write(&canvas_json_path, content)
        .map_err(|e| format!("Failed to write canvas.json: {}", e))?;
    
    // Create empty workspace.json
    let workspace_data = serde_json::json!({
        "nodes": [],
        "edges": [],
        "viewport": { "x": 0, "y": 0, "zoom": 1 },
        "metadata": {
            "name": name,
            "description": "",
            "createdAt": &now,
            "updatedAt": &now
        },
        "settings": {
            "autoSave": true,
            "autoSaveInterval": 1000,
            "theme": "dark",
            "gridSize": 20,
            "snapToGrid": false,
            "showMinimap": true,
            "defaultNodeColor": "#1e1e1e",
            "defaultEdgeColor": "#555555"
        }
    });
    
    let workspace_path = final_path.join("workspace.json");
    let workspace_content = serde_json::to_string_pretty(&workspace_data)
        .map_err(|e| format!("Failed to serialize workspace: {}", e))?;
    
    fs::write(&workspace_path, workspace_content)
        .map_err(|e| format!("Failed to write workspace.json: {}", e))?;
    
    Ok(CanvasInfo {
        id,
        name: name.to_string(),
        path: final_path.to_string_lossy().to_string(),
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
    })
}

/// Rename a canvas (updates metadata and folder name)
#[tauri::command]
pub async fn rename_canvas(
    canvas_path: String,
    new_name: String,
) -> Result<CanvasInfo, String> {
    let old_path = Path::new(&canvas_path);
    
    if !old_path.exists() {
        return Err("Canvas directory does not exist".to_string());
    }
    
    // Read current metadata
    let canvas_json_path = old_path.join("canvas.json");
    let content = fs::read_to_string(&canvas_json_path)
        .map_err(|e| format!("Failed to read canvas.json: {}", e))?;
    
    let mut metadata: CanvasMetadata = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse canvas.json: {}", e))?;
    
    // Update metadata
    metadata.name = new_name.clone();
    metadata.updated_at = chrono_now();
    
    // Save updated metadata
    let updated_content = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize canvas metadata: {}", e))?;
    
    fs::write(&canvas_json_path, &updated_content)
        .map_err(|e| format!("Failed to write canvas.json: {}", e))?;
    
    // Rename folder if name changed significantly
    let new_folder_name = sanitize_folder_name(&new_name);
    let parent_dir = old_path.parent().ok_or("Cannot get parent directory")?;
    let new_path = parent_dir.join(&new_folder_name);
    
    let final_path = if new_path != old_path && !new_path.exists() {
        fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Failed to rename folder: {}", e))?;
        new_path
    } else {
        old_path.to_path_buf()
    };
    
    Ok(CanvasInfo {
        id: metadata.id,
        name: new_name,
        path: final_path.to_string_lossy().to_string(),
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
    })
}

/// Delete a canvas
#[tauri::command]
pub async fn delete_canvas(canvas_path: String) -> Result<VaultOperationResult, String> {
    let path = Path::new(&canvas_path);
    
    if !path.exists() {
        return Ok(VaultOperationResult::error("Canvas does not exist"));
    }
    
    // Move to trash or delete
    fs::remove_dir_all(&path)
        .map_err(|e| format!("Failed to delete canvas: {}", e))?;
    
    Ok(VaultOperationResult::success("Canvas deleted"))
}

/// Rename the vault
#[tauri::command]
pub async fn rename_vault(vault_path: String, new_name: String) -> Result<VaultInfo, String> {
    let path = Path::new(&vault_path);
    
    let vault_json_path = path.join("vault.json");
    if !vault_json_path.exists() {
        return Err("Not a valid vault".to_string());
    }
    
    // Read and update metadata
    let content = fs::read_to_string(&vault_json_path)
        .map_err(|e| format!("Failed to read vault.json: {}", e))?;
    
    let mut metadata: VaultMetadata = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse vault.json: {}", e))?;
    
    metadata.name = new_name.clone();
    metadata.updated_at = chrono_now();
    
    let updated_content = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize vault metadata: {}", e))?;
    
    fs::write(&vault_json_path, updated_content)
        .map_err(|e| format!("Failed to write vault.json: {}", e))?;
    
    // Optionally rename folder
    let new_folder_name = sanitize_folder_name(&new_name);
    let parent = path.parent().ok_or("Cannot get parent")?;
    let new_path = parent.join(&new_folder_name);
    
    let final_path = if new_path != path && !new_path.exists() {
        fs::rename(&path, &new_path)
            .map_err(|e| format!("Failed to rename vault folder: {}", e))?;
        new_path.to_string_lossy().to_string()
    } else {
        vault_path
    };
    
    let canvases_path = Path::new(&final_path).join("canvases");
    let canvas_count = if canvases_path.exists() {
        fs::read_dir(&canvases_path)
            .map(|entries| entries.filter_map(|e| e.ok()).count())
            .unwrap_or(0)
    } else {
        0
    };
    
    Ok(VaultInfo {
        path: final_path,
        name: new_name,
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
        canvas_count,
    })
}

/// Check if a path is a valid vault
#[tauri::command]
pub async fn is_valid_vault(path: String) -> Result<bool, String> {
    let vault_path = Path::new(&path);
    let vault_json = vault_path.join("vault.json");
    Ok(vault_json.exists())
}

/// Get vault info without opening it
#[tauri::command]
pub async fn get_vault_info(path: String) -> Result<Option<VaultInfo>, String> {
    let vault_path = Path::new(&path);
    let vault_json_path = vault_path.join("vault.json");
    
    if !vault_json_path.exists() {
        return Ok(None);
    }
    
    match fs::read_to_string(&vault_json_path) {
        Ok(content) => {
            match serde_json::from_str::<VaultMetadata>(&content) {
                Ok(metadata) => {
                    let canvases_path = vault_path.join("canvases");
                    let canvas_count = if canvases_path.exists() {
                        fs::read_dir(&canvases_path)
                            .map(|entries| entries.filter_map(|e| e.ok()).count())
                            .unwrap_or(0)
                    } else {
                        0
                    };
                    
                    Ok(Some(VaultInfo {
                        path,
                        name: metadata.name,
                        created_at: metadata.created_at,
                        updated_at: metadata.updated_at,
                        canvas_count,
                    }))
                }
                Err(_) => Ok(None),
            }
        }
        Err(_) => Ok(None),
    }
}

// Helper functions

fn chrono_now() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap();
    let secs = now.as_secs();
    
    // Simple ISO 8601 format (without external chrono dependency)
    // This gives us milliseconds since epoch, frontend can format it
    format!("{}", secs * 1000)
}

fn generate_id() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap();
    
    // Simple ID generation using timestamp + random
    let timestamp = now.as_nanos();
    let random: u32 = (timestamp % 1000000) as u32;
    format!("{:x}{:08x}", timestamp, random)
}

fn sanitize_folder_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .to_string()
}
