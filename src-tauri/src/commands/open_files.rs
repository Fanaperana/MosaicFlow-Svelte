// Files the OS asks MosaicFlow to open (double-click / "Open with"): .mosaic packages, Obsidian
// canvases, Mermaid files. Paths arrive on the command line (Windows/Linux), through a second
// instance (forwarded by the single-instance plugin) or as macOS "opened" events.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_fs::FsExt;

pub const OPEN_FILES_EVENT: &str = "mosaicflow://open-files";
const OPENABLE: &[&str] = &["mosaic", "canvas", "mmd", "mermaid"];

#[derive(Default)]
pub struct PendingOpenFiles(pub Mutex<Vec<String>>);

/// Keeps only existing files with a supported extension and lets the webview read them.
pub fn accept_paths(app: &AppHandle, args: impl IntoIterator<Item = PathBuf>) -> Vec<String> {
    args.into_iter()
        .filter(|p| p.is_file() && is_openable(p))
        .filter_map(|p| {
            let path = p.canonicalize().unwrap_or(p);
            let _ = app.fs_scope().allow_file(&path);
            path.to_str()
                .map(|s| s.trim_start_matches(r"\\?\").to_string())
        })
        .collect()
}

pub fn paths_from_args(args: &[String]) -> Vec<PathBuf> {
    args.iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(PathBuf::from)
        .collect()
}

/// Queues files for the frontend and notifies it (it may not be listening yet at startup).
pub fn queue_open_files(app: &AppHandle, files: Vec<String>) {
    if files.is_empty() {
        return;
    }
    if let Some(state) = app.try_state::<PendingOpenFiles>() {
        state.0.lock().unwrap().extend(files.iter().cloned());
    }
    let _ = app.emit(OPEN_FILES_EVENT, files);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Returns and clears the files waiting to be opened.
#[tauri::command]
pub fn take_pending_open_files(state: State<'_, PendingOpenFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

fn is_openable(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| OPENABLE.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}
