# MosaicFlow Plugin Architecture

This document describes the microkernel-style plugin architecture of MosaicFlow.

## Overview

MosaicFlow uses a microkernel architecture where:
- The **core kernel** is minimal and provides only essential services
- Most functionality is implemented as **plugins**
- Plugins can be **core** (bundled), **community** (open-source), or **premium** (commercial)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Svelte)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Registries │  │ Kernel API  │  │     Plugin Loader       │  │
│  │  - Nodes    │  │   Client    │  │  - Core plugins         │  │
│  │  - Panels   │  │             │  │  - Community plugins    │  │
│  │  - Commands │  │             │  │  - Dynamic import       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ kernel_invoke(plugin_id, cmd, payload)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │               kernel_invoke command handler                  ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Kernel Runtime                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Plugin    │  │   Event     │  │       Policy            │  │
│  │  Registry   │  │    Bus      │  │      Checker            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                         │                                        │
│         ┌───────────────┼───────────────┐                       │
│         ▼               ▼               ▼                       │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐                 │
│  │   Core    │   │ Community │   │  Premium  │                 │
│  │  Plugins  │   │  Plugins  │   │  Plugins  │                 │
│  └───────────┘   └───────────┘   └───────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
MosaicFlow/
├── crates/
│   ├── kernel_api/          # Stable types and traits
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── error.rs     # Error types
│   │       ├── event.rs     # Event bus types
│   │       ├── manifest.rs  # Plugin manifest types
│   │       ├── plugin.rs    # Plugin traits
│   │       ├── request.rs   # Request types
│   │       └── response.rs  # Response types
│   │
│   └── kernel_runtime/      # Runtime implementation
│       └── src/
│           ├── lib.rs
│           ├── kernel.rs         # Main kernel
│           ├── plugin_registry.rs
│           ├── dispatcher.rs     # Command routing
│           ├── event_bus.rs      # Event system
│           └── policy.rs         # Permission checking
│
├── src/
│   └── lib/
│       ├── kernel/              # Frontend kernel
│       │   ├── index.ts
│       │   ├── client.ts        # Kernel API client
│       │   ├── types.ts         # TypeScript types
│       │   ├── plugin-loader.ts # Plugin loader
│       │   └── registries/
│       │       ├── node-registry.ts
│       │       ├── panel-registry.ts
│       │       └── command-registry.ts
│       │
│       └── plugins/             # Core plugins
│           ├── index.ts         # Plugin bootstrap
│           ├── core-content/    # Content nodes plugin
│           ├── core-entity/     # Entity nodes plugin
│           ├── core-data/       # Data nodes plugin
│           └── core-utility/    # Utility nodes plugin
│
├── plugins/                     # External plugins directory
│   └── example-flashcard/       # Example community plugin
│
└── src-tauri/
    └── src/
        └── commands/
            └── kernel.rs        # Kernel Tauri commands
```

## Core Components

### Kernel API (kernel_api crate)

The kernel API crate defines stable types that don't change between versions:

- **PluginManifest**: Plugin configuration from plugin.json
- **Plugin trait**: Interface backend plugins must implement
- **KernelRequest/Response**: Command invocation types
- **KernelEvent**: Event bus message types
- **KernelError**: Standard error types

### Kernel Runtime (kernel_runtime crate)

The runtime implements the kernel services:

- **PluginRegistry**: Discovers and manages plugin lifecycle
- **CommandDispatcher**: Routes commands to appropriate plugins
- **EventBus**: Pub/sub system for events
- **PolicyChecker**: Validates permissions

### Frontend Registries

Frontend registries manage UI contributions (`src/lib/kernel/registries/`):

- **NodeRegistry**: node types (Svelte components for built-in nodes, `render` functions for user plugins)
- **PanelRegistry**: sidebar panels (`render` functions), shown via `src/lib/plugins/PluginPanel.svelte`
- **CommandRegistry**: commands and shortcuts, listed in the command palette
- **Template / layout registries** (`contribution-registry.ts`): applied by `src/lib/services/contributions.ts`

Each registration carries a `pluginId`; `pluginLoader.unloadPlugin()` removes all of a plugin's
contributions at once.

## Plugin Types

### Core Plugins

Built-in node sets and features, bundled with the app and registered at startup (`src/lib/plugins/`). They may
use Svelte components and are trusted.

### User Plugins

Folders in `{APP_DATA}/plugins` with a `plugin.json`. The Rust `plugin_service` discovers them and reads files
confined to each folder; `pluginStore` (`src/lib/stores/plugins.svelte.ts`) tracks which are enabled (off by
default), injects their CSS and asks `pluginLoader` to import the module from a blob URL and call
`activate(api)`. User plugins are framework-free: nodes and panels draw into a container element. They run in
the web view without a sandbox. See [PLUGIN_DEVELOPMENT.md](PLUGIN_DEVELOPMENT.md) and
[PLUGIN_API.md](PLUGIN_API.md).

Plugins can travel inside `.mosaic` packages (`.plugins/<id>/`); `packageService` lists them in the import
preview and installs the ones the user ticks.

## Command Routing

Backend plugin commands go through the `kernel_invoke` Tauri command (the frontend currently uses
registries and services directly, so nothing calls it yet):

```rust
#[tauri::command]
fn kernel_invoke(request: InvokeRequest) -> InvokeResponse {
    get_kernel().read().invoke(&request.into())
}

// Dispatched to plugin
fn handle_command(&self, request: &KernelRequest) -> KernelResult<KernelResponse> {
    match request.command.as_str() {
        "get_node_data" => self.get_node_data(request),
        _ => Err(KernelError::CommandNotFound { ... })
    }
}
```

## Event System

The event bus enables loose coupling:

```rust
// Backend emits event
kernel.emit_kernel(EventTopic::NodeCreated, json!({ "nodeId": id }));

// Frontend subscribes
kernel.subscribe((event) => {
    if (event.topic === 'node_created') {
        // Handle event
    }
});
```

## Plugin API

Plugins receive an API object in `activate(api)` (`src/lib/kernel/plugin-loader.ts`): `registerNodeTypes`,
`registerPanels`, `registerCommands`, `registerTemplates`, `registerLayouts`, `workspace`, `settings`, `ui`,
`commands` and `manifest`. Ids of commands, panels, templates and layouts are prefixed with the plugin id.
The full reference is [PLUGIN_API.md](PLUGIN_API.md).

## Permissions

The kernel crates define permission types and a `PolicyChecker` for backend plugins. Frontend user plugins are
not permission-checked: they run with the app's access, so users must enable them explicitly and are warned
before installing plugins bundled in packages.

## Future Enhancements

### WASM Plugin Runtime

Support for WebAssembly plugins:

```rust
pub struct WasmPlugin {
    module: wasmer::Module,
    instance: wasmer::Instance,
}

impl Plugin for WasmPlugin {
    fn handle_command(&self, request: &KernelRequest) -> KernelResult<KernelResponse> {
        // Call WASM function
    }
}
```

### Plugin Marketplace

- Plugin discovery and installation
- Version management
- Automatic updates
- Reviews and ratings

### Hot Reload

- Reload plugins on file change (today: **Rescan** in the Plugins dialog reloads them without a restart)
