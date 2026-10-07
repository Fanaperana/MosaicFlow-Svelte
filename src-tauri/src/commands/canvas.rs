// Canvas Commands
//
// Tauri command handlers for canvas operations

use crate::events::EventEmitter;
use crate::models::{CanvasInfo, CanvasUIState};
use crate::services::{CanvasService, HistoryService, StateService, VaultService};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

/// Create a new canvas in a vault
#[tauri::command]
pub async fn create_canvas(
    app_handle: AppHandle,
    vault_path: String,
    vault_id: String,
    name: String,
    description: Option<String>,
) -> Result<CanvasInfo, String> {
    let vault = Path::new(&vault_path);
    let canvases_dir = vault.join("canvases");

    let canvas = CanvasService::create(&canvases_dir, &vault_id, &name, description.as_deref())
        .map_err(|e| e.to_string())?;

    // Allow canvas directory in fs scope for state persistence (recursive includes .mosaic and all subdirs)
    let canvas_path = Path::new(&canvas.path);
    let _ = app_handle.fs_scope().allow_directory(canvas_path, true);

    // Track in history
    HistoryService::track_canvas(
        &app_handle,
        canvas.id.clone(),
        canvas.vault_id.clone(),
        canvas.name.clone(),
        canvas.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Update state
    StateService::update_last_opened(&app_handle, None, Some(canvas.id.clone()))
        .map_err(|e| e.to_string())?;

    // Emit events
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_created(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);
    if let Ok(h) = HistoryService::load(&app_handle) {
        emitter.history_changed(h.vaults.len(), h.canvases.len());
    }

    Ok(canvas)
}

/// Open a canvas
#[tauri::command]
pub async fn open_canvas(app_handle: AppHandle, canvas_path: String) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas = CanvasService::open(path).map_err(|e| e.to_string())?;

    // Allow canvas directory in fs scope for state persistence (recursive includes .mosaic and all subdirs)
    let _ = app_handle.fs_scope().allow_directory(path, true);

    // Track in history
    HistoryService::track_canvas(
        &app_handle,
        canvas.id.clone(),
        canvas.vault_id.clone(),
        canvas.name.clone(),
        canvas.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Update state
    StateService::update_last_opened(&app_handle, None, Some(canvas.id.clone()))
        .map_err(|e| e.to_string())?;

    // Emit events
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_opened(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);
    if let Ok(h) = HistoryService::load(&app_handle) {
        emitter.history_changed(h.vaults.len(), h.canvases.len());
    }

    Ok(canvas)
}

/// List all canvases in a vault
#[tauri::command]
pub async fn list_canvases(vault_path: String) -> Result<Vec<CanvasInfo>, String> {
    VaultService::list_canvases(Path::new(&vault_path)).map_err(|e| e.to_string())
}

#[derive(Debug, Default, Serialize)]
pub struct RawFile {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Default, Serialize)]
pub struct CanvasFiles {
    pub nodes: Vec<RawFile>,
    pub edges: Vec<RawFile>,
}

/// Every node and edge file of a canvas in one IPC round-trip.
#[tauri::command]
pub async fn read_canvas_files(
    app_handle: AppHandle,
    canvas_path: String,
) -> Result<CanvasFiles, String> {
    let root = PathBuf::from(&canvas_path);
    if !app_handle.fs_scope().is_allowed(&root) {
        return Err(format!("Path is not in an open vault: {canvas_path}"));
    }
    tauri::async_runtime::spawn_blocking(move || read_canvas_dir(&root))
        .await
        .map_err(|e| e.to_string())
}

pub fn read_canvas_dir(root: &Path) -> CanvasFiles {
    let mut files = CanvasFiles::default();
    for (path, id) in regular_files(&root.join("nodes"), "md") {
        if let Ok(content) = fs::read_to_string(&path) {
            files.nodes.push(RawFile { id, content });
        }
    }
    let edges_dir = root.join("edges");
    // v2: edges/<id>/joined.json; v3: edges/<id>.json
    if let Ok(entries) = fs::read_dir(&edges_dir) {
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if !kind.is_dir() {
                continue;
            }
            let joined = entry.path().join("joined.json");
            let is_file = fs::symlink_metadata(&joined).is_ok_and(|m| m.is_file());
            if let (true, Some(id)) = (is_file, entry.file_name().to_str()) {
                if let Ok(content) = fs::read_to_string(&joined) {
                    files.edges.push(RawFile {
                        id: id.to_string(),
                        content,
                    });
                }
            }
        }
    }
    for (path, id) in regular_files(&edges_dir, "json") {
        if let Ok(content) = fs::read_to_string(&path) {
            files.edges.push(RawFile { id, content });
        }
    }
    files
}

/// (path, file stem) of regular files with the given extension; symlinks are skipped so a
/// vault cannot pull in files from outside its folder.
fn regular_files(dir: &Path, ext: &str) -> Vec<(PathBuf, String)> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter_map(|e| {
            let path = e.path();
            if path.extension().and_then(|x| x.to_str()) != Some(ext) {
                return None;
            }
            let id = path.file_stem()?.to_str()?.to_string();
            Some((path, id))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_v2_and_v3_layouts_and_skips_other_files() {
        let root = std::env::temp_dir().join(format!("mf-read-canvas-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("nodes")).unwrap();
        fs::create_dir_all(root.join("edges/e-old")).unwrap();
        fs::write(root.join("nodes/a.md"), "---\nid: a\n---\n").unwrap();
        fs::write(root.join("nodes/readme.txt"), "x").unwrap();
        fs::write(root.join("edges/e-old/joined.json"), "{}").unwrap();
        fs::write(root.join("edges/e-new.json"), "{}").unwrap();

        let files = read_canvas_dir(&root);
        let mut edge_ids: Vec<_> = files.edges.iter().map(|e| e.id.as_str()).collect();
        edge_ids.sort();
        assert_eq!(files.nodes.len(), 1);
        assert_eq!(files.nodes[0].id, "a");
        assert_eq!(edge_ids, ["e-new", "e-old"]);
        let _ = fs::remove_dir_all(&root);
    }

    /// MF_BENCH_VAULT=<vault> cargo test -p mosaicflow bench_read_vault -- --ignored --nocapture
    #[test]
    #[ignore]
    fn bench_read_vault() {
        let vault = PathBuf::from(std::env::var("MF_BENCH_VAULT").expect("MF_BENCH_VAULT"));
        let started = std::time::Instant::now();
        let (mut canvases, mut nodes, mut edges) = (0, 0, 0);
        for entry in fs::read_dir(vault.join("canvases")).unwrap().flatten() {
            let files = read_canvas_dir(&entry.path());
            canvases += 1;
            nodes += files.nodes.len();
            edges += files.edges.len();
        }
        println!(
            "{canvases} canvases, {nodes} nodes, {edges} edges read in {:?}",
            started.elapsed()
        );
    }
}

/// Close a canvas (notify backend, clear state)
#[tauri::command]
pub async fn close_canvas(
    app_handle: AppHandle,
    canvas_id: String,
    canvas_path: String,
    canvas_name: String,
    vault_id: String,
) -> Result<(), String> {
    // Clear last opened canvas from state
    StateService::update_last_opened(&app_handle, None::<String>, None::<String>)
        .map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_closed(&canvas_id, &canvas_path, &canvas_name, &vault_id);

    Ok(())
}

/// Rename a canvas
#[tauri::command]
pub async fn rename_canvas(
    app_handle: AppHandle,
    canvas_path: String,
    new_name: String,
) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas = CanvasService::rename(path, &new_name).map_err(|e| e.to_string())?;

    // Update history
    HistoryService::track_canvas(
        &app_handle,
        canvas.id.clone(),
        canvas.vault_id.clone(),
        canvas.name.clone(),
        canvas.path.clone(),
    )
    .map_err(|e| e.to_string())?;

    // Emit events
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_updated(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);
    if let Ok(h) = HistoryService::load(&app_handle) {
        emitter.history_changed(h.vaults.len(), h.canvases.len());
    }

    Ok(canvas)
}

/// Delete a canvas
#[tauri::command]
pub async fn delete_canvas(app_handle: AppHandle, canvas_path: String) -> Result<(), String> {
    let path = Path::new(&canvas_path);

    // Get canvas info before deletion
    let canvas = CanvasService::open(path).ok();

    // Delete the canvas
    let canvas_id = CanvasService::delete(path).map_err(|e| e.to_string())?;

    // Remove from history
    if let Some(id) = canvas_id.as_ref() {
        let _ = HistoryService::remove_canvas(&app_handle, id);
    }

    // Emit event
    if let Some(c) = canvas {
        let emitter = EventEmitter::new(&app_handle);
        emitter.canvas_deleted(&c.id, &c.vault_id);
        if let Ok(h) = HistoryService::load(&app_handle) {
            emitter.history_changed(h.vaults.len(), h.canvases.len());
        }
    }

    Ok(())
}

/// Update canvas tags
#[tauri::command]
pub async fn update_canvas_tags(
    app_handle: AppHandle,
    canvas_path: String,
    tags: Vec<String>,
) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas = CanvasService::update_tags(path, tags).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_updated(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);

    Ok(canvas)
}

/// Update canvas description
#[tauri::command]
pub async fn update_canvas_description(
    app_handle: AppHandle,
    canvas_path: String,
    description: String,
) -> Result<CanvasInfo, String> {
    let path = Path::new(&canvas_path);

    let canvas =
        CanvasService::update_description(path, &description).map_err(|e| e.to_string())?;

    // Emit event
    let emitter = EventEmitter::new(&app_handle);
    emitter.canvas_updated(&canvas.id, &canvas.path, &canvas.name, &canvas.vault_id);

    Ok(canvas)
}

/// Load canvas UI state
#[tauri::command]
pub async fn load_canvas_state(canvas_path: String) -> Result<CanvasUIState, String> {
    CanvasService::load_state(Path::new(&canvas_path)).map_err(|e| e.to_string())
}

/// Save canvas UI state
#[tauri::command]
pub async fn save_canvas_state(canvas_path: String, state: CanvasUIState) -> Result<(), String> {
    CanvasService::save_state(Path::new(&canvas_path), &state).map_err(|e| e.to_string())
}
