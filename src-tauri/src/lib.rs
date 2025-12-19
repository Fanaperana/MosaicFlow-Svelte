mod vault;
mod metadata;

use vault::*;
use metadata::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Vault management commands (v1 - deprecated)
            load_app_config,
            save_app_config,
            create_vault,
            open_vault,
            rename_vault,
            is_valid_vault,
            get_vault_info,
            // Canvas management commands (v1 - deprecated)
            list_canvases,
            create_canvas,
            rename_canvas,
            delete_canvas,
            // ============================================
            // V2 UUID-based metadata commands
            // ============================================
            // App state management
            load_app_state,
            save_app_state,
            update_last_opened,
            // History management
            load_history,
            track_vault_open,
            track_canvas_open,
            remove_vault_from_history,
            remove_canvas_from_history,
            get_recent_vaults,
            get_recent_canvases,
            // Vault v2 commands
            create_vault_v2,
            open_vault_v2,
            rename_vault_v2,
            // Canvas v2 commands
            create_canvas_v2,
            open_canvas_v2,
            list_canvases_v2,
            rename_canvas_v2,
            delete_canvas_v2,
            // Canvas state management
            save_canvas_state,
            load_canvas_state,
            // Lookup commands
            find_vault_by_id,
            find_canvas_by_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
