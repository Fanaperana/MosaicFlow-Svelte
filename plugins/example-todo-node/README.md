# Example Todo Node Plugin

This is an example community plugin that demonstrates how to create a MosaicFlow plugin that adds a custom node type.

## Overview

The Todo Node plugin adds a checklist node type that allows users to create and manage task lists directly on the canvas.

## Installation

1. Copy this folder to your MosaicFlow plugins directory:
   - Windows: `%APPDATA%/mosaicflow/plugins/`
   - macOS: `~/Library/Application Support/mosaicflow/plugins/`
   - Linux: `~/.config/mosaicflow/plugins/`

2. Restart MosaicFlow

3. The Todo node will appear in the utility nodes category

## Development

### Plugin Structure

```
example-todo-node/
├── plugin.json      # Plugin manifest
├── index.js         # Main plugin module
├── styles.css       # Custom styles
└── README.md        # This file
```

### Plugin Manifest (plugin.json)

The manifest declares:
- Plugin metadata (id, name, version, etc.)
- Capabilities (what the plugin provides)
- Permissions (what the plugin needs access to)
- Entry points (frontend module and styles)

### Plugin Module (index.js)

The module exports:
- `activate(api)` - Called when the plugin is loaded
- `deactivate()` - Called when the plugin is unloaded

### Using the Plugin API

The `api` object provided to `activate()` includes:
- `api.manifest` - The plugin manifest
- `api.registerNodeTypes(types)` - Register node types
- `api.registerPanels(panels)` - Register panel components
- `api.registerCommands(commands)` - Register commands

## Creating a Real Svelte Component

For a production plugin with a proper Svelte component:

1. Create a separate Svelte project for the plugin
2. Build the component using Vite or Rollup
3. Export the compiled component in index.js
4. The component will receive the same props as built-in nodes

Example component structure:
```svelte
<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  
  let { data, id, selected }: NodeProps = $props();
  
  // Your node logic here
</script>

<div class="todo-node">
  <!-- Your node UI here -->
</div>
```

## License

MIT
