mod vault;

use vault::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Vault management commands
            load_app_config,
            save_app_config,
            create_vault,
            open_vault,
            rename_vault,
            is_valid_vault,
            get_vault_info,
            // Canvas management commands
            list_canvases,
            create_canvas,
            rename_canvas,
            delete_canvas,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
