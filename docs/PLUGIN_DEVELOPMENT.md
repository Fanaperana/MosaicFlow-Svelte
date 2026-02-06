# Plugin Development Guide

This guide explains how to create and test plugins for MosaicFlow.

## Plugin Directory

MosaicFlow looks for external plugins in the **app config directory**:

| Platform | Location |
|----------|----------|
| **macOS** | `~/Library/Application Support/com.mosaicflow.app/plugins/` |
| **Windows** | `%APPDATA%\com.mosaicflow.app\plugins\` |
| **Linux** | `~/.config/com.mosaicflow.app/plugins/` |

Each plugin should be in its own subfolder with a `plugin.json` manifest.

## Quick Start

### 1. Create Plugin Folder

```bash
# macOS
mkdir -p ~/Library/Application\ Support/com.mosaicflow.app/plugins/my-first-plugin
cd ~/Library/Application\ Support/com.mosaicflow.app/plugins/my-first-plugin
```

### 2. Create plugin.json

```json
{
  "id": "my-plugin.hello-node",
  "name": "Hello Node Plugin",
  "version": "1.0.0",
  "description": "A simple hello world node",
  "author": "Your Name",
  "license": "MIT",
  "apiVersion": "0.1.0",
  "pluginType": "community",
  "core": false,
  "capabilities": [
    {
      "type": "nodeTypes",
      "types": ["helloWorld"]
    }
  ],
  "permissions": [],
  "dependencies": [],
  "frontend": {
    "main": "./index.js",
    "styles": "./styles.css"
  }
}
```

### 3. Create index.js

```javascript
/**
 * Hello World Node Plugin
 */

// Simple Svelte-like component template
const HelloWorldNode = {
  // Component will be rendered as HTML
  render: (props) => `
    <div class="hello-node" style="padding: 16px; background: #1a1a2e; border: 1px solid #4a4a6a; border-radius: 8px;">
      <div class="header" style="font-weight: bold; color: #fff; margin-bottom: 8px;">
        👋 ${props.data?.title || 'Hello World'}
      </div>
      <div class="content" style="color: #aaa;">
        ${props.data?.message || 'Welcome to MosaicFlow!'}
      </div>
    </div>
  `
};

// Node type registration
const helloWorldNode = {
  type: 'helloWorld',
  label: 'Hello World',
  description: 'A simple greeting node',
  category: 'custom',
  iconName: 'Hand',
  component: HelloWorldNode,
  defaultData: {
    title: 'Hello World',
    message: 'Welcome to MosaicFlow!',
  },
  dimensions: { 
    minWidth: 200, 
    minHeight: 100, 
    defaultWidth: 250, 
    defaultHeight: 120 
  },
  colors: { 
    bg: '#1a1a2e', 
    border: '#4a4a6a', 
    icon: '👋' 
  },
};

/**
 * Plugin activation
 */
export function activate(api) {
  console.log(`[${api.manifest.id}] Activating Hello World plugin...`);
  
  api.registerNodeTypes([helloWorldNode]);
  
  console.log(`[${api.manifest.id}] Registered helloWorld node type`);
}

/**
 * Plugin deactivation
 */
export function deactivate() {
  console.log('[my-plugin.hello-node] Deactivating Hello World plugin...');
}
```

### 4. Create styles.css (optional)

```css
/* Custom styles for the hello world node */
.hello-node {
  font-family: system-ui, -apple-system, sans-serif;
}

.hello-node .header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hello-node .content {
  font-size: 14px;
}
```

## Plugin Manifest (plugin.json)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique plugin identifier (e.g., `author.plugin-name`) |
| `name` | string | ✅ | Display name |
| `version` | string | ✅ | Semantic version (e.g., `1.0.0`) |
| `description` | string | | Short description |
| `author` | string | | Author name or organization |
| `license` | string | | License (MIT, Apache-2.0, etc.) |
| `apiVersion` | string | | MosaicFlow API version compatibility |
| `pluginType` | string | | `core` or `community` |
| `core` | boolean | | Set to `false` for external plugins |
| `capabilities` | array | | What the plugin provides |
| `permissions` | array | | Requested permissions |
| `dependencies` | array | | Other plugins this depends on |
| `frontend.main` | string | ✅ | Path to main JavaScript module |
| `frontend.styles` | string | | Path to CSS file |

## Plugin Capabilities

### Node Types

Register new node types for the canvas:

```javascript
api.registerNodeTypes([
  {
    type: 'myNodeType',           // Unique type identifier
    label: 'My Node',             // Display name in palette
    description: 'Description',   // Tooltip text
    category: 'custom',           // content | entity | data | utility | custom
    iconName: 'Box',              // Lucide icon name
    component: MyNodeComponent,   // Svelte component or render function
    defaultData: {                // Default node data
      title: 'New Node',
      customField: '',
    },
    dimensions: {                 // Size constraints
      minWidth: 200,
      minHeight: 100,
      defaultWidth: 280,
      defaultHeight: 150,
    },
    colors: {                     // Colors for export
      bg: '#1a1a2e',
      border: '#4a4a6a',
      icon: '📦',
    },
    quickAccess: true,            // Show in quick toolbar
    shortcut: 'Ctrl+Shift+M',     // Keyboard shortcut
  }
]);
```

### Panels (Coming Soon)

Register sidebar panels:

```javascript
api.registerPanels([
  {
    id: 'my-panel',
    label: 'My Panel',
    icon: 'Settings',
    component: MyPanelComponent,
    position: 'right',
  }
]);
```

### Commands (Coming Soon)

Register command palette commands:

```javascript
api.registerCommands([
  {
    id: 'my-command',
    label: 'Do Something',
    shortcut: 'Ctrl+Shift+D',
    execute: () => {
      console.log('Command executed!');
    },
  }
]);
```

## Node Categories

| Category | Description | Use For |
|----------|-------------|---------|
| `content` | Text, media, embedded content | Notes, images, code, links |
| `entity` | People, organizations, time | Profiles, companies, dates |
| `data` | Structured data and references | URLs, hashes, accounts |
| `utility` | Canvas helpers and tools | Groups, annotations, actions |
| `custom` | Plugin-provided nodes | Your custom nodes |

## Testing Your Plugin

1. **Restart MosaicFlow** after adding/modifying your plugin
2. Check the **Developer Console** (Cmd+Option+I / Ctrl+Shift+I) for plugin logs
3. Your node should appear in the **Node Palette** under the appropriate category
4. If there are errors, they'll be logged to the console

## Debugging

Enable verbose logging by checking the console for messages starting with:
- `[Plugins]` - Plugin system messages
- `[PluginLoader]` - Plugin loading details
- `[NodeRegistry]` - Node type registration
- `[your-plugin-id]` - Your plugin's logs

## Best Practices

1. **Use unique IDs**: Prefix with your username/org (e.g., `myname.my-plugin`)
2. **Handle errors gracefully**: Wrap risky code in try-catch
3. **Clean up on deactivate**: Unsubscribe from events, clear timers
4. **Follow semantic versioning**: Major.Minor.Patch
5. **Document your plugin**: Include a README.md

## Example Plugins

See the [plugins/example-todo-node](../plugins/example-todo-node/) directory for a complete example plugin.

## API Reference

See [PLUGIN_MANIFEST.md](./PLUGIN_MANIFEST.md) for the complete manifest specification.
