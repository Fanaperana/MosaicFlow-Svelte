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

### Commands

Register actions users can run from the **command palette** (`Ctrl+P` / `Cmd+P`) or with a keyboard shortcut.
They are listed under **Settings → Keyboard shortcuts**, where users can change or remove their keys.
Ids are prefixed with your plugin id automatically.

```javascript
api.registerCommands([
  {
    id: 'insert-today',            // becomes "<plugin id>.insert-today"
    label: 'Insert today\'s date',
    shortcut: 'Ctrl+Shift+D',      // default; string or array of strings
    context: 'canvas',             // 'canvas' (page open, not typing) or 'global'
    handler: () => { /* ... */ },
  },
]);
```

### Settings

Declare options and they appear under your plugin in **Settings → Plugins**; values are saved in `settings.json`.

```javascript
api.settings.register([
  { key: 'showScore', label: 'Show review count', type: 'toggle', default: true },
  { key: 'side', label: 'Start on', type: 'select', default: 'front',
    options: [{ value: 'front', label: 'Question' }, { value: 'back', label: 'Answer' }] },
]);

const show = api.settings.get('showScore');
const stop = api.settings.onChange((key, value) => { /* re-render */ });
```

Types: `toggle`, `text`, `number`, `select`.

### Templates

Ready-made sets of nodes and edges, inserted from the command palette as **Insert template: …**. The template is
placed at the centre of the view, selected, and can be undone in one step. Positions are relative to the template.

```javascript
api.registerTemplates([
  {
    id: 'study-set',
    name: 'Study set',
    description: 'A topic note linked to three flashcards',
    // An object, or a (possibly async) function returning one, e.g. to put today's date in it
    content: {
      nodes: [
        { key: 'topic', type: 'note', x: 0, y: 0, data: { title: 'Topic' } },
        { key: 'box', type: 'group', x: 360, y: -40, width: 340, height: 300, data: { title: 'Cards' } },
        { key: 'c1', type: 'flashcard', parent: 'box', x: 30, y: 50 },   // relative to the group
      ],
      edges: [{ from: 'topic', to: 'c1', label: 'tests', fromSide: 'right', toSide: 'left' }],
    },
  },
]);
```

Node types that aren't installed are skipped with a warning.

### Layouts

Arrange nodes, shown in the command palette as **Arrange: …**. A layout gets the selected nodes (or every top-level
node when fewer than two are selected) and returns new top-left positions; nodes it leaves out stay put. The
change is one undo step. The built-in *Flow right*, *Flow down* and *Grid* layouts use the same API.

```javascript
api.registerLayouts([
  {
    id: 'column',
    name: 'Single column',
    arrange: ({ nodes, edges }) => {
      let y = Math.min(...nodes.map((n) => n.y));
      const x = Math.min(...nodes.map((n) => n.x));
      return Object.fromEntries(nodes.map((n) => { const p = [n.id, { x, y }]; y += n.height + 40; return p; }));
    },
  },
]);
```

### Workspace

Read and change the open page. Reads return copies; every change goes through the app, so it is saved, synced to
the Markdown files and undoable.

```javascript
const nodes = api.workspace.getNodes();      // [{ id, type, x, y, width, height, parentId, selected, data }]
const edges = api.workspace.getEdges();      // [{ id, source, target, label, data }]
const ids = api.workspace.getSelection();
api.workspace.select(ids);

const id = api.workspace.createNode('note', { x: 0, y: 0 }, { title: 'Hello' });
api.workspace.updateNodeData(id, { content: 'World' });
api.workspace.moveNode(id, { x: 200, y: 100 });
api.workspace.createEdge(id, ids[0], 'relates to');
api.workspace.deleteNodes([id]);
api.workspace.isLocked();                    // true on view-only pages
```

### UI and other commands

```javascript
api.ui.notify('Done!', 'success');           // 'info' | 'success' | 'warning' | 'error'
await api.commands.execute('view.fit');      // run any command, built in or from another plugin
```

### Unloading

Everything a plugin registers (node types, commands, templates, layouts, settings) is removed automatically when it
is switched off; use `deactivate()` only for your own timers and listeners.

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

### Shipped with pages

When someone exports pages (**Export pages…** → `.mosaic`) that use your node types, the export dialog lists your
plugin and bundles its folder by default (under `.plugins/<id>/` in the file). Whoever imports the file sees the
plugins it contains (new, update, or already installed) with a warning that plugins run code, and chooses which to
install; selected ones are installed and enabled before the pages are added. Everything in your folder is
included except `.git` and `node_modules`, so keep the folder lean.

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
