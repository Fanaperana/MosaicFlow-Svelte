// Built-in MCP server commands (see services/mcp_http.rs).

use serde_json::Value;
use tauri::{AppHandle, State};

use crate::services::mcp_http::{McpHttpConfig, McpHttpState};

#[tauri::command]
pub async fn mcp_http_start(app: AppHandle, state: State<'_, McpHttpState>, config: McpHttpConfig) -> Result<(), String> {
    state.start(app, config).await
}

#[tauri::command]
pub fn mcp_http_stop(state: State<'_, McpHttpState>) {
    state.stop();
}

#[tauri::command]
pub fn mcp_http_reply(state: State<'_, McpHttpState>, message: Value) {
    state.reply(message);
}
