// MosaicFlow Metadata Management System
// Handles UUID-based tracking, history, and state persistence
//
// Architecture:
// ┌─────────────────────────────────────────────────────────────────┐
// │                    APP DATA FOLDER                               │
// │  (~/.mosaicflow/ or platform equivalent)                        │
// │  └── data/                                                       │
// │      ├── data.json      ← Current app state (last opened)       │
// │      └── history.json   ← All recently opened items             │
// └─────────────────────────────────────────────────────────────────┘
//                               ↕ (UUID references)
// ┌─────────────────────────────────────────────────────────────────┐
// │                    VAULT FOLDER                                  │
// │  MyVault/                                                        │
// │  ├── vault.json         ← Vault UUID + metadata                 │
// │  ├── canvases/                                                   │
// │  │   └── MyCanvas/                                               │
// │  │       ├── .mosaic/   ← Hidden metadata folder                │
// │  │       │   ├── meta.json   ← Canvas UUID + metadata           │
// │  │       │   └── state.json  ← Viewport, selection state        │
// │  │       ├── workspace.json  ← Nodes, edges                     │
// │  │       └── ...                                                 │
// │  └── .mosaicflow/       ← Vault-level hidden config             │
// └─────────────────────────────────────────────────────────────────┘

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// App-level state stored in data/data.json
/// Tracks the current session state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppState {
    /// UUID of the last opened vault
    pub last_vault_id: Option<String>,
    /// UUID of the last opened canvas
    pub last_canvas_id: Option<String>,
    /// When the app state was last updated
    pub updated_at: String,
    /// App version for migration purposes
    pub version: String,
}

/// History tracking stored in data/history.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppHistory {
    /// Recently opened vaults
    pub vaults: Vec<VaultHistoryEntry>,
    /// Recently opened canvases
    pub canvases: Vec<CanvasHistoryEntry>,
    /// Maximum items to keep in history
    #[serde(default = "default_max_history")]
    pub max_items: usize,
}

fn default_max_history() -> usize {
    50
}

/// Entry in vault history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultHistoryEntry {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// File system path
    pub path: String,
    /// Last time this vault was opened
    pub last_opened: String,
    /// Number of times opened
    pub open_count: u32,
    /// When the vault was first added to history
    pub added_at: String,
}

/// Entry in canvas history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasHistoryEntry {
    /// Unique identifier
    pub id: String,
    /// Parent vault UUID
    pub vault_id: String,
    /// Display name
    pub name: String,
    /// File system path
    pub path: String,
    /// Last time this canvas was opened
    pub last_opened: String,
    /// Number of times opened
    pub open_count: u32,
    /// When the canvas was first added to history
    pub added_at: String,
}

/// Vault metadata stored in vault.json (updated to include UUID)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMeta {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// When the vault was created
    pub created_at: String,
    /// When the vault was last modified
    pub updated_at: String,
    /// Schema version for migrations
    pub version: String,
    /// Optional description
    #[serde(default)]
    pub description: String,
}

/// Canvas metadata stored in .mosaic/meta.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasMeta {
    /// Unique identifier
    pub id: String,
    /// Parent vault UUID
    pub vault_id: String,
    /// Display name
    pub name: String,
    /// When the canvas was created
    pub created_at: String,
    /// When the canvas was last modified
    pub updated_at: String,
    /// Schema version for migrations
    pub version: String,
    /// Optional description
    #[serde(default)]
    pub description: String,
    /// Tags for organization
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Canvas UI state stored in .mosaic/state.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanvasState {
    /// Viewport position and zoom
    pub viewport: ViewportState,
    /// Currently selected node IDs
    #[serde(default)]
    pub selected_nodes: Vec<String>,
    /// Currently selected edge IDs
    #[serde(default)]
    pub selected_edges: Vec<String>,
    /// Canvas mode (select, drag, etc.)
    #[serde(default = "default_canvas_mode")]
    pub canvas_mode: String,
    /// Last modified timestamp
    pub updated_at: String,
}

fn default_canvas_mode() -> String {
    "select".to_string()
}

/// Viewport state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ViewportState {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

/// Info returned to frontend about a vault (with UUID)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfoV2 {
    pub id: String,
    pub path: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub canvas_count: usize,
}

/// Info returned to frontend about a canvas (with vault reference)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasInfoV2 {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

/// Result type for metadata operations
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaResult<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

#[allow(dead_code)]
impl<T> MetaResult<T> {
    pub fn ok(data: T, message: &str) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            data: Some(data),
        }
    }

    pub fn err(message: &str) -> Self {
        Self {
            success: false,
            message: message.to_string(),
            data: None,
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Generate a new UUID v4
pub fn generate_uuid() -> String {
    Uuid::new_v4().to_string()
}

/// Get current timestamp as ISO 8601 string
pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

/// Get the app data directory
fn get_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;
    
    let data_dir = config_dir.join("data");
    
    // Ensure directory exists
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }
    
    Ok(data_dir)
}

/// Sanitize a name for use as a folder name
pub fn sanitize_name(name: &str) -> String {
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

// ============================================================================
// APP STATE MANAGEMENT
// ============================================================================

/// Load app state from data/data.json
#[tauri::command]
pub async fn load_app_state(app_handle: tauri::AppHandle) -> Result<AppState, String> {
    let data_dir = get_data_dir(&app_handle)?;
    let state_path = data_dir.join("data.json");
    
    if state_path.exists() {
        let content = fs::read_to_string(&state_path)
            .map_err(|e| format!("Failed to read app state: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse app state: {}", e))
    } else {
        // Return default state
        Ok(AppState {
            last_vault_id: None,
            last_canvas_id: None,
            updated_at: now_iso(),
            version: "1.0.0".to_string(),
        })
    }
}

/// Save app state to data/data.json
#[tauri::command]
pub async fn save_app_state(
    app_handle: tauri::AppHandle,
    state: AppState,
) -> Result<(), String> {
    let data_dir = get_data_dir(&app_handle)?;
    let state_path = data_dir.join("data.json");
    
    let mut state = state;
    state.updated_at = now_iso();
    
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize app state: {}", e))?;
    
    fs::write(&state_path, content)
        .map_err(|e| format!("Failed to write app state: {}", e))?;
    
    Ok(())
}

/// Update the last opened vault/canvas in app state
#[tauri::command]
pub async fn update_last_opened(
    app_handle: tauri::AppHandle,
    vault_id: Option<String>,
    canvas_id: Option<String>,
) -> Result<(), String> {
    let mut state = load_app_state(app_handle.clone()).await?;
    
    if let Some(vid) = vault_id {
        state.last_vault_id = Some(vid);
    }
    if let Some(cid) = canvas_id {
        state.last_canvas_id = Some(cid);
    }
    
    save_app_state(app_handle, state).await
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

/// Load history from data/history.json
#[tauri::command]
pub async fn load_history(app_handle: tauri::AppHandle) -> Result<AppHistory, String> {
    let data_dir = get_data_dir(&app_handle)?;
    let history_path = data_dir.join("history.json");
    
    if history_path.exists() {
        let content = fs::read_to_string(&history_path)
            .map_err(|e| format!("Failed to read history: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse history: {}", e))
    } else {
        Ok(AppHistory::default())
    }
}

/// Save history to data/history.json
async fn save_history(app_handle: &tauri::AppHandle, history: &AppHistory) -> Result<(), String> {
    let data_dir = get_data_dir(app_handle)?;
    let history_path = data_dir.join("history.json");
    
    let content = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;
    
    fs::write(&history_path, content)
        .map_err(|e| format!("Failed to write history: {}", e))?;
    
    Ok(())
}

/// Add or update a vault in history
#[tauri::command]
pub async fn track_vault_open(
    app_handle: tauri::AppHandle,
    id: String,
    name: String,
    path: String,
) -> Result<(), String> {
    let mut history = load_history(app_handle.clone()).await?;
    let now = now_iso();
    
    // Find existing entry or create new one
    if let Some(entry) = history.vaults.iter_mut().find(|v| v.id == id) {
        entry.name = name;
        entry.path = path;
        entry.last_opened = now;
        entry.open_count += 1;
    } else {
        history.vaults.push(VaultHistoryEntry {
            id,
            name,
            path,
            last_opened: now.clone(),
            open_count: 1,
            added_at: now,
        });
    }
    
    // Sort by last_opened descending
    history.vaults.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
    
    // Trim to max items
    if history.vaults.len() > history.max_items {
        history.vaults.truncate(history.max_items);
    }
    
    save_history(&app_handle, &history).await
}

/// Add or update a canvas in history
#[tauri::command]
pub async fn track_canvas_open(
    app_handle: tauri::AppHandle,
    id: String,
    vault_id: String,
    name: String,
    path: String,
) -> Result<(), String> {
    let mut history = load_history(app_handle.clone()).await?;
    let now = now_iso();
    
    // Find existing entry or create new one
    if let Some(entry) = history.canvases.iter_mut().find(|c| c.id == id) {
        entry.name = name;
        entry.path = path;
        entry.last_opened = now;
        entry.open_count += 1;
    } else {
        history.canvases.push(CanvasHistoryEntry {
            id,
            vault_id,
            name,
            path,
            last_opened: now.clone(),
            open_count: 1,
            added_at: now,
        });
    }
    
    // Sort by last_opened descending
    history.canvases.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
    
    // Trim to max items
    if history.canvases.len() > history.max_items {
        history.canvases.truncate(history.max_items);
    }
    
    save_history(&app_handle, &history).await
}

/// Remove a vault from history (and its canvases)
#[tauri::command]
pub async fn remove_vault_from_history(
    app_handle: tauri::AppHandle,
    vault_id: String,
) -> Result<(), String> {
    let mut history = load_history(app_handle.clone()).await?;
    
    history.vaults.retain(|v| v.id != vault_id);
    history.canvases.retain(|c| c.vault_id != vault_id);
    
    save_history(&app_handle, &history).await
}

/// Remove a canvas from history
#[tauri::command]
pub async fn remove_canvas_from_history(
    app_handle: tauri::AppHandle,
    canvas_id: String,
) -> Result<(), String> {
    let mut history = load_history(app_handle.clone()).await?;
    
    history.canvases.retain(|c| c.id != canvas_id);
    
    save_history(&app_handle, &history).await
}

/// Get recent vaults from history
#[tauri::command]
pub async fn get_recent_vaults(
    app_handle: tauri::AppHandle,
    limit: Option<usize>,
) -> Result<Vec<VaultHistoryEntry>, String> {
    let history = load_history(app_handle).await?;
    let limit = limit.unwrap_or(10);
    
    Ok(history.vaults.into_iter().take(limit).collect())
}

/// Get recent canvases from history (optionally filtered by vault)
#[tauri::command]
pub async fn get_recent_canvases(
    app_handle: tauri::AppHandle,
    vault_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<CanvasHistoryEntry>, String> {
    let history = load_history(app_handle).await?;
    let limit = limit.unwrap_or(10);
    
    let canvases: Vec<_> = if let Some(vid) = vault_id {
        history.canvases.into_iter().filter(|c| c.vault_id == vid).collect()
    } else {
        history.canvases
    };
    
    Ok(canvases.into_iter().take(limit).collect())
}

// ============================================================================
// VAULT METADATA MANAGEMENT (V2 with UUID)
// ============================================================================

/// Create a new vault with UUID
#[tauri::command]
pub async fn create_vault_v2(
    app_handle: tauri::AppHandle,
    path: String,
    name: String,
    description: Option<String>,
) -> Result<VaultInfoV2, String> {
    let vault_path = Path::new(&path);
    
    // Check if already exists
    if vault_path.exists() {
        let vault_json = vault_path.join("vault.json");
        if vault_json.exists() {
            return Err("A vault already exists at this location".to_string());
        }
    }
    
    // Create vault directory structure
    fs::create_dir_all(&vault_path)
        .map_err(|e| format!("Failed to create vault directory: {}", e))?;
    
    let dirs = ["canvases", "assets", "attachments", ".mosaicflow"];
    for dir in dirs {
        let dir_path = vault_path.join(dir);
        fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create {} directory: {}", dir, e))?;
    }
    
    // Create vault metadata with UUID
    let vault_id = generate_uuid();
    let now = now_iso();
    let vault_meta = VaultMeta {
        id: vault_id.clone(),
        name: name.clone(),
        created_at: now.clone(),
        updated_at: now.clone(),
        version: "2.0.0".to_string(),
        description: description.clone().unwrap_or_default(),
    };
    
    let vault_json_path = vault_path.join("vault.json");
    let content = serde_json::to_string_pretty(&vault_meta)
        .map_err(|e| format!("Failed to serialize vault metadata: {}", e))?;
    
    fs::write(&vault_json_path, content)
        .map_err(|e| format!("Failed to write vault.json: {}", e))?;
    
    // Create default canvas
    let canvas_result = create_canvas_v2_internal(
        vault_path,
        &vault_id,
        "Untitled",
        None,
    )?;
    
    // Track in history
    track_vault_open(
        app_handle.clone(),
        vault_id.clone(),
        name.clone(),
        path.clone(),
    ).await?;
    
    // Update app state
    update_last_opened(
        app_handle,
        Some(vault_id.clone()),
        Some(canvas_result.id),
    ).await?;
    
    Ok(VaultInfoV2 {
        id: vault_id,
        path,
        name,
        description: description.unwrap_or_default(),
        created_at: vault_meta.created_at,
        updated_at: vault_meta.updated_at,
        canvas_count: 1,
    })
}

/// Open an existing vault
#[tauri::command]
pub async fn open_vault_v2(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<VaultInfoV2, String> {
    let vault_path = Path::new(&path);
    let vault_json_path = vault_path.join("vault.json");
    
    if !vault_json_path.exists() {
        return Err("vault.json not found - not a valid vault".to_string());
    }
    
    let content = fs::read_to_string(&vault_json_path)
        .map_err(|e| format!("Failed to read vault.json: {}", e))?;
    
    // Try to parse as VaultMeta (v2)
    let vault_meta: VaultMeta = match serde_json::from_str(&content) {
        Ok(meta) => meta,
        Err(_) => {
            // Might be v1 format, migrate it
            migrate_vault_to_v2(vault_path)?
        }
    };
    
    // Count canvases
    let canvases_dir = vault_path.join("canvases");
    let canvas_count = if canvases_dir.exists() {
        fs::read_dir(&canvases_dir)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };
    
    // Track in history
    track_vault_open(
        app_handle.clone(),
        vault_meta.id.clone(),
        vault_meta.name.clone(),
        path.clone(),
    ).await?;
    
    // Update app state
    update_last_opened(app_handle, Some(vault_meta.id.clone()), None).await?;
    
    Ok(VaultInfoV2 {
        id: vault_meta.id,
        path,
        name: vault_meta.name,
        description: vault_meta.description,
        created_at: vault_meta.created_at,
        updated_at: vault_meta.updated_at,
        canvas_count,
    })
}

/// Migrate a v1 vault to v2 format (add UUID)
fn migrate_vault_to_v2(vault_path: &Path) -> Result<VaultMeta, String> {
    let vault_json_path = vault_path.join("vault.json");
    let content = fs::read_to_string(&vault_json_path)
        .map_err(|e| format!("Failed to read vault.json: {}", e))?;
    
    // Parse as generic JSON
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse vault.json: {}", e))?;
    
    // Add ID if missing
    if json.get("id").is_none() {
        json["id"] = serde_json::Value::String(generate_uuid());
    }
    
    // Add description if missing
    if json.get("description").is_none() {
        json["description"] = serde_json::Value::String(String::new());
    }
    
    // Update version
    json["version"] = serde_json::Value::String("2.0.0".to_string());
    json["updated_at"] = serde_json::Value::String(now_iso());
    
    // Write back
    let updated_content = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Failed to serialize vault.json: {}", e))?;
    
    fs::write(&vault_json_path, &updated_content)
        .map_err(|e| format!("Failed to write vault.json: {}", e))?;
    
    // Parse as VaultMeta
    serde_json::from_str(&updated_content)
        .map_err(|e| format!("Failed to parse migrated vault.json: {}", e))
}

/// Rename a vault
#[tauri::command]
pub async fn rename_vault_v2(
    app_handle: tauri::AppHandle,
    vault_path: String,
    new_name: String,
) -> Result<VaultInfoV2, String> {
    let path = Path::new(&vault_path);
    let vault_json_path = path.join("vault.json");
    
    let content = fs::read_to_string(&vault_json_path)
        .map_err(|e| format!("Failed to read vault.json: {}", e))?;
    
    let mut vault_meta: VaultMeta = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse vault.json: {}", e))?;
    
    vault_meta.name = new_name.clone();
    vault_meta.updated_at = now_iso();
    
    let updated_content = serde_json::to_string_pretty(&vault_meta)
        .map_err(|e| format!("Failed to serialize vault.json: {}", e))?;
    
    fs::write(&vault_json_path, updated_content)
        .map_err(|e| format!("Failed to write vault.json: {}", e))?;
    
    // Update history
    track_vault_open(
        app_handle,
        vault_meta.id.clone(),
        new_name,
        vault_path.clone(),
    ).await?;
    
    // Count canvases
    let canvases_dir = path.join("canvases");
    let canvas_count = if canvases_dir.exists() {
        fs::read_dir(&canvases_dir)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };
    
    Ok(VaultInfoV2 {
        id: vault_meta.id,
        path: vault_path,
        name: vault_meta.name,
        description: vault_meta.description,
        created_at: vault_meta.created_at,
        updated_at: vault_meta.updated_at,
        canvas_count,
    })
}

// ============================================================================
// CANVAS METADATA MANAGEMENT (V2 with UUID and .mosaic folder)
// ============================================================================

/// Create a canvas internally (shared logic)
fn create_canvas_v2_internal(
    vault_path: &Path,
    vault_id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<CanvasInfoV2, String> {
    let canvases_dir = vault_path.join("canvases");
    let canvas_folder_name = sanitize_name(name);
    let canvas_path = canvases_dir.join(&canvas_folder_name);
    
    // Handle name collision
    let final_canvas_path = if canvas_path.exists() {
        let mut counter = 1;
        loop {
            let new_name = format!("{}_{}", canvas_folder_name, counter);
            let new_path = canvases_dir.join(&new_name);
            if !new_path.exists() {
                break new_path;
            }
            counter += 1;
        }
    } else {
        canvas_path
    };
    
    // Create directory structure
    fs::create_dir_all(&final_canvas_path)
        .map_err(|e| format!("Failed to create canvas directory: {}", e))?;
    
    let subdirs = [".mosaic", "nodes", "edges", "images", "attachments"];
    for dir in subdirs {
        let dir_path = final_canvas_path.join(dir);
        fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create {} directory: {}", dir, e))?;
    }
    
    // Create canvas metadata in .mosaic/meta.json
    let canvas_id = generate_uuid();
    let now = now_iso();
    let canvas_meta = CanvasMeta {
        id: canvas_id.clone(),
        vault_id: vault_id.to_string(),
        name: name.to_string(),
        created_at: now.clone(),
        updated_at: now.clone(),
        version: "2.0.0".to_string(),
        description: description.unwrap_or_default().to_string(),
        tags: vec![],
    };
    
    let meta_path = final_canvas_path.join(".mosaic").join("meta.json");
    let meta_content = serde_json::to_string_pretty(&canvas_meta)
        .map_err(|e| format!("Failed to serialize canvas metadata: {}", e))?;
    
    fs::write(&meta_path, meta_content)
        .map_err(|e| format!("Failed to write meta.json: {}", e))?;
    
    // Create initial canvas state in .mosaic/state.json
    let canvas_state = CanvasState {
        viewport: ViewportState {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        },
        selected_nodes: vec![],
        selected_edges: vec![],
        canvas_mode: "select".to_string(),
        updated_at: now.clone(),
    };
    
    let state_path = final_canvas_path.join(".mosaic").join("state.json");
    let state_content = serde_json::to_string_pretty(&canvas_state)
        .map_err(|e| format!("Failed to serialize canvas state: {}", e))?;
    
    fs::write(&state_path, state_content)
        .map_err(|e| format!("Failed to write state.json: {}", e))?;
    
    // Create empty workspace.json
    let workspace_data = serde_json::json!({
        "version": "2.0.0",
        "nodes": [],
        "edges": [],
        "settings": {
            "gridSize": 20,
            "snapToGrid": true,
            "showMinimap": true
        }
    });
    
    let workspace_path = final_canvas_path.join("workspace.json");
    let workspace_content = serde_json::to_string_pretty(&workspace_data)
        .map_err(|e| format!("Failed to serialize workspace: {}", e))?;
    
    fs::write(&workspace_path, workspace_content)
        .map_err(|e| format!("Failed to write workspace.json: {}", e))?;
    
    Ok(CanvasInfoV2 {
        id: canvas_id,
        vault_id: vault_id.to_string(),
        name: name.to_string(),
        description: description.unwrap_or_default().to_string(),
        path: final_canvas_path.to_string_lossy().to_string(),
        created_at: canvas_meta.created_at,
        updated_at: canvas_meta.updated_at,
        tags: vec![],
    })
}

/// Create a new canvas in a vault
#[tauri::command]
pub async fn create_canvas_v2(
    app_handle: tauri::AppHandle,
    vault_path: String,
    vault_id: String,
    name: String,
    description: Option<String>,
) -> Result<CanvasInfoV2, String> {
    let vault_path = Path::new(&vault_path);
    
    let canvas = create_canvas_v2_internal(
        vault_path,
        &vault_id,
        &name,
        description.as_deref(),
    )?;
    
    // Track in history
    track_canvas_open(
        app_handle.clone(),
        canvas.id.clone(),
        canvas.vault_id.clone(),
        canvas.name.clone(),
        canvas.path.clone(),
    ).await?;
    
    // Update app state
    update_last_opened(app_handle, None, Some(canvas.id.clone())).await?;
    
    Ok(canvas)
}

/// Open a canvas
#[tauri::command]
pub async fn open_canvas_v2(
    app_handle: tauri::AppHandle,
    canvas_path: String,
) -> Result<CanvasInfoV2, String> {
    let path = Path::new(&canvas_path);
    
    // Try new format (.mosaic/meta.json)
    let meta_path = path.join(".mosaic").join("meta.json");
    let canvas_info = if meta_path.exists() {
        let content = fs::read_to_string(&meta_path)
            .map_err(|e| format!("Failed to read meta.json: {}", e))?;
        
        let canvas_meta: CanvasMeta = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse meta.json: {}", e))?;
        
        CanvasInfoV2 {
            id: canvas_meta.id,
            vault_id: canvas_meta.vault_id,
            name: canvas_meta.name,
            description: canvas_meta.description,
            path: canvas_path.clone(),
            created_at: canvas_meta.created_at,
            updated_at: canvas_meta.updated_at,
            tags: canvas_meta.tags,
        }
    } else {
        // Try old format (canvas.json) and migrate
        migrate_canvas_to_v2(path)?
    };
    
    // Track in history
    track_canvas_open(
        app_handle.clone(),
        canvas_info.id.clone(),
        canvas_info.vault_id.clone(),
        canvas_info.name.clone(),
        canvas_path.clone(),
    ).await?;
    
    // Update app state
    update_last_opened(app_handle, None, Some(canvas_info.id.clone())).await?;
    
    Ok(canvas_info)
}

/// Migrate a v1 canvas to v2 format
fn migrate_canvas_to_v2(canvas_path: &Path) -> Result<CanvasInfoV2, String> {
    let old_canvas_json = canvas_path.join("canvas.json");
    
    // Read old format if exists
    let (canvas_id, vault_id, name, created_at, updated_at) = if old_canvas_json.exists() {
        let content = fs::read_to_string(&old_canvas_json)
            .map_err(|e| format!("Failed to read canvas.json: {}", e))?;
        
        let json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse canvas.json: {}", e))?;
        
        let id = json.get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(generate_uuid);
        
        let name = json.get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Untitled".to_string());
        
        let created = json.get("created_at")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(now_iso);
        
        let updated = json.get("updated_at")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(now_iso);
        
        // Try to get vault_id from parent vault
        let vault_id = get_vault_id_from_path(canvas_path).unwrap_or_else(generate_uuid);
        
        (id, vault_id, name, created, updated)
    } else {
        (
            generate_uuid(),
            get_vault_id_from_path(canvas_path).unwrap_or_else(generate_uuid),
            canvas_path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled")
                .to_string(),
            now_iso(),
            now_iso(),
        )
    };
    
    // Create .mosaic directory
    let mosaic_dir = canvas_path.join(".mosaic");
    fs::create_dir_all(&mosaic_dir)
        .map_err(|e| format!("Failed to create .mosaic directory: {}", e))?;
    
    // Create meta.json
    let canvas_meta = CanvasMeta {
        id: canvas_id.clone(),
        vault_id: vault_id.clone(),
        name: name.clone(),
        created_at: created_at.clone(),
        updated_at: updated_at.clone(),
        version: "2.0.0".to_string(),
        description: String::new(),
        tags: vec![],
    };
    
    let meta_path = mosaic_dir.join("meta.json");
    let meta_content = serde_json::to_string_pretty(&canvas_meta)
        .map_err(|e| format!("Failed to serialize meta.json: {}", e))?;
    
    fs::write(&meta_path, meta_content)
        .map_err(|e| format!("Failed to write meta.json: {}", e))?;
    
    // Create state.json if not exists
    let state_path = mosaic_dir.join("state.json");
    if !state_path.exists() {
        let canvas_state = CanvasState {
            viewport: ViewportState::default(),
            selected_nodes: vec![],
            selected_edges: vec![],
            canvas_mode: "select".to_string(),
            updated_at: now_iso(),
        };
        
        let state_content = serde_json::to_string_pretty(&canvas_state)
            .map_err(|e| format!("Failed to serialize state.json: {}", e))?;
        
        fs::write(&state_path, state_content)
            .map_err(|e| format!("Failed to write state.json: {}", e))?;
    }
    
    Ok(CanvasInfoV2 {
        id: canvas_id,
        vault_id,
        name,
        description: String::new(),
        path: canvas_path.to_string_lossy().to_string(),
        created_at,
        updated_at,
        tags: vec![],
    })
}

/// Get vault ID from canvas path by reading parent vault.json
fn get_vault_id_from_path(canvas_path: &Path) -> Option<String> {
    // canvas_path is like /path/to/vault/canvases/MyCanvas
    let vault_path = canvas_path.parent()?.parent()?;
    let vault_json = vault_path.join("vault.json");
    
    if vault_json.exists() {
        let content = fs::read_to_string(&vault_json).ok()?;
        let json: serde_json::Value = serde_json::from_str(&content).ok()?;
        json.get("id")?.as_str().map(|s| s.to_string())
    } else {
        None
    }
}

/// List all canvases in a vault
#[tauri::command]
pub async fn list_canvases_v2(vault_path: String) -> Result<Vec<CanvasInfoV2>, String> {
    let vault_path = Path::new(&vault_path);
    let canvases_dir = vault_path.join("canvases");
    
    if !canvases_dir.exists() {
        return Ok(vec![]);
    }
    
    // Get vault ID
    let vault_id = get_vault_id_from_path(&canvases_dir.join("dummy"))
        .unwrap_or_default();
    
    let mut canvases = Vec::new();
    
    let entries = fs::read_dir(&canvases_dir)
        .map_err(|e| format!("Failed to read canvases directory: {}", e))?;
    
    for entry in entries.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }
        
        // Try new format first
        let meta_path = entry_path.join(".mosaic").join("meta.json");
        let canvas_info = if meta_path.exists() {
            if let Ok(content) = fs::read_to_string(&meta_path) {
                if let Ok(meta) = serde_json::from_str::<CanvasMeta>(&content) {
                    Some(CanvasInfoV2 {
                        id: meta.id,
                        vault_id: meta.vault_id,
                        name: meta.name,
                        description: meta.description,
                        path: entry_path.to_string_lossy().to_string(),
                        created_at: meta.created_at,
                        updated_at: meta.updated_at,
                        tags: meta.tags,
                    })
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            // Try old format
            let old_canvas_json = entry_path.join("canvas.json");
            if old_canvas_json.exists() {
                if let Ok(content) = fs::read_to_string(&old_canvas_json) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        Some(CanvasInfoV2 {
                            id: json.get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            vault_id: vault_id.clone(),
                            name: json.get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Untitled")
                                .to_string(),
                            description: String::new(),
                            path: entry_path.to_string_lossy().to_string(),
                            created_at: json.get("created_at")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            updated_at: json.get("updated_at")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            tags: vec![],
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        };
        
        if let Some(info) = canvas_info {
            canvases.push(info);
        }
    }
    
    // Sort by updated_at descending
    canvases.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    Ok(canvases)
}

/// Rename a canvas
#[tauri::command]
pub async fn rename_canvas_v2(
    app_handle: tauri::AppHandle,
    canvas_path: String,
    new_name: String,
) -> Result<CanvasInfoV2, String> {
    let path = Path::new(&canvas_path);
    let mosaic_dir = path.join(".mosaic");
    let meta_path = mosaic_dir.join("meta.json");
    
    // Ensure .mosaic directory exists
    if !mosaic_dir.exists() {
        // Migrate from old format
        migrate_canvas_to_v2(path)?;
    }
    
    // Read and update metadata
    let content = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read meta.json: {}", e))?;
    
    let mut canvas_meta: CanvasMeta = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse meta.json: {}", e))?;
    
    canvas_meta.name = new_name.clone();
    canvas_meta.updated_at = now_iso();
    
    let updated_content = serde_json::to_string_pretty(&canvas_meta)
        .map_err(|e| format!("Failed to serialize meta.json: {}", e))?;
    
    fs::write(&meta_path, updated_content)
        .map_err(|e| format!("Failed to write meta.json: {}", e))?;
    
    // Optionally rename folder
    let new_folder_name = sanitize_name(&new_name);
    let parent_dir = path.parent().ok_or("Cannot get parent directory")?;
    let new_path = parent_dir.join(&new_folder_name);
    
    let final_path = if new_path != path && !new_path.exists() {
        fs::rename(&path, &new_path)
            .map_err(|e| format!("Failed to rename folder: {}", e))?;
        new_path
    } else {
        path.to_path_buf()
    };
    
    // Update history
    track_canvas_open(
        app_handle,
        canvas_meta.id.clone(),
        canvas_meta.vault_id.clone(),
        new_name,
        final_path.to_string_lossy().to_string(),
    ).await?;
    
    Ok(CanvasInfoV2 {
        id: canvas_meta.id,
        vault_id: canvas_meta.vault_id,
        name: canvas_meta.name,
        description: canvas_meta.description,
        path: final_path.to_string_lossy().to_string(),
        created_at: canvas_meta.created_at,
        updated_at: canvas_meta.updated_at,
        tags: canvas_meta.tags,
    })
}

/// Delete a canvas
#[tauri::command]
pub async fn delete_canvas_v2(
    app_handle: tauri::AppHandle,
    canvas_path: String,
) -> Result<(), String> {
    let path = Path::new(&canvas_path);
    
    // Get canvas ID for history removal
    let meta_path = path.join(".mosaic").join("meta.json");
    let canvas_id = if meta_path.exists() {
        let content = fs::read_to_string(&meta_path).ok();
        content.and_then(|c| {
            serde_json::from_str::<CanvasMeta>(&c).ok().map(|m| m.id)
        })
    } else {
        None
    };
    
    // Delete directory
    fs::remove_dir_all(path)
        .map_err(|e| format!("Failed to delete canvas: {}", e))?;
    
    // Remove from history
    if let Some(id) = canvas_id {
        remove_canvas_from_history(app_handle, id).await?;
    }
    
    Ok(())
}

/// Save canvas state (viewport, selection, etc.)
#[tauri::command]
pub async fn save_canvas_state(
    canvas_path: String,
    state: CanvasState,
) -> Result<(), String> {
    let path = Path::new(&canvas_path);
    let mosaic_dir = path.join(".mosaic");
    
    // Ensure .mosaic directory exists
    if !mosaic_dir.exists() {
        fs::create_dir_all(&mosaic_dir)
            .map_err(|e| format!("Failed to create .mosaic directory: {}", e))?;
    }
    
    let state_path = mosaic_dir.join("state.json");
    
    let mut state = state;
    state.updated_at = now_iso();
    
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;
    
    fs::write(&state_path, content)
        .map_err(|e| format!("Failed to write state.json: {}", e))?;
    
    Ok(())
}

/// Load canvas state
#[tauri::command]
pub async fn load_canvas_state(canvas_path: String) -> Result<CanvasState, String> {
    let path = Path::new(&canvas_path);
    let state_path = path.join(".mosaic").join("state.json");
    
    if state_path.exists() {
        let content = fs::read_to_string(&state_path)
            .map_err(|e| format!("Failed to read state.json: {}", e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse state.json: {}", e))
    } else {
        Ok(CanvasState::default())
    }
}

/// Find a vault by UUID
#[tauri::command]
pub async fn find_vault_by_id(
    app_handle: tauri::AppHandle,
    vault_id: String,
) -> Result<Option<VaultHistoryEntry>, String> {
    let history = load_history(app_handle).await?;
    Ok(history.vaults.into_iter().find(|v| v.id == vault_id))
}

/// Find a canvas by UUID
#[tauri::command]
pub async fn find_canvas_by_id(
    app_handle: tauri::AppHandle,
    canvas_id: String,
) -> Result<Option<CanvasHistoryEntry>, String> {
    let history = load_history(app_handle).await?;
    Ok(history.canvases.into_iter().find(|c| c.id == canvas_id))
}
