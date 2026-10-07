# Plugin Development Guide

This guide explains how to create and test plugins for MosaicFlow.

## Plugin Directory

MosaicFlow looks for user plugins in the **app data directory** (`{APP_DATA}/plugins`):

| Platform | Location |
|----------|----------|
| **macOS** | `~/Library/Application Support/com.mosaicflow.app/plugins/` |
| **Windows** | `%APPDATA%\com.mosaicflow.app\plugins\` |
| **Linux** | `~/.local/share/com.mosaicflow.app/plugins/` |

Each plugin lives in its own subfolder with a `plugin.json` manifest. The easiest way to get there is the
**Plugins** button (puzzle icon at the bottom of the left ribbon) → **Open plugins folder**.

> **Security:** plugins run with the same access as MosaicFlow, including your vault files. New plugins are
> **disabled** until you switch them on in the Plugins dialog. Only enable plugins you trust.

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

`index.js` must be a single **ES module** (bundle it if you use dependencies) that exports `activate(api)`.
Nodes are framework-free: you get a container element and draw into it.

```javascript
export function activate(api) {
  api.registerNodeTypes([
    {
      type: 'helloWorld',
      label: 'Hello World',
      description: 'A simple greeting node',
      keywords: ['greeting'],
      defaultData: { title: 'Hello World', message: 'Welcome to MosaicFlow!' },
      render(container, ctx) {
        const input = document.createElement('input');
        input.className = 'hello-node__input nodrag'; // nodrag: typing/clicking won't drag the node
        input.addEventListener('input', () => ctx.update({ message: input.value }));
        container.appendChild(input);

        const sync = (next) => {
          ctx = next;
          if (document.activeElement !== input) input.value = next.data.message ?? '';
        };
        sync(ctx);
        return { update: sync, destroy: () => input.remove() };
      },
    },
  ]);
}

export function deactivate() {}
```

`render(container, ctx)` is called once when the node mounts; `update(ctx)` is called whenever its data or
selection changes. `ctx` contains:

| Field | Description |
|-------|-------------|
| `id`, `type` | Node id and type |
| `data` | A copy of the node's data |
| `selected` | Whether the node is selected |
| `update(patch)` | Merge `patch` into the node's data (saved to the vault, undoable) |
| `renderMarkdown(text)` | Sanitized markdown → HTML, with `[[wikilinks]]` and `#tags` |
| `openWikilink(ref)` | Navigate to a node or page, like clicking `[[ref]]` |

The node gets the standard frame (resize handles, connection handles, colors, header) automatically.

### 4. Create styles.css (optional)

```css
/* Plugin CSS is global: prefix every class with your plugin name */
.hello-node__input {
  width: 100%;
  font-family: inherit;
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

Register new node types for the canvas. Only `type` and `render` are required; everything else has a default.

```javascript
api.registerNodeTypes([
  {
    type: 'myNodeType',           // Unique type identifier (cannot override another plugin's type)
    label: 'My Node',             // Name in the insert menu (default: type)
    description: 'Description',   // Second line in the insert menu
    keywords: ['alias'],          // Extra search terms for the insert menu
    category: 'custom',           // content | entity | data | utility | custom (default, shown as "Plugins")
    iconName: 'Puzzle',           // Built-in icon name; otherwise colors.icon (emoji) is shown
    render: (container, ctx) => ({ update() {}, destroy() {} }),
    defaultData: { title: 'New Node' },
    dimensions: { minWidth: 120, minHeight: 80, defaultWidth: 260, defaultHeight: 180 },
    colors: { bg: '#1a1a2e', border: '#4a4a6a', icon: '🧩' },
    knowledge: {                  // Optional: how the data is stored, searched and described to AI agents
      purpose: 'What this node is for',
      bodyField: 'content',
      fields: { content: { type: 'markdown', description: 'Body text' } },
    },
    quickAccess: false,           // Show in the floating toolbar
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

1. Open **Plugins** (puzzle icon in the left ribbon), click **Rescan**, and switch your plugin on
2. After editing your files, click **Rescan** again to reload it (no restart needed)
3. Press `/` on a canvas (or double-click empty space) and search for your node
4. Load errors are shown under the plugin in the Plugins dialog and in the **Developer Console** (Ctrl+Shift+I)

## Sharing Your Plugin

A plugin is just its folder, so sharing is simple:

1. Publish the folder (with `plugin.json`, the bundled `index.js`, optional `styles.css` and a README) as a GitHub repository or release zip
2. Users download it, drop the folder into their plugins folder, rescan and enable it

Use a globally unique `id` such as `yourname.plugin-name` and bump `version` on each release; a marketplace can
build on these manifests later.

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

See [plugins/example-flashcard](../plugins/example-flashcard/) for a complete example plugin.

## API Reference

See [PLUGIN_MANIFEST.md](./PLUGIN_MANIFEST.md) for the complete manifest specification.
