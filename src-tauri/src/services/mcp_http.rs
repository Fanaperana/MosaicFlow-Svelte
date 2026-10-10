// Built-in MCP server: MCP Streamable HTTP on 127.0.0.1. Requests are checked here (Host, Origin,
// content type, key) and their JSON-RPC messages are relayed to the webview, which runs the tools.
// Request ids are rewritten so several clients can share the one server in the webview.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

pub const MCP_MESSAGE_EVENT: &str = "mosaicflow://mcp-message";
const MAX_BODY: usize = 4 * 1024 * 1024;
const REPLY_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpHttpConfig {
    pub port: u16,
    pub key: String,
    pub require_key: bool,
    pub allow_key_in_url: bool,
}

#[derive(Default)]
struct Shared {
    config: Mutex<Option<McpHttpConfig>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<Value>>>,
    next_id: AtomicU64,
}

struct Running {
    port: u16,
    shutdown: oneshot::Sender<()>,
}

#[derive(Default)]
pub struct McpHttpState {
    shared: Arc<Shared>,
    running: Mutex<Option<Running>>,
}

#[derive(Clone)]
struct Ctx {
    app: AppHandle,
    shared: Arc<Shared>,
}

impl McpHttpState {
    /// Starts the server, or only swaps the config when it already runs on the same port.
    pub async fn start(&self, app: AppHandle, config: McpHttpConfig) -> Result<(), String> {
        let port = config.port;
        *self.shared.config.lock().unwrap() = Some(config);
        if self.running.lock().unwrap().as_ref().is_some_and(|r| r.port == port) {
            return Ok(());
        }
        self.stop_server();

        let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
            .await
            .map_err(|e| format!("Could not listen on 127.0.0.1:{port}: {e}"))?;
        let router = Router::new()
            .route("/mcp", post(handle_post).get(not_allowed).delete(not_allowed))
            .layer(DefaultBodyLimit::max(MAX_BODY))
            .with_state(Ctx { app, shared: self.shared.clone() });
        let (shutdown, stopped) = oneshot::channel::<()>();
        tauri::async_runtime::spawn(async move {
            let server = axum::serve(listener, router).with_graceful_shutdown(async {
                let _ = stopped.await;
            });
            if let Err(e) = server.await {
                eprintln!("[mcp] server stopped: {e}");
            }
        });
        *self.running.lock().unwrap() = Some(Running { port, shutdown });
        Ok(())
    }

    pub fn stop(&self) {
        *self.shared.config.lock().unwrap() = None;
        self.stop_server();
    }

    fn stop_server(&self) {
        if let Some(running) = self.running.lock().unwrap().take() {
            let _ = running.shutdown.send(());
        }
        self.shared.pending.lock().unwrap().clear();
    }

    /// A reply from the webview; ids that no request is waiting for are dropped.
    pub fn reply(&self, message: Value) {
        let Some(id) = message.get("id").and_then(Value::as_u64) else {
            return;
        };
        if let Some(waiting) = self.shared.pending.lock().unwrap().remove(&id) {
            let _ = waiting.send(message);
        }
    }
}

async fn not_allowed() -> Response {
    (StatusCode::METHOD_NOT_ALLOWED, [(header::ALLOW, "POST")]).into_response()
}

fn rpc_error(status: StatusCode, id: Value, code: i64, message: &str) -> Response {
    let body = json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } });
    (status, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Rejects requests from browsers (Origin), DNS rebinding (Host), wrong content types and missing keys.
fn check(headers: &HeaderMap, query: &HashMap<String, String>, config: &McpHttpConfig) -> Result<(), Response> {
    let port = config.port;
    let local = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
    let header_str = |name: header::HeaderName| headers.get(name).and_then(|v| v.to_str().ok());

    let host_ok = header_str(header::HOST).is_some_and(|h| local.iter().any(|l| l.eq_ignore_ascii_case(h)));
    if !host_ok {
        return Err(rpc_error(StatusCode::FORBIDDEN, Value::Null, -32000, "Host not allowed"));
    }
    if let Some(origin) = header_str(header::ORIGIN) {
        if !local.iter().any(|l| origin.eq_ignore_ascii_case(&format!("http://{l}"))) {
            return Err(rpc_error(StatusCode::FORBIDDEN, Value::Null, -32000, "Origin not allowed"));
        }
    }
    let json_body = header_str(header::CONTENT_TYPE)
        .is_some_and(|ct| ct.split(';').next().unwrap_or("").trim().eq_ignore_ascii_case("application/json"));
    if !json_body {
        return Err(rpc_error(StatusCode::UNSUPPORTED_MEDIA_TYPE, Value::Null, -32000, "Content-Type must be application/json"));
    }

    if config.require_key {
        let bearer = header_str(header::AUTHORIZATION).and_then(|v| v.strip_prefix("Bearer "));
        let from_url = if config.allow_key_in_url { query.get("token").map(String::as_str) } else { None };
        let key = config.key.as_bytes();
        let valid = [bearer, from_url].into_iter().flatten().any(|k| constant_time_eq(k.trim().as_bytes(), key));
        if config.key.is_empty() || !valid {
            return Err(rpc_error(StatusCode::UNAUTHORIZED, Value::Null, -32001, "Missing or invalid MosaicFlow key"));
        }
    }
    Ok(())
}

async fn handle_post(
    State(ctx): State<Ctx>,
    Query(query): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(config) = ctx.shared.config.lock().unwrap().clone() else {
        return rpc_error(StatusCode::SERVICE_UNAVAILABLE, Value::Null, -32000, "MCP server is stopped");
    };
    if let Err(rejected) = check(&headers, &query, &config) {
        return rejected;
    }
    let parsed: Value = match serde_json::from_slice(&body) {
        Ok(value) => value,
        Err(_) => return rpc_error(StatusCode::BAD_REQUEST, Value::Null, -32700, "Parse error"),
    };
    let (batch, messages) = match parsed {
        Value::Array(items) => (true, items),
        single => (false, vec![single]),
    };
    if messages.is_empty() || messages.iter().any(|m| !m.is_object()) {
        return rpc_error(StatusCode::BAD_REQUEST, Value::Null, -32600, "Invalid request");
    }

    let mut waiting = Vec::new();
    for mut message in messages {
        if message.get("method").is_none() {
            continue; // Replies to server-initiated requests; this server sends none.
        }
        let request_id = message.get("id").filter(|id| !id.is_null()).cloned();
        let Some(original_id) = request_id else {
            let _ = ctx.app.emit(MCP_MESSAGE_EVENT, message);
            continue;
        };
        let id = ctx.shared.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let (tx, rx) = oneshot::channel();
        ctx.shared.pending.lock().unwrap().insert(id, tx);
        message["id"] = json!(id);
        if ctx.app.emit(MCP_MESSAGE_EVENT, message).is_err() {
            ctx.shared.pending.lock().unwrap().remove(&id);
            return rpc_error(StatusCode::SERVICE_UNAVAILABLE, original_id, -32603, "MosaicFlow window is not available");
        }
        waiting.push((original_id, id, rx));
    }
    if waiting.is_empty() {
        return StatusCode::ACCEPTED.into_response();
    }

    let mut replies = Vec::with_capacity(waiting.len());
    for (original_id, id, rx) in waiting {
        let reply = match tokio::time::timeout(REPLY_TIMEOUT, rx).await {
            Ok(Ok(mut reply)) if reply.is_object() => {
                reply["id"] = original_id;
                reply
            }
            _ => {
                ctx.shared.pending.lock().unwrap().remove(&id);
                json!({ "jsonrpc": "2.0", "id": original_id, "error": { "code": -32603, "message": "MosaicFlow did not answer in time" } })
            }
        };
        replies.push(reply);
    }
    let body = if batch { Value::Array(replies) } else { replies.swap_remove(0) };
    (StatusCode::OK, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}
