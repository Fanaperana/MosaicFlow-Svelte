# Plugin API reference

Everything a MosaicFlow plugin can call. For a step-by-step introduction, read the
[plugin guide](PLUGIN_DEVELOPMENT.md) first. Types for editor autocomplete are in
[`plugins/plugin-template/mosaicflow.d.ts`](../plugins/plugin-template/mosaicflow.d.ts).

- [Plugin API reference](#plugin-api-reference)
  - [Module shape](#module-shape)
  - [api.registerNodeTypes](#apiregisternodetypes)
    - [knowledge](#knowledge)
    - [Node rendering](#node-rendering)
  - [api.registerPanels](#apiregisterpanels)
  - [api.registerCommands](#apiregistercommands)
  - [api.registerTemplates](#apiregistertemplates)
  - [api.registerLayouts](#apiregisterlayouts)
  - [api.registerThemes](#apiregisterthemes)
  - [api.appearance](#apiappearance)
  - [api.workspace](#apiworkspace)
  - [api.settings](#apisettings)
  - [api.ui](#apiui)
  - [api.commands](#apicommands)
  - [api.manifest](#apimanifest)
  - [Built-in command ids](#built-in-command-ids)
  - [Built-in node types](#built-in-node-types)
  - [Icon names](#icon-names)
  - [CSS variables and helper classes](#css-variables-and-helper-classes)
  - [Ids and naming](#ids-and-naming)
  - [Lifecycle](#lifecycle)
  - [Environment and limits](#environment-and-limits)

---

## Module shape

The file named by `frontend.main` in `plugin.json` must be a single ES module that exports `activate`:

```js
/** @param {import('./mosaicflow').PluginAPI} api */
export function activate(api) { /* register things */ }   // may be async

export function deactivate() { /* optional cleanup */ }    // may be async
```

If `activate` throws, the plugin is marked as failed, the error is shown in **Settings → Plugins**, and
everything it registered before the error is removed.

---

## api.registerNodeTypes

```ts
registerNodeTypes(types: NodeType[]): void
```

Adds blocks to the insert menu (`/`). Nodes are stored in the vault as Markdown files, like built-in ones.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `string` | **required** | Unique type id. Saved in every node file; never rename it after release. Can't reuse a type of another plugin or the app. |
| `render` | `(container, ctx) => NodeHandle \| void` | **required** | Draws the node body. See [Node rendering](#node-rendering). |
| `label` | `string` | `type` | Name in the insert menu and properties panel |
| `description` | `string` | `''` | Second line in the insert menu |
| `keywords` | `string[]` | | Extra search terms for the insert menu |
| `category` | `'content' \| 'entity' \| 'data' \| 'utility' \| 'custom'` | `'custom'` | Insert-menu group; `custom` is shown as **Plugins** |
| `iconName` | `string` | `'Puzzle'` | One of the [icon names](#icon-names) |
| `defaultData` | `object` | `{ title: label }` | Data of new nodes. `title` defaults to the label. |
| `dimensions` | `{ minWidth, minHeight, defaultWidth, defaultHeight }` | `120, 80, 260, 180` | Size limits and initial size in px |
| `colors` | `{ bg, border, icon }` | `#1a1a2e, #4a4a6a, 🧩` | Used for SVG export; `icon` is an emoji |
| `knowledge` | see below | | How data is stored, searched and described to AI agents |
| `capabilities` | `{ container?, connectable? }` | | `container: true`: other nodes can be placed inside. `connectable: false`: no connection handles. |
| `quickAccess` | `boolean` | `false` | Also show in the floating toolbar |

### knowledge

```js
knowledge: {
  purpose: 'When to use this node',             // shown to AI agents choosing a node type
  bodyField: 'answer',                         // data key written as the Markdown body of the node file
  fields: {
    question: { type: 'string', description: 'Front of the card' },
    answer:   { type: 'markdown', description: 'Back of the card' },
    level:    { type: 'enum', values: ['easy', 'hard'], description: 'Difficulty' },
  },
}
```

Field types: `string`, `markdown`, `number`, `boolean`, `date`, `url`, `enum`, `string[]`, `object`, `object[]`.
Declared fields are shown and editable in the properties panel, included in vault search, and listed in
`.mosaicflow/node-types.json` so AI agents and the MCP server can create your nodes correctly. Without
`bodyField`, the body is the `notes` field.

### Node rendering

`render(container, ctx)` is called once when the node appears. Return `{ update, destroy }`:

- `update(ctx)`: called when the node's data or selection changes (including undo and external file edits).
- `destroy()`: called when the node disappears (deleted, page closed, plugin disabled, or scrolled off-screen on
  very large pages, where off-screen nodes aren't drawn).

`ctx` (`NodeContext`):

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Node id |
| `type` | `string` | Node type |
| `data` | `object` | A **copy** of the node's data |
| `selected` | `boolean` | Whether the node is selected |
| `update(patch)` | `(patch: object) => void` | Merge `patch` into the data: saved to disk, undoable, triggers `update(ctx)` |
| `renderMarkdown(text)` | `(text: string) => string` | Sanitized HTML with `[[wikilinks]]` and `#tags`; safe for `innerHTML` |
| `openWikilink(ref)` | `(ref: string) => void` | Navigate like clicking `[[ref]]` |

The app draws the frame (header with title, resize and connection handles, colours, border). Your container fills
the body. Add `nodrag` to elements users click, type into or select text in, and `nowheel` to elements that scroll,
otherwise the canvas drags or zooms instead.

Errors thrown from `render`/`update` are shown inside the node. If the plugin is disabled or missing, the node
shows a notice and its data is kept.

---

## api.registerPanels

```ts
registerPanels(panels: Panel[]): void
```

Sidebar views on the right of the canvas. Each panel gets a ribbon button and a **Toggle panel: …** entry in the
command palette. One plugin panel is open at a time; users can resize it (the width is remembered per panel).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | **required** | Prefixed with your plugin id |
| `label` | `string` | **required** | Ribbon tooltip and panel header |
| `render` | `(container, ctx) => PanelHandle \| void` | **required** | Draws the panel |
| `description` | `string` | | Shown in the command palette |
| `iconName` | `string` | `'Puzzle'` | Ribbon icon, one of the [icon names](#icon-names) |
| `defaultWidth` | `number` | `300` | Initial width (220–640) |
| `priority` | `number` | `0` | Ribbon order, higher first |

`update(ctx)` runs when the user switches page and shortly after nodes or edges change (batched while dragging).
Read the page with [`api.workspace`](#apiworkspace).

`ctx` (`PanelContext`):

| Field | Type | Description |
|-------|------|-------------|
| `page` | `{ id, name } \| null` | The open page |
| `renderMarkdown(text)` | `(text: string) => string` | Sanitized HTML |
| `openWikilink(ref)` | `(ref: string) => void` | Navigate like clicking `[[ref]]` |
| `close()` | `() => void` | Close this panel |

---

## api.registerCommands

```ts
registerCommands(commands: Command[]): void
```

Actions in the command palette (`Ctrl+P`), optionally with a keyboard shortcut. Shortcuts are listed in
**Settings → Keyboard shortcuts**, where users can change or remove them.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | **required** | Prefixed with your plugin id: `count` becomes `my-name.my-plugin.count` |
| `label` | `string` | **required** | Palette text. Starting with your plugin name helps users find it. |
| `handler` | `(args?) => void \| Promise<void>` | **required** | Runs the command. Errors are shown as a notification when run from the palette, and logged to the console. |
| `category` | `string` | plugin name | Shown next to the label in the palette |
| `description` | `string` | | |
| `shortcut` | `string \| string[]` | | Default keys, e.g. `'Ctrl+Shift+D'`. `Ctrl` is `Cmd` on macOS. |
| `context` | `'canvas' \| 'global'` | `'canvas'` | `canvas`: shortcut works on an open page when not typing. `global`: everywhere, including text fields (when it uses `Ctrl`/`Alt`). |
| `enabled` | `boolean \| () => boolean` | `true` | When false, hidden from the palette and the shortcut is ignored |

Shortcut syntax: modifiers `Ctrl`, `Alt`, `Shift`, `Meta` joined with `+`, then a key (`A`–`Z`, `0`–`9`,
`F1`–`F12`, `Enter`, `Delete`, `ArrowLeft`, `=`, `/`, …). Avoid keys the app already uses (see
[built-in command ids](#built-in-command-ids)).

---

## api.registerTemplates

```ts
registerTemplates(templates: Template[]): void
```

Ready-made groups of nodes and edges, inserted from the palette as **Insert template: …**. The template is placed
at the centre of the view, its nodes are selected, and the whole insert is one undo step.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Prefixed with your plugin id |
| `name` | `string` | Palette text after "Insert template:" |
| `description` | `string` | Shown in the palette |
| `content` | `TemplateContent \| () => TemplateContent \| Promise<TemplateContent>` | Use a function for content that changes (dates, settings, data you fetch) |

```js
content: {
  nodes: [
    // key: local name used by edges and `parent`. x/y: relative to the template (or the parent group).
    { key: 'g', type: 'group', x: 0, y: 0, width: 600, height: 320, data: { title: 'Week' } },
    { key: 'a', type: 'note', parent: 'g', x: 20, y: 50, data: { title: 'Plan', content: '- [ ] …' } },
    { key: 'b', type: 'checklist', parent: 'g', x: 310, y: 50 },
  ],
  edges: [{ from: 'a', to: 'b', label: 'then', fromSide: 'right', toSide: 'left' }],
}
```

Nodes whose type isn't installed are skipped with a warning. `fromSide`/`toSide` (`top`, `right`, `bottom`,
`left`) choose the connection handles; without them the default handles are used. Nothing is inserted on
view-only pages.

---

## api.registerLayouts

```ts
registerLayouts(layouts: Layout[]): void
```

Arrange nodes, from the palette as **Arrange: …**. The layout receives the selected nodes when two or more nodes
with the same parent are selected; otherwise every top-level node of the page. The change is one undo step and the
view is fitted afterwards.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Prefixed with your plugin id |
| `name` | `string` | Palette text after "Arrange:" |
| `description` | `string` | Shown in the palette |
| `arrange` | `(input) => positions \| Promise<positions>` | Returns new top-left positions |

```ts
input = {
  nodes: { id, type, x, y, width, height }[],   // x/y: current top-left
  edges: { source, target }[],                   // only edges between these nodes
}
positions = { [nodeId]: { x, y } }  // or a Map; nodes you leave out stay where they are
```

Built-in layouts: **Flow left to right**, **Flow top to bottom** (follow the connections) and **Grid**.

---

## api.registerThemes

```ts
registerThemes(themes: Theme[]): void
```

Colour themes, listed in **Settings → Appearance → Theme** with "(plugin)" after the name. Registering a theme
doesn't switch to it; the user picks it (or you call `api.appearance.set({ theme })`, e.g. from a command). If
your plugin is switched off while its theme is active, the default theme is shown and the choice is remembered
for when the plugin comes back.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Prefixed with your plugin id: `forest` becomes `my-name.my-plugin.forest` |
| `name` | `string` | Name in the theme picker |
| `description` | `string` | |
| `variables` | `Record<string, string>` | CSS custom properties set on `:root`; keys must start with `--` (others are ignored) |
| `css` | `string` | Extra CSS injected while the theme is active |

```js
api.registerThemes([{
  id: 'forest',
  name: 'Forest',
  variables: {
    '--mf-bg': '#0f1a14', '--mf-surface': '#13221a', '--mf-surface-2': '#1a2c22',
    '--mf-text': '#e7f2ea', '--mf-text-2': '#a3bfae', '--mf-text-3': '#6c8a78',
    '--mf-border': 'rgba(160, 255, 200, 0.08)', '--mf-canvas-pattern': '#2c4a38',
  },
  css: '.ribbon { box-shadow: inset -2px 0 0 #2f8f5b; }',
}]);
```

Themes set colours; the user's accent colour, fonts and sizes still apply on top. Every variable you can set is
listed under [CSS variables](#css-variables-and-helper-classes). Blocks keep their own colours (users set them
per block), so design themes for dark backgrounds.

---

## api.appearance

Reads and changes **Settings → Appearance**. Changes are saved for the user, exactly like changing them by hand,
and show up in the Settings window. Invalid values (unknown options, bad colours, out-of-range numbers) are
ignored or clamped.

| Method | Description |
|--------|-------------|
| `get()` | A copy of the current settings (see the table below) |
| `set(patch)` | Change one or more settings |
| `reset()` | Restore every Appearance default |
| `onChange((appearance) => {})` | Called after every change, by the user or a plugin. Returns an unsubscribe function. |
| `themes()` | Installed themes: `{ id, name, description, pluginId }[]` |

| Setting | Type | Default | Range / values |
|---------|------|---------|----------------|
| `theme` | `string` | `'core.default'` | A theme id: `core.default`, `core.midnight`, `core.graphite`, `core.nord`, `core.solarized`, `core.contrast`, or a plugin theme |
| `accent` | `string` | `'#5b8def'` | `#rrggbb` |
| `uiScale` | `number` | `1` | 0.75–1.5: zoom of the whole window |
| `textScale` | `number` | `1` | 0.85–1.35: text in menus, panels and dialogs |
| `uiFont` | `string` | `'space-grotesk'` | `space-grotesk`, `system`, `serif`, `mono`, `custom` |
| `customUiFont` | `string` | `''` | Installed font name used when `uiFont` is `custom` |
| `monoFont` | `string` | `'pt-mono'` | `pt-mono`, `space-mono`, `system`, `custom` |
| `customMonoFont` | `string` | `''` | Installed font name used when `monoFont` is `custom` |
| `iconScale` | `number` | `1` | 0.75–1.5 |
| `iconColor` | `string` | `'default'` | `default` (follow the text), `accent`, `custom` |
| `customIconColor` | `string` | `'#a6a6ad'` | `#rrggbb`, used when `iconColor` is `custom` |
| `iconWeight` | `string` | `'regular'` | `thin`, `regular`, `bold` |
| `radius` | `number` | `6` | 0–14 px |
| `density` | `string` | `'default'` | `compact`, `default`, `comfortable` |
| `reduceMotion` | `boolean` | `false` | |
| `customCss` | `string` | `''` | The user's own CSS; avoid overwriting it, use `api.ui.addStyles` instead |

```js
// A command that toggles a presentation look
api.registerCommands([{
  id: 'present',
  label: 'My Plugin: presentation mode',
  handler: () => {
    const a = api.appearance.get();
    api.appearance.set(a.uiScale > 1 ? { uiScale: 1, textScale: 1 } : { uiScale: 1.25, textScale: 1.1 });
  },
}]);
```

Changing the user's appearance is noticeable and persistent: do it in response to an action (a command, a
button), not on `activate`.

---

## api.workspace

Reads and changes the **open page**. Reads return plain copies, so changing them does nothing; use the methods.
Every change is saved to the vault files and can be undone. On view-only pages (`isLocked()`), changes are
ignored. With no page open, `getNodes()`/`getEdges()` return `[]`.

| Method | Returns | Description |
|--------|---------|-------------|
| `getNodes()` | `NodeView[]` | All nodes: `{ id, type, x, y, width?, height?, parentId?, selected, data }`. Children's `x`/`y` are relative to their group. |
| `getEdges()` | `EdgeView[]` | All edges: `{ id, source, target, label?, data }` |
| `getSelection()` | `string[]` | Selected node ids |
| `select(ids)` | | Replace the selection |
| `createNode(type, {x, y}, data?)` | `string` | New node id. Throws for unknown types. |
| `updateNodeData(id, patch)` | | Merge `patch` into a node's data |
| `moveNode(id, {x, y})` | | Set a node's position |
| `deleteNodes(ids)` | | Delete nodes and their edges |
| `createEdge(source, target, label?)` | `string` | New edge id |
| `isLocked()` | `boolean` | True on view-only pages |

Common data fields of all nodes: `title`, `tags` (`string[]`), `notes`, and styling (`color`, `borderColor`,
`borderWidth`, `borderStyle`, `borderRadius`, `textColor`, `showHeader`, `locked`), plus the type's own fields
(see [built-in node types](#built-in-node-types)).

---

## api.settings

Settings appear under your plugin in **Settings → Plugins** and are saved in `settings.json` (per user, not
per vault).

| Method | Description |
|--------|-------------|
| `register(defs)` | Declare settings; call once in `activate` |
| `get(key)` | Current value, or the declared default |
| `set(key, value)` | Change a value (saved, and listeners are called) |
| `onChange((key, value) => {})` | Listen for changes; returns an unsubscribe function |

```js
api.settings.register([
  { key: 'greeting', label: 'Greeting', description: 'Shown on new cards', type: 'text', default: 'Hello' },
  { key: 'size', label: 'Cards per row', type: 'number', default: 4 },
  { key: 'compact', label: 'Compact cards', type: 'toggle', default: false },
  { key: 'side', label: 'Start on', type: 'select', default: 'front',
    options: [{ value: 'front', label: 'Question' }, { value: 'back', label: 'Answer' }] },
]);
```

Types: `toggle` (boolean), `text` (string), `number`, `select` (one of `options[].value`).

---

## api.ui

| Method | Description |
|--------|-------------|
| `notify(message, kind?)` | Show a notification with your plugin name. `kind`: `'info'` (default), `'success'`, `'warning'`, `'error'`. |
| `addStyles(css)` | Inject CSS while the plugin is on. Returns a function that removes it; everything is removed when the plugin is switched off. Use it for styles that depend on settings or data; static styles belong in `frontend.styles`. |

---

## api.commands

| Method | Description |
|--------|-------------|
| `execute(id, args?)` | Run any command, built in or from a plugin (`'<plugin id>.<command id>'`). Returns a promise. Unknown or disabled commands do nothing. |

---

## api.manifest

Your parsed `plugin.json` (`id`, `name`, `version`, …). Useful for log prefixes: `` console.log(`[${api.manifest.id}]`, …) ``.

---

## Built-in command ids

Use with `api.commands.execute`. Default shortcuts are shown for reference; avoid reusing them.

| Id | Action | Default |
|----|--------|---------|
| `app.commandPalette` | Command palette | `Ctrl+P` |
| `app.search` | Search pages and nodes | `Ctrl+K`, `Ctrl+O` |
| `app.settings` | Open settings | `Ctrl+,` |
| `app.shortcuts` | Keyboard shortcuts | `Ctrl+/` |
| `app.plugins` | Manage plugins | |
| `vault.switch` | Switch vault | `Ctrl+Shift+O` |
| `page.new` | New page | `Ctrl+N` |
| `page.back` / `page.forward` | Page history | `Alt+←` / `Alt+→` |
| `page.allPages` | Show all pages | |
| `page.toggleLock` | Lock / unlock page | `Ctrl+Shift+K` |
| `page.export` | Export as .mosaic | `Ctrl+Shift+E` |
| `view.togglePages` | Pages sidebar | `Ctrl+\` |
| `view.toggleProperties` | Properties panel | `Ctrl+Shift+\` |
| `view.toggleNodeList` | Node list / story | `Ctrl+Shift+L` |
| `view.graph` | Graph view | `Ctrl+Alt+G` |
| `view.fit` | Fit view | `Shift+1` |
| `view.zoomIn` / `view.zoomOut` | Zoom | `Ctrl+=` / `Ctrl+-` |
| `canvas.insert` | Insert block menu | `/` |
| `canvas.selectMode` / `canvas.panMode` | Select / hand tool | `V` / `H` |
| `edit.undo` / `edit.redo` | Undo / redo | `Ctrl+Z` / `Ctrl+Y`, `Ctrl+Shift+Z` |
| `edit.selectAll` | Select all nodes | `Ctrl+A` |
| `edit.duplicate` | Duplicate selection | `Ctrl+D` |
| `edit.delete` | Delete selection | `Delete`, `Backspace` |
| `edit.group` / `edit.ungroup` | Group / ungroup | `Ctrl+G` / `Ctrl+Shift+G` |

## Built-in node types

Use these `type` values in templates and `workspace.createNode`. The main text field is in brackets.

| Type | Block | | Type | Block |
|------|-------|-|------|-------|
| `note` | Note (`content`, Markdown) | | `group` | Group (container, `description`) |
| `simpleText` | Simple text (`content`) | | `annotation` | Annotation (`label`) |
| `checklist` | Checklist (`items`) | | `callout` | Callout (`content`, `tone`, `icon`) |
| `page` | Page link (`page`) | | `embed` | Embed |
| `image` | Image (`caption`) | | `link` | Link (`url`, `description`) |
| `code` | Code (`code`) | | `iframe` | Iframe (`url`) |
| `person` | Person | | `organization` | Organization |
| `timestamp` | Timestamp | | `domain` | Domain |
| `hash` | Hash | | `credential` | Credential |
| `socialPost` | Social post | | `router` | Router |
| `snapshot` | Snapshot | | `map` | Map |
| `linkList` | Link list | | `action` | Action |
| `calendar` | Calendar | | `timer` | Timer |

The authoritative list with every field is generated into each vault as `.mosaicflow/node-types.json`.

## Icon names

`iconName` accepts: `StickyNote`, `Type`, `Image`, `Link`, `Link2`, `Code`, `LayoutGrid`, `User`, `Building2`,
`Clock`, `Globe`, `FileDigit`, `KeyRound`, `MessageSquare`, `MessageCircle`, `Router`, `Camera`, `FolderOpen`,
`MapPin`, `List`, `ListChecks`, `CheckSquare`, `Box`, `AppWindow`, `Lightbulb`, `CalendarDays`, `Timer`,
`FileText`, `Puzzle`. Unknown names show a box.

## CSS variables and helper classes

Plugin stylesheets are global: prefix every class with your plugin name. Every variable below follows the user's
theme and Appearance settings, and themes, custom CSS or `api.ui.addStyles` can override any of them on `:root`.

| Variable | Use |
|----------|-----|
| `--mf-text`, `--mf-text-2`, `--mf-text-3` | Text, secondary, muted |
| `--mf-bg`, `--mf-surface`, `--mf-surface-2` | App background, panel background, raised panel |
| `--mf-canvas`, `--mf-canvas-pattern` | Canvas background (defaults to `--mf-bg`) and its dots/lines |
| `--mf-border`, `--mf-border-strong` | Borders |
| `--mf-hover`, `--mf-active` | Hover and pressed backgrounds |
| `--mf-accent`, `--mf-accent-soft` | User's accent colour and its translucent version |
| `--mf-danger`, `--mf-danger-soft` | Errors |
| `--mf-radius` | Corner radius (Appearance → Corner radius) |
| `--mf-row` | Row height of menus and lists (Appearance → Density) |
| `--mf-font-ui`, `--mf-font-mono` | Fonts |
| `--mf-text-scale` | Text size factor; every `font-size: Npx` in the app and in plugin CSS is multiplied by it (1 inside canvas blocks) |
| `--mf-icon-scale` | Icon size factor for `svg.lucide` icons (1 inside canvas blocks) |
| `--mf-icon-color` | Set when the user picks an icon colour |

The root element also has `data-theme="<theme id>"` and the classes `reduce-motion`, `mf-icon-colored` and
`mf-icon-weighted` when those options are on, for theme-specific CSS.

Helper classes: `nodrag` (clicks/drags don't move the node), `nowheel` (wheel scrolls the element instead of
zooming), `markdown-content` (app styling for `renderMarkdown` output).

## Ids and naming

- **Plugin id** (`plugin.json` → `id`): letters, numbers, `.`, `-`, `_`, up to 128 characters; must not start
  with `core.`. Use `yourname.plugin-name`.
- **Command, panel, template and layout ids** are prefixed with your plugin id automatically.
- **Node types** are not prefixed, because they are written into vault files. Pick a distinctive name
  (`myplugin-card`, not `card`). A type that another plugin or the app already provides fails to register.

## Lifecycle

1. On startup, and on **Rescan**, the app reads every `plugins/*/plugin.json`.
2. New plugins are **off**. When the user enables one, the app loads `styles` (if any), then imports `main` and
   calls `activate(api)`.
3. Disabling, removing or rescanning calls `deactivate()` (if exported), then removes everything the plugin
   registered and its stylesheet. Open panels close, and nodes of its types show a "plugin missing" notice.

## Environment and limits

- **One file.** The module is loaded from memory, so relative `import`s of other files don't work. Bundle
  dependencies into `index.js` (see the guide). Imports from URLs are blocked in release builds.
- **Network.** `fetch` to `https:` URLs works. Images may load from `http:`/`https:`.
- **No Node.js or Tauri APIs.** Plugins run in the app's web view with standard browser APIs.
- **Full access, no sandbox.** Plugins run with the same access as the app; users are warned before enabling or
  installing one. Never put node data or other user content into `innerHTML` without `renderMarkdown`.
- **Storage.** Persist per-node data with `ctx.update`/`workspace.updateNodeData` (saved in the vault) and
  per-user preferences with `api.settings`.
