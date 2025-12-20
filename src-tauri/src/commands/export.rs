// Export Commands
//
// Tauri command handlers for export operations

use std::fs;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// Save PNG image from base64 data
#[tauri::command]
pub async fn save_png(
    file_path: String,
    base64_data: String,
) -> Result<bool, String> {
    // Decode base64 to binary
    let image_data = BASE64.decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Write to file
    fs::write(&file_path, &image_data)
        .map_err(|e| format!("Failed to write PNG file: {}", e))?;
    
    Ok(true)
}
