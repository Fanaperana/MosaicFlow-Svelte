// MosaicFlow Application
//
// Modular architecture following enterprise patterns:
// ├── core/         - Foundational utilities (fs, time, id, paths, errors)
// ├── models/       - Data structures (single source of truth)
// ├── services/     - Business logic (DRY, testable)
// ├── commands/     - Tauri command handlers (thin wrappers)
// └── events/       - Real-time event system for reactive updates
//
// Microkernel Architecture:
// ├── kernel_api    - Stable types for plugin system
// └── kernel_runtime - Plugin loading, dispatch, and event bus

// Module declarations
pub mod commands;
pub mod core;
pub mod events;
pub mod models;
pub mod services;

// Re-export commands for Tauri registration
use commands::open_files::{accept_paths, paths_from_args, queue_open_files, PendingOpenFiles};
use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // A second launch (e.g. double-clicking a .mosaic file) hands its files to the running app.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let files = accept_paths(app, paths_from_args(&argv));
            queue_open_files(app, files);
        }))
        // Plugins
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(PendingOpenFiles::default())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let files = accept_paths(app.handle(), paths_from_args(&args));
            queue_open_files(app.handle(), files);
            Ok(())
        });

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        // Command handlers
        .invoke_handler(tauri::generate_handler![
            // Kernel commands (microkernel architecture)
            kernel_invoke,
            kernel_init,
            kernel_list_plugins,
            kernel_get_plugin_info,
            kernel_is_initialized,
            kernel_emit_event,
            // Vault commands
            create_vault,
            open_vault,
            close_vault,
            rename_vault,
            update_vault_description,
            is_valid_vault,
            get_vault_info,
            // Canvas commands
            create_canvas,
            open_canvas,
            close_canvas,
            list_canvases,
            read_canvas_files,
            rename_canvas,
            delete_canvas,
            update_canvas_tags,
            update_canvas_description,
            load_canvas_state,
            save_canvas_state,
            // Workspace commands
            load_workspace,
            save_workspace,
            update_nodes,
            update_edges,
            add_node,
            remove_node,
            add_edge,
            remove_edge,
            batch_update_workspace,
            // State commands
            load_app_state,
            save_app_state,
            update_last_opened,
            // Config commands (for vault picker)
            load_app_config,
            save_app_config,
            // Export commands
            save_png,
            svg_to_png,
            svg_to_png_headless,
            // History commands
            load_history,
            track_vault_open,
            track_canvas_open,
            remove_vault_from_history,
            remove_canvas_from_history,
            get_recent_vaults,
            get_recent_canvases,
            find_vault_by_id,
            find_canvas_by_id,
            // Plugin commands
            get_plugins_dir,
            discover_plugins,
            read_plugin_module,
            read_plugin_file,
            open_plugins_dir,
            // Files opened from the OS
            take_pending_open_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // macOS delivers "Open with" files as an event instead of command-line arguments.
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = _event {
                let paths = urls.into_iter().filter_map(|u| u.to_file_path().ok());
                let files = accept_paths(_app, paths);
                queue_open_files(_app, files);
            }
        });
}
