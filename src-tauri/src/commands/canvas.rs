// Canvas Commands
//
// Tauri command handlers for canvas operations

use crate::events::EventEmitter;
use crate::models::{CanvasInfo, CanvasUIState};
use crate::services::{CanvasService, HistoryService, StateService, VaultService};
use serde::Serialize;
use std::collections::HashMap;
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
    /// "<mtime ms>-<size>"; lets the caller keep its parsed copy when unchanged.
    pub stamp: String,
    /// None when the caller already has this stamp.
    pub content: Option<String>,
}

#[derive(Debug, Default, Serialize)]
pub struct CanvasFiles {
    pub nodes: Vec<RawFile>,
    pub edges: Vec<RawFile>,
}

/// Every node and edge file of a canvas in one IPC round-trip. `known` maps
/// "nodes/<id>" / "edges/<id>" to stamps the caller has cached; those files are not read.
#[tauri::command]
pub async fn read_canvas_files(
    app_handle: AppHandle,
    canvas_path: String,
    known: Option<HashMap<String, String>>,
) -> Result<CanvasFiles, String> {
    let root = PathBuf::from(&canvas_path);
    if !app_handle.fs_scope().is_allowed(&root) {
        return Err(format!("Path is not in an open vault: {canvas_path}"));
    }
    let known = known.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || read_canvas_dir(&root, &known))
        .await
        .map_err(|e| e.to_string())
}

pub fn read_canvas_dir(root: &Path, known: &HashMap<String, String>) -> CanvasFiles {
    let mut files = CanvasFiles::default();
    for (path, id, meta) in regular_files(&root.join("nodes"), "md") {
        files.nodes.extend(load(&path, &meta, id, "nodes", known));
    }
    let edges_dir = root.join("edges");
    // v2: edges/<id>/joined.json; v3: edges/<id>.json
    if let Ok(entries) = fs::read_dir(&edges_dir) {
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            let Some(id) = entry.file_name().to_str().map(str::to_string) else {
                continue;
            };
            if !kind.is_dir() {
                continue;
            }
            let joined = entry.path().join("joined.json");
            if let Ok(meta) = fs::symlink_metadata(&joined) {
                if meta.is_file() {
                    files.edges.extend(load(&joined, &meta, id, "edges", known));
                }
            }
        }
    }
    for (path, id, meta) in regular_files(&edges_dir, "json") {
        files.edges.extend(load(&path, &meta, id, "edges", known));
    }
    files
}

fn stamp(meta: &fs::Metadata) -> String {
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis());
    format!("{modified}-{}", meta.len())
}

fn load(
    path: &Path,
    meta: &fs::Metadata,
    id: String,
    kind: &str,
    known: &HashMap<String, String>,
) -> Option<RawFile> {
    let stamp = stamp(meta);
    if known.get(&format!("{kind}/{id}")) == Some(&stamp) {
        return Some(RawFile {
            id,
            stamp,
            content: None,
        });
    }
    let content = fs::read_to_string(path).ok()?;
    Some(RawFile {
        id,
        stamp,
        content: Some(content),
    })
}

/// (path, file stem, metadata) of regular files with the given extension; symlinks are skipped
/// so a vault cannot pull in files from outside its folder.
fn regular_files(dir: &Path, ext: &str) -> Vec<(PathBuf, String, fs::Metadata)> {
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
            // DirEntry::metadata comes from the directory listing on Windows (no extra open).
            let meta = e.metadata().ok()?;
            Some((path, id, meta))
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

        let files = read_canvas_dir(&root, &HashMap::new());
        let mut edge_ids: Vec<_> = files.edges.iter().map(|e| e.id.as_str()).collect();
        edge_ids.sort();
        assert_eq!(files.nodes.len(), 1);
        assert_eq!(files.nodes[0].id, "a");
        assert_eq!(edge_ids, ["e-new", "e-old"]);

        // Known stamps skip the read; a stale stamp re-reads.
        let known = HashMap::from([
            ("nodes/a".to_string(), files.nodes[0].stamp.clone()),
            ("edges/e-new".to_string(), "0-0".to_string()),
        ]);
        let again = read_canvas_dir(&root, &known);
        let content = |list: &[RawFile], id: &str| {
            list.iter()
                .find(|f| f.id == id)
                .map(|f| f.content.is_some())
        };
        assert_eq!(content(&again.nodes, "a"), Some(false));
        assert_eq!(content(&again.edges, "e-new"), Some(true));
        assert_eq!(content(&again.edges, "e-old"), Some(true));
        let _ = fs::remove_dir_all(&root);
    }

    /// MF_BENCH_VAULT=<vault> cargo test -p mosaicflow --release bench_read_vault -- --ignored --nocapture
    #[test]
    #[ignore]
    fn bench_read_vault() {
        let vault = PathBuf::from(std::env::var("MF_BENCH_VAULT").expect("MF_BENCH_VAULT"));
        let dirs: Vec<_> = fs::read_dir(vault.join("canvases"))
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .collect();
        let started = std::time::Instant::now();
        let mut stamps = Vec::new();
        let (mut nodes, mut edges) = (0, 0);
        for dir in &dirs {
            let files = read_canvas_dir(dir, &HashMap::new());
            nodes += files.nodes.len();
            edges += files.edges.len();
            let known: HashMap<_, _> = files
                .nodes
                .iter()
                .map(|f| (format!("nodes/{}", f.id), f.stamp.clone()))
                .chain(
                    files
                        .edges
                        .iter()
                        .map(|f| (format!("edges/{}", f.id), f.stamp.clone())),
                )
                .collect();
            stamps.push(known);
        }
        let full = started.elapsed();
        let started = std::time::Instant::now();
        for (dir, known) in dirs.iter().zip(&stamps) {
            read_canvas_dir(dir, known);
        }
        println!(
            "{} canvases, {nodes} nodes, {edges} edges: full read {full:?}, unchanged re-check {:?}",
            dirs.len(),
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
