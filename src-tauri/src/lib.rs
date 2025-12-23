// MosaicFlow Application
//
// Modular architecture following enterprise patterns:
// ├── core/         - Foundational utilities (fs, time, id, paths, errors)
// ├── models/       - Data structures (single source of truth)
// ├── services/     - Business logic (DRY, testable)
// ├── commands/     - Tauri command handlers (thin wrappers)
// └── events/       - Real-time event system for reactive updates

// Module declarations
pub mod commands;
pub mod core;
pub mod events;
pub mod models;
pub mod services;

// Re-export commands for Tauri registration
use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugins
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        // Command handlers
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            create_vault,
            open_vault,
            rename_vault,
            update_vault_description,
            is_valid_vault,
            get_vault_info,
            // Canvas commands
            create_canvas,
            open_canvas,
            list_canvases,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
