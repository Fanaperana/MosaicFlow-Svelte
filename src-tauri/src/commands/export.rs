// Export Commands
//
// Tauri command handlers for export operations

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::fs;

/// Save PNG image from base64 data
#[tauri::command]
pub async fn save_png(file_path: String, base64_data: String) -> Result<bool, String> {
    // Decode base64 to binary
    let image_data = BASE64
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Write to file
    fs::write(&file_path, &image_data).map_err(|e| format!("Failed to write PNG file: {}", e))?;

    Ok(true)
}

/// Convert SVG content to high-resolution PNG and save to file
/// 
/// This uses resvg for high-quality rendering without browser canvas limits.
/// The scale factor multiplies the SVG dimensions for higher resolution output.
#[tauri::command]
pub async fn svg_to_png(
    svg_content: String,
    file_path: String,
    scale: f32,
) -> Result<bool, String> {
    use resvg::tiny_skia::Pixmap;
    use resvg::usvg::{Options, Transform, Tree};

    // Parse SVG
    let options = Options::default();
    let tree = Tree::from_str(&svg_content, &options)
        .map_err(|e| format!("Failed to parse SVG: {}", e))?;

    // Get original size
    let original_size = tree.size();
    let width = (original_size.width() * scale) as u32;
    let height = (original_size.height() * scale) as u32;

    // Create pixmap (the canvas to render onto)
    let mut pixmap = Pixmap::new(width, height)
        .ok_or_else(|| format!("Failed to create pixmap {}x{}", width, height))?;

    // Fill with dark background
    pixmap.fill(resvg::tiny_skia::Color::from_rgba8(10, 10, 10, 255));

    // Render SVG to pixmap with scaling transform
    let transform = Transform::from_scale(scale, scale);
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    // Encode as PNG and save
    let png_data = pixmap
        .encode_png()
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    fs::write(&file_path, &png_data)
        .map_err(|e| format!("Failed to write PNG file: {}", e))?;

    Ok(true)
}
