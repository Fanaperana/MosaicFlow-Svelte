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
│   └── example-todo-node/       # Example community plugin
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

Frontend registries manage UI contributions:

- **NodeRegistry**: Node type components
- **PanelRegistry**: Panel components
- **CommandRegistry**: Commands and shortcuts

## Plugin Types

### Core Plugins

Core plugins are bundled with the application:

```typescript
// Loaded at startup
import { initializePluginSystem } from '$lib/plugins';
await initializePluginSystem();
```

### Community Plugins

Community plugins are loaded from the plugins directory:

```typescript
// Load from external folder
await pluginLoader.loadExternalPlugin(manifest, moduleUrl);
```

### Premium Plugins

Premium plugins use the same mechanism but may include:
- License validation
- Encrypted modules
- Additional permissions

## Command Routing

All plugin commands go through `kernel_invoke`:

```typescript
// Frontend
const response = await kernelInvoke('core.content', 'get_node_data', { nodeId });

// Routes to backend
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

Plugins receive an API object for registration:

```typescript
export function activate(api: PluginAPI) {
    // Register node types
    api.registerNodeTypes([
        {
            type: 'myNode',
            label: 'My Node',
            component: MyNodeComponent,
            // ...
        }
    ]);
    
    // Register commands
    api.registerCommands([
        {
            id: 'myPlugin.doSomething',
            label: 'Do Something',
            handler: () => { /* ... */ }
        }
    ]);
}
```

## Permissions

Plugins declare required permissions in their manifest:

```json
{
    "permissions": [
        "file_read",
        "file_write",
        "network"
    ]
}
```

The PolicyChecker validates permissions before operations:

```rust
policy.check_permission(plugin_id, &PluginPermission::Network, "fetch_url")?;
```

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

- Reload plugins without restarting
- Development mode with file watching
