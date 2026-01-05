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

/// Convert SVG content to high-resolution PNG using headless Chrome
/// 
/// This renders HTML/CSS/foreignObject correctly by using a real browser engine.
/// Scale factor controls the device pixel ratio for high-DPI output.
#[tauri::command]
pub async fn svg_to_png_headless(
    svg_content: String,
    file_path: String,
    scale: f32,
) -> Result<bool, String> {
    use headless_chrome::{Browser, LaunchOptions};
    use headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption;
    
    // Extract dimensions from SVG
    let width: u32 = extract_svg_dimension(&svg_content, "width").unwrap_or(1920);
    let height: u32 = extract_svg_dimension(&svg_content, "height").unwrap_or(1080);
    
    // Calculate scaled dimensions
    let scaled_width = (width as f32 * scale) as u32;
    let scaled_height = (height as f32 * scale) as u32;
    
    // Launch headless Chrome
    let browser = Browser::new(LaunchOptions {
        headless: true,
        window_size: Some((scaled_width, scaled_height)),
        ..Default::default()
    }).map_err(|e| format!("Failed to launch browser: {}", e))?;
    
    let tab = browser.new_tab()
        .map_err(|e| format!("Failed to create tab: {}", e))?;
    
    // Set viewport with high device scale factor
    tab.set_bounds(headless_chrome::types::Bounds::Normal {
        left: Some(0),
        top: Some(0),
        width: Some(scaled_width as f64),
        height: Some(scaled_height as f64),
    }).map_err(|e| format!("Failed to set bounds: {}", e))?;
    
    // Create HTML that displays the SVG at full size
    let html_content = format!(r#"
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * {{ margin: 0; padding: 0; }}
                html, body {{ 
                    width: {}px; 
                    height: {}px; 
                    overflow: hidden;
                    background: #0a0a0a;
                }}
                .svg-container {{
                    width: 100%;
                    height: 100%;
                    transform: scale({});
                    transform-origin: top left;
                }}
            </style>
        </head>
        <body>
            <div class="svg-container">{}</div>
        </body>
        </html>
    "#, scaled_width, scaled_height, scale, svg_content);
    
    // Navigate to data URL with HTML content
    let data_url = format!("data:text/html;charset=utf-8,{}", 
        urlencoding::encode(&html_content));
    
    tab.navigate_to(&data_url)
        .map_err(|e| format!("Failed to navigate: {}", e))?;
    
    // Wait for page to load
    tab.wait_until_navigated()
        .map_err(|e| format!("Failed to wait for navigation: {}", e))?;
    
    // Small delay to ensure rendering is complete
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    // Take screenshot
    let screenshot_data = tab.capture_screenshot(
        CaptureScreenshotFormatOption::Png,
        None,
        None,
        true, // from_surface - captures full page
    ).map_err(|e| format!("Failed to capture screenshot: {}", e))?;
    
    // Save to file
    fs::write(&file_path, &screenshot_data)
        .map_err(|e| format!("Failed to write PNG file: {}", e))?;
    
    Ok(true)
}

/// Helper to extract width/height from SVG attributes
fn extract_svg_dimension(svg: &str, attr: &str) -> Option<u32> {
    let pattern = format!(r#"{}="([^"]+)""#, attr);
    let re = regex::Regex::new(&pattern).ok()?;
    let caps = re.captures(svg)?;
    let value = caps.get(1)?.as_str();
    // Remove 'px' suffix if present
    let numeric = value.trim_end_matches("px");
    numeric.parse().ok()
}

/// Convert SVG content to high-resolution PNG and save to file (resvg version)
/// 
/// This uses resvg for high-quality rendering without browser canvas limits.
/// Generates pure SVG (no foreignObject/HTML) from the graph model data,
/// which can be rendered perfectly by resvg at any scale.
#[tauri::command]
pub async fn svg_to_png(
    svg_content: String,
    file_path: String,
    scale: f32,
) -> Result<bool, String> {
    use resvg::tiny_skia::Pixmap;
    use resvg::usvg::{Options, Transform, Tree, fontdb};

    // Set up font database with system fonts
    let mut fontdb = fontdb::Database::new();
    fontdb.load_system_fonts();
    
    // Add common fallback fonts
    fontdb.set_sans_serif_family("Arial");
    fontdb.set_serif_family("Times New Roman");
    fontdb.set_monospace_family("Courier New");

    // Parse SVG with font database
    let options = Options {
        fontdb: std::sync::Arc::new(fontdb),
        ..Default::default()
    };
    
    let tree = Tree::from_str(&svg_content, &options)
        .map_err(|e| format!("Failed to parse SVG: {}", e))?;

    // Get original size
    let original_size = tree.size();
    let width = (original_size.width() * scale) as u32;
    let height = (original_size.height() * scale) as u32;
    
    // Check for reasonable dimensions
    if width == 0 || height == 0 {
        return Err("SVG has zero dimensions".to_string());
    }
    
    // Cap at reasonable maximum to avoid memory issues
    let max_dimension = 16384u32;
    let (final_width, final_height, final_scale) = if width > max_dimension || height > max_dimension {
        let ratio = (max_dimension as f32 / width.max(height) as f32).min(1.0);
        let new_width = (width as f32 * ratio) as u32;
        let new_height = (height as f32 * ratio) as u32;
        let new_scale = scale * ratio;
        (new_width, new_height, new_scale)
    } else {
        (width, height, scale)
    };

    println!("Rendering SVG {}x{} at scale {} -> {}x{}", 
             original_size.width() as u32, original_size.height() as u32, 
             scale, final_width, final_height);

    // Create pixmap (the canvas to render onto)
    let mut pixmap = Pixmap::new(final_width, final_height)
        .ok_or_else(|| format!("Failed to create pixmap {}x{}", final_width, final_height))?;

    // Fill with dark background
    pixmap.fill(resvg::tiny_skia::Color::from_rgba8(10, 10, 10, 255));

    // Render SVG to pixmap with scaling transform
    let transform = Transform::from_scale(final_scale, final_scale);
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    // Encode as PNG and save
    let png_data = pixmap
        .encode_png()
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    println!("Writing {} bytes to {}", png_data.len(), file_path);
    
    fs::write(&file_path, &png_data)
        .map_err(|e| format!("Failed to write PNG file: {}", e))?;

    Ok(true)
}
