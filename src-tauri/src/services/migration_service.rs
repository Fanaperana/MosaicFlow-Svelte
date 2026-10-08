// Migration Service
//
// Handles migration of old data formats to new versions

use crate::core::{self, CanvasPaths, MosaicError, MosaicResult, VaultPaths};
use crate::models::{CanvasFile, CanvasInfo, CanvasMeta, CanvasUIState, VaultInfo, VaultMeta};
use std::fs;
use std::path::Path;

pub struct MigrationService;

impl MigrationService {
    /// Migrate vault from v1 to v2 format
    pub fn migrate_vault(path: &Path) -> MosaicResult<VaultInfo> {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if !vault_paths.vault_json.exists() {
            return Err(MosaicError::vault_not_found(&path.to_string_lossy()));
        }

        // Read as generic JSON
        let content = core::read_string(&vault_paths.vault_json)?;
        let mut json: serde_json::Value = serde_json::from_str(&content)?;

        let now = core::now_iso();

        // Add ID if missing
        if json.get("id").is_none() {
            json["id"] = serde_json::Value::String(core::generate_uuid());
        }

        // Add description if missing
        if json.get("description").is_none() {
            json["description"] = serde_json::Value::String(String::new());
        }

        // Update version
        json["version"] = serde_json::Value::String("2.0.0".to_string());
        json["updated_at"] = serde_json::Value::String(now);

        // Write back
        let updated_content = serde_json::to_string_pretty(&json)?;
        core::write_string(&vault_paths.vault_json, &updated_content)?;

        // Parse as VaultMeta
        let meta: VaultMeta = serde_json::from_str(&updated_content)?;
        let canvas_count = core::list_subdirs(&vault_paths.canvases)
            .map(|dirs| dirs.len())
            .unwrap_or(0);

        Ok(VaultInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
            canvas_count,
        ))
    }

    /// Migrate canvas from v1 to v2 format
    pub fn migrate_canvas(path: &Path) -> MosaicResult<CanvasInfo> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        let old_canvas_json = path.join("canvas.json");

        // Create .mosaic directory
        core::ensure_dir(&canvas_paths.mosaic)?;

        let now = core::now_iso();

        // Read old format if exists
        let (canvas_id, vault_id, name, _created_at, _updated_at) = if old_canvas_json.exists() {
            let content = core::read_string(&old_canvas_json)?;
            let json: serde_json::Value = serde_json::from_str(&content)?;

            let id = json
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(core::generate_uuid);

            let name = json
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Untitled".to_string());

            let created = json
                .get("created_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| now.clone());

            let updated = json
                .get("updated_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| now.clone());

            // Try to get vault_id from parent vault
            let vault_id =
                Self::get_vault_id_from_canvas_path(path).unwrap_or_else(core::generate_uuid);

            (id, vault_id, name, created, updated)
        } else {
            (
                core::generate_uuid(),
                Self::get_vault_id_from_canvas_path(path).unwrap_or_else(core::generate_uuid),
                path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Untitled")
                    .to_string(),
                now.clone(),
                now.clone(),
            )
        };

        // Create meta.json
        let meta = CanvasMeta::new(canvas_id, vault_id, name);
        core::write_json(&canvas_paths.meta_json, &meta)?;

        // Create state.json if not exists
        if !canvas_paths.state_json.exists() {
            let state = CanvasUIState::default();
            core::write_json(&canvas_paths.state_json, &state)?;
        }

        Ok(CanvasInfo::from_meta(
            &meta,
            path.to_string_lossy().to_string(),
        ))
    }

    /// Migrate a canvas from v2 to v3, keeping copies of every replaced file under
    /// `<vault>/.mosaicflow/backup/v2-<timestamp>/<canvas folder>/`.
    ///
    /// v2: .mosaic/meta.json, .mosaic/state.json, workspace.json, edges/<id>/joined.json
    /// v3: canvas.json, edges/<id>.json, UI state in <vault>/.mosaicflow/state/<id>.json
    pub fn migrate_v2_to_v3(path: &Path) -> MosaicResult<CanvasInfo> {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        let meta: CanvasMeta = core::read_json(&canvas_paths.meta_json)?;
        let vault_root = path.parent().and_then(Path::parent).map(Path::to_path_buf);

        let workspace: serde_json::Value =
            core::read_json(&canvas_paths.workspace_json).unwrap_or(serde_json::Value::Null);
        let metadata = workspace.get("metadata");

        // Back up everything this migration rewrites or removes.
        if let Some(vault_root) = &vault_root {
            let folder = path.file_name().unwrap_or_default();
            let day = core::now_iso().chars().take(10).collect::<String>();
            let vault_paths = VaultPaths::from_root(vault_root);
            ensure_gitignore(&vault_paths)?;
            let backup = vault_paths.backup.join(format!("v2-{day}")).join(folder);
            copy_tree(&canvas_paths.mosaic, &backup.join(".mosaic"))?;
            copy_tree(&canvas_paths.edges, &backup.join("edges"))?;
            for file in [&canvas_paths.workspace_json, &canvas_paths.canvas_json] {
                if file.is_file() {
                    core::copy_file(file, &backup.join(file.file_name().unwrap_or_default()))?;
                }
            }
        }

        // 1. edges/<id>/joined.json -> edges/<id>.json
        for dir in core::list_subdirs(&canvas_paths.edges)? {
            let joined = dir.join("joined.json");
            let Some(id) = dir.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if joined.is_file() {
                core::copy_file(&joined, &canvas_paths.edges.join(format!("{id}.json")))?;
                fs::remove_file(&joined)?;
            }
            // Leave folders that still hold something unexpected.
            let _ = fs::remove_dir(&dir);
        }

        // 2. UI state -> <vault>/.mosaicflow/state/<id>.json (workspace.json has the live viewport)
        if let Some(vault_root) = &vault_root {
            let mut state: CanvasUIState =
                core::read_json(&canvas_paths.state_json).unwrap_or_default();
            if let Some(viewport) = metadata
                .and_then(|m| m.get("viewport"))
                .and_then(|v| serde_json::from_value(v.clone()).ok())
            {
                state.viewport = viewport;
            }
            let state_path = VaultPaths::from_root(vault_root).canvas_state(&meta.id);
            let safe_id = meta
                .id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
            if safe_id && !state_path.exists() {
                core::write_json(&state_path, &state)?;
            }
        }

        // 3. canvas.json last: its presence marks the canvas as v3.
        let mut file = CanvasFile::from(&meta);
        if let Some(settings) = metadata
            .and_then(|m| m.get("settings"))
            .and_then(|s| s.as_object())
        {
            file.settings = settings.clone();
        }
        core::write_json(&canvas_paths.canvas_json, &file)?;

        // 4. Clean up v2 files. workspace.json stays while it still holds node data the app migrates
        //    on load (legacy node folders need its types; v1 manifests embed whole nodes).
        let _ = fs::remove_dir_all(&canvas_paths.mosaic);
        let has_legacy_nodes = core::list_subdirs(&canvas_paths.nodes)
            .map(|d| !d.is_empty())
            .unwrap_or(false);
        let embeds_nodes = match workspace.get("nodes") {
            Some(serde_json::Value::Array(nodes)) => !nodes.is_empty(),
            Some(serde_json::Value::Object(nodes)) => {
                nodes.values().any(|n| n.get("position").is_some())
            }
            _ => false,
        };
        if !has_legacy_nodes && !embeds_nodes {
            let _ = fs::remove_file(&canvas_paths.workspace_json);
        }
        for dir in [&canvas_paths.images, &canvas_paths.attachments] {
            // Only removes empty folders.
            let _ = fs::remove_dir(dir);
        }

        Ok(CanvasInfo::from_file(
            &file,
            path.to_string_lossy().to_string(),
        ))
    }

    /// Get vault ID from canvas path by reading parent vault.json
    fn get_vault_id_from_canvas_path(canvas_path: &Path) -> Option<String> {
        // canvas_path is like /path/to/vault/canvases/MyCanvas
        let vault_path = canvas_path.parent()?.parent()?;
        let vault_json = vault_path.join("vault.json");

        if vault_json.exists() {
            let content = core::read_string(&vault_json).ok()?;
            let json: serde_json::Value = serde_json::from_str(&content).ok()?;
            json.get("id")?.as_str().map(|s| s.to_string())
        } else {
            None
        }
    }

    /// Check if vault needs migration
    pub fn vault_needs_migration(path: &Path) -> bool {
        let vault_paths = VaultPaths::from_root(&path.to_path_buf());

        if let Ok(content) = core::read_string(&vault_paths.vault_json) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                return json.get("id").is_none()
                    || json.get("version").and_then(|v| v.as_str()) != Some("2.0.0");
            }
        }

        true
    }

    /// Check if canvas needs migration
    pub fn canvas_needs_migration(path: &Path) -> bool {
        let canvas_paths = CanvasPaths::from_root(&path.to_path_buf());
        !canvas_paths.is_valid_v3() && (canvas_paths.is_valid_v2() || canvas_paths.is_valid_v1())
    }
}

/// Keeps per-device and derived folders out of git; adds missing lines to an existing file.
pub fn ensure_gitignore(vault_paths: &VaultPaths) -> MosaicResult<()> {
    let path = vault_paths.config.join(".gitignore");
    let current = core::read_string(&path).unwrap_or_default();
    let missing: Vec<&str> = ["cache/", "state/", "backup/"]
        .into_iter()
        .filter(|line| !current.lines().any(|l| l.trim() == *line))
        .collect();
    if missing.is_empty() {
        return Ok(());
    }
    let mut content = current;
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(&(missing.join("\n") + "\n"));
    core::write_string(&path, &content)
}

/// Recursively copies `from` into `to`; a missing `from` is not an error. Symlinks are skipped.
fn copy_tree(from: &Path, to: &Path) -> MosaicResult<()> {
    let Ok(entries) = fs::read_dir(from) else {
        return Ok(());
    };
    core::ensure_dir(to)?;
    for entry in entries.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let target = to.join(entry.file_name());
        if kind.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            core::copy_file(&entry.path(), &target)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_v2_canvas_to_v3_with_backup() {
        let vault = std::env::temp_dir().join(format!("mf-migrate-{}", std::process::id()));
        let _ = fs::remove_dir_all(&vault);
        let canvas = vault.join("canvases").join("Board");
        fs::create_dir_all(canvas.join(".mosaic")).unwrap();
        fs::create_dir_all(canvas.join("nodes")).unwrap();
        fs::create_dir_all(canvas.join("edges/e1")).unwrap();
        fs::create_dir_all(canvas.join("images")).unwrap();
        fs::write(vault.join("vault.json"), r#"{"id":"v","name":"V"}"#).unwrap();
        fs::write(
            canvas.join(".mosaic/meta.json"),
            r#"{"id":"c1","vault_id":"v","name":"Board","tags":["x"],"created_at":"t0","updated_at":"t1"}"#,
        )
        .unwrap();
        fs::write(
            canvas.join(".mosaic/state.json"),
            r#"{"viewport":{"x":0,"y":0,"zoom":1},"selected_nodes":["a"]}"#,
        )
        .unwrap();
        fs::write(
            canvas.join("workspace.json"),
            r#"{"metadata":{"viewport":{"x":5,"y":6,"zoom":2},"settings":{"gridSize":10}},"nodes":{},"edges":{}}"#,
        )
        .unwrap();
        fs::write(canvas.join("nodes/a.md"), "---\nid: a\n---\n").unwrap();
        fs::write(
            canvas.join("edges/e1/joined.json"),
            r#"{"source":"a","target":"a"}"#,
        )
        .unwrap();

        let info = MigrationService::migrate_v2_to_v3(&canvas).unwrap();
        assert_eq!((info.id.as_str(), info.tags.len()), ("c1", 1));

        let paths = CanvasPaths::from_root(&canvas);
        assert!(paths.is_valid_v3() && !paths.is_valid_v1());
        let file: CanvasFile = core::read_json(&paths.canvas_json).unwrap();
        assert_eq!(file.settings["gridSize"], 10);
        assert!(canvas.join("edges/e1.json").is_file());
        assert!(!canvas.join("edges/e1").exists());
        assert!(!paths.mosaic.exists() && !paths.workspace_json.exists() && !paths.images.exists());
        assert!(canvas.join("nodes/a.md").is_file());

        let state: CanvasUIState =
            core::read_json(&VaultPaths::from_root(&vault).canvas_state("c1")).unwrap();
        assert_eq!((state.viewport.x, state.selected_nodes.len()), (5.0, 1));

        let backups: Vec<_> = fs::read_dir(vault.join(".mosaicflow/backup"))
            .unwrap()
            .flatten()
            .collect();
        assert_eq!(backups.len(), 1);
        let gitignore = fs::read_to_string(vault.join(".mosaicflow/.gitignore")).unwrap();
        assert!(gitignore.contains("backup/") && gitignore.contains("state/"));
        let board = backups[0].path().join("Board");
        assert!(board.join(".mosaic/meta.json").is_file());
        assert!(board.join("edges/e1/joined.json").is_file());
        assert!(board.join("workspace.json").is_file());
        let _ = fs::remove_dir_all(&vault);
    }

    /// Migrates every canvas of a COPY of a real vault and prints the result:
    /// MF_MIGRATE_VAULT=<copy> cargo test -p mosaicflow migrate_real_vault -- --ignored --nocapture
    #[test]
    #[ignore]
    fn migrate_real_vault() {
        let vault =
            std::path::PathBuf::from(std::env::var("MF_MIGRATE_VAULT").expect("MF_MIGRATE_VAULT"));
        for canvas in crate::services::CanvasService::list(&vault.join("canvases")).unwrap() {
            println!("{} ({}) -> {}", canvas.name, canvas.id, canvas.path);
        }
    }
}
