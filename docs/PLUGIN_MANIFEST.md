# Plugin Manifest Specification

This document describes the plugin.json manifest format for MosaicFlow plugins.

## Overview

Every MosaicFlow plugin must have a `plugin.json` file in its root directory. This manifest declares the plugin's identity, capabilities, permissions, and entry points.

## Manifest Schema

```json
{
  "id": "string",              // Required: Unique plugin identifier
  "name": "string",            // Required: Human-readable name
  "version": "string",         // Required: Semantic version
  "description": "string",     // Required: Short description
  "author": "string",          // Required: Author name or organization
  "license": "string",         // Optional: License identifier (e.g., "MIT")
  "homepage": "string",        // Optional: URL to plugin homepage/repo
  "apiVersion": "string",      // Required: Required kernel API version
  "pluginType": "string",      // Optional: "core" | "community" | "premium"
  "core": "boolean",           // Optional: Whether this is a core plugin
  "minAppVersion": "string",   // Optional: Minimum MosaicFlow version
  "capabilities": [...],       // Required: What the plugin provides
  "permissions": [...],        // Optional: What the plugin needs
  "dependencies": [...],       // Optional: Other plugins required
  "frontend": {...},           // Optional: Frontend entry point
  "backend": {...},            // Optional: Backend entry point (WASM)
  "configSchema": {...},       // Optional: JSON Schema for config
  "defaultConfig": {...}       // Optional: Default configuration
}
```

## Field Reference

### id (required)

Unique identifier for the plugin. Use reverse domain notation for non-core plugins.

```json
{
  "id": "com.example.my-plugin"
}
```

For core plugins, use the `core.*` namespace:
```json
{
  "id": "core.content"
}
```

### name (required)

Human-readable display name.

```json
{
  "name": "My Awesome Plugin"
}
```

### version (required)

Semantic version (semver) of the plugin.

```json
{
  "version": "1.0.0"
}
```

### description (required)

Short description of what the plugin does.

```json
{
  "description": "Adds custom node types for project management"
}
```

### author (required)

Author name or organization.

```json
{
  "author": "Jane Doe <jane@example.com>"
}
```

### apiVersion (required)

The kernel API version this plugin is compatible with.

```json
{
  "apiVersion": "0.1.0"
}
```

### pluginType (optional)

Classification of the plugin. Defaults to "community".

| Value | Description |
|-------|-------------|
| `core` | Bundled with the application |
| `community` | Open-source community plugin |
| `premium` | Commercial/premium plugin |

### capabilities (required)

Array of capabilities the plugin provides.

#### Node Types

```json
{
  "capabilities": [
    {
      "type": "nodeTypes",
      "types": ["todo", "kanban", "calendar"]
    }
  ]
}
```

#### Panels

```json
{
  "capabilities": [
    {
      "type": "panels",
      "panels": ["project-overview", "timeline"]
    }
  ]
}
```

#### Commands

```json
{
  "capabilities": [
    {
      "type": "commands",
      "commands": ["myPlugin.createTask", "myPlugin.exportTasks"]
    }
  ]
}
```

#### Context Menus

```json
{
  "capabilities": [
    {
      "type": "contextMenus",
      "menus": ["node-context", "canvas-context"]
    }
  ]
}
```

#### Edge Types

```json
{
  "capabilities": [
    {
      "type": "edgeTypes",
      "types": ["dependency", "timeline"]
    }
  ]
}
```

#### Themes

```json
{
  "capabilities": [
    {
      "type": "themes",
      "themes": ["dark-blue", "light-minimal"]
    }
  ]
}
```

#### Formats (Import/Export)

```json
{
  "capabilities": [
    {
      "type": "formats",
      "formats": ["csv-export", "json-import"]
    }
  ]
}
```

#### Custom Capabilities

```json
{
  "capabilities": [
    {
      "type": "custom",
      "name": "data-source",
      "metadata": {
        "protocol": "rest"
      }
    }
  ]
}
```

### permissions (optional)

Array of permissions the plugin requires.

| Permission | Description |
|------------|-------------|
| `file_read` | Read files in the vault |
| `file_write` | Write files in the vault |
| `network` | Make network requests |
| `clipboard` | Access clipboard |
| `notifications` | Show notifications |
| `shell` | Execute shell commands (dangerous) |
| `storage` | Access local storage |
| `backend_commands` | Execute backend commands |

```json
{
  "permissions": ["file_read", "file_write", "network"]
}
```

Custom permissions:

```json
{
  "permissions": [
    "file_read",
    { "custom": "access_external_api" }
  ]
}
```

### dependencies (optional)

Other plugins this plugin depends on.

```json
{
  "dependencies": [
    {
      "id": "core.utility",
      "version": "^0.1.0"
    },
    {
      "id": "com.example.shared-lib",
      "version": ">=1.0.0 <2.0.0",
      "optional": true
    }
  ]
}
```

### frontend (optional)

Frontend entry point configuration.

```json
{
  "frontend": {
    "main": "./dist/index.js",
    "styles": "./dist/styles.css"
  }
}
```

- `main`: Path to the main JavaScript module (ES module)
- `styles`: Path to CSS styles to load

### backend (optional)

Backend entry point for WASM plugins (future).

```json
{
  "backend": {
    "wasm": "./dist/plugin.wasm"
  }
}
```

### configSchema (optional)

JSON Schema defining plugin configuration options.

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "description": "API key for external service"
      },
      "refreshInterval": {
        "type": "number",
        "default": 300,
        "description": "Refresh interval in seconds"
      }
    }
  }
}
```

### defaultConfig (optional)

Default values for plugin configuration.

```json
{
  "defaultConfig": {
    "refreshInterval": 300,
    "showNotifications": true
  }
}
```

## Complete Example

```json
{
  "id": "com.mosaicflow.community.todo",
  "name": "Todo Node",
  "version": "1.0.0",
  "description": "Adds a todo list node for task management",
  "author": "MosaicFlow Community",
  "license": "MIT",
  "homepage": "https://github.com/mosaicflow/plugin-todo",
  "apiVersion": "0.1.0",
  "pluginType": "community",
  "core": false,
  "minAppVersion": "0.5.0",
  "capabilities": [
    {
      "type": "nodeTypes",
      "types": ["todo"]
    },
    {
      "type": "commands",
      "commands": ["todo.createTask", "todo.clearCompleted"]
    }
  ],
  "permissions": [
    "storage"
  ],
  "dependencies": [],
  "frontend": {
    "main": "./dist/index.js",
    "styles": "./dist/styles.css"
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "defaultDueDate": {
        "type": "string",
        "enum": ["none", "today", "tomorrow", "next_week"],
        "default": "none"
      }
    }
  },
  "defaultConfig": {
    "defaultDueDate": "none"
  }
}
```

## Validation

The manifest is validated when:
1. Plugin is discovered
2. Plugin is loaded
3. Plugin compatibility is checked

Validation rules:
- `id`, `name`, `version`, `description`, `author`, `apiVersion` are required
- `version` and `apiVersion` must be valid semver
- Non-core plugins should use reverse domain notation for `id`
- `capabilities` must be a non-empty array
- All referenced types/panels/commands must be registered by the plugin
