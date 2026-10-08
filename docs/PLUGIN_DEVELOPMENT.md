# Building MosaicFlow plugins

Plugins add things to MosaicFlow without rebuilding the app: new blocks, sidebar panels, commands, templates,
layouts and settings. A plugin is a folder with a manifest and one JavaScript file. There is no build step,
framework or SDK to install.

- [What you can build](#what-you-can-build)
- [Start in two minutes](#start-in-two-minutes)
- [How a plugin is put together](#how-a-plugin-is-put-together)
- [Tutorial: a word-count plugin](#tutorial-a-word-count-plugin)
- [Each building block](#each-building-block)
- [Recipes](#recipes)
- [Using npm packages](#using-npm-packages)
- [Debugging](#debugging)
- [Publishing](#publishing)
- [Checklist before you share](#checklist-before-you-share)

Full API: **[PLUGIN_API.md](PLUGIN_API.md)** · Manifest: **[PLUGIN_MANIFEST.md](PLUGIN_MANIFEST.md)** ·
Starter: **[plugins/plugin-template](../plugins/plugin-template/)** · Example: **[plugins/example-flashcard](../plugins/example-flashcard/)**

---

## What you can build

A plugin can combine any of these:

| Building block | Where users see it | What it controls | Typical uses |
|----------------|--------------------|------------------|--------------|
| **Node type** | `/` insert menu, canvas | A new kind of block: how it looks and behaves, what data it stores (saved as Markdown in the vault), which fields the properties panel, search and AI agents see | Flashcards, kanban cards, habit trackers, charts, embeds of a web service, quizzes, counters, rating cards |
| **Panel** | Ribbon button → right sidebar | A full-height view next to the canvas, refreshed as the page changes | Outline, statistics, review/study mode, TODO roll-up, a reading list, a timeline of the page |
| **Command** | Command palette (`Ctrl+P`), keyboard shortcut | Any action, run on demand | Clean up a page, insert today's date, export to another format, bulk-tag the selection |
| **Template** | Palette → "Insert template: …" | A ready-made set of nodes, groups and edges, placed in one undo step | Meeting notes, weekly plan, research board, study set, project kick-off |
| **Layout** | Palette → "Arrange: …" | Positions of the selected (or all) nodes, in one undo step | Columns, circles, timelines, kanban lanes, mind-map trees |
| **Theme** | Settings → Appearance → Theme | Colours of the whole interface and canvas (CSS variables), plus optional CSS | Dark variants, brand colours, high contrast, seasonal themes |
| **Appearance** | Settings → Appearance | Every appearance option: theme, accent, scale, text and icon size, icon colour and weight, fonts, corner radius, density, motion | Presentation mode, per-task looks, theme switchers |
| **Styles** | Anywhere | CSS you inject at runtime (and your `styles.css`) | Restyle parts of the app, highlight things, custom looks for your blocks |
| **Settings** | Settings → Plugins | Options for your plugin, saved per user | Defaults, API keys for a service, display preferences |

Through the [`workspace` API](PLUGIN_API.md#apiworkspace) every one of these can read the open page and create,
change, move, connect, select or delete nodes. Changes are saved and undoable, like edits made by hand.

Plugins **can't** (yet): change the app's own menus or built-in blocks, read other pages than the open one, or
access the file system directly.

## Start in two minutes

**Option A: scaffold it (from a clone of this repo)**

```bash
pnpm create-plugin "Word Count" --author "Your Name"
```

This copies [the starter](../plugins/plugin-template/) into your MosaicFlow plugins folder with the name, id and
CSS prefix filled in. Options: `--id you.word-count`, `--out <folder>`.

**Option B: copy it by hand**

1. Download [`plugins/plugin-template`](../plugins/plugin-template/).
2. In MosaicFlow, open **Plugins** (puzzle icon at the bottom of the left ribbon) → **Open plugins folder**, and
   put the folder there:

   | Platform | Plugins folder |
   |----------|----------------|
   | Windows | `%APPDATA%\com.mosaicflow.app\plugins` |
   | macOS | `~/Library/Application Support/com.mosaicflow.app/plugins` |
   | Linux | `~/.local/share/com.mosaicflow.app/plugins` |

3. In `plugin.json`, change `id` (e.g. `yourname.word-count`) and `name`.

**Then, either way:**

1. In MosaicFlow: **Plugins → Rescan**, switch your plugin on.
2. On a page, press `/` and insert the starter card; press `Ctrl+P` and type your plugin name to see its
   command, template and layout; click its button in the left ribbon to open its panel.
3. Edit `index.js`, then **Rescan** to reload. Delete the parts you don't need.

> New plugins are **off** until switched on, because plugins run with the same access as the app.

## How a plugin is put together

```
word-count/
├── plugin.json        # who you are and which file to load
├── index.js           # your code: export function activate(api)
├── styles.css         # optional, global: prefix every class
├── mosaicflow.d.ts    # optional, autocomplete in your editor (not loaded by the app)
└── README.md
```

`plugin.json`:

```json
{
  "id": "yourname.word-count",
  "name": "Word Count",
  "version": "0.1.0",
  "description": "Counts the words on a page",
  "author": "Your Name",
  "capabilities": [{ "type": "nodeTypes", "types": [] }],
  "frontend": { "main": "./index.js", "styles": "./styles.css" }
}
```

`index.js`:

```js
/** @param {import('./mosaicflow').PluginAPI} api */
export function activate(api) {
  // register node types, panels, commands, templates, layouts, settings
}
```

`activate(api)` runs when the plugin is switched on. Everything you register is removed automatically when it is
switched off, so most plugins don't need `deactivate()`.

The `/** @param … */` comment gives you autocomplete and inline docs for the whole API in VS Code and other
editors, as long as `mosaicflow.d.ts` sits next to `index.js`.

## Tutorial: a word-count plugin

We'll build a command, a panel and a node that count words on the page.

### 1. A command

```js
/** @param {import('./mosaicflow').PluginAPI} api */
export function activate(api) {
  const words = (text) => (String(text ?? '').match(/\S+/g) ?? []).length;
  const countPage = () =>
    api.workspace.getNodes().reduce((sum, n) => sum + words(n.data.title) + words(n.data.content), 0);

  api.registerCommands([
    {
      id: 'count',
      label: 'Word Count: count words on this page',
      shortcut: 'Ctrl+Alt+W',
      handler: () => api.ui.notify(`${countPage()} words`, 'info'),
    },
  ]);
}
```

Rescan, open a page, press `Ctrl+Alt+W` (or `Ctrl+P` → "word count"). The shortcut is listed under
**Settings → Keyboard shortcuts**, where users can change it.

### 2. A panel that stays up to date

Add inside `activate`:

```js
  api.registerPanels([
    {
      id: 'stats',
      label: 'Word count',
      iconName: 'FileText',
      render(container, ctx) {
        const total = document.createElement('p');
        container.appendChild(total);
        const draw = () => (total.textContent = `${countPage()} words on this page`);
        draw();
        return { update: draw };   // called when the page or its nodes change
      },
    },
  ]);
```

A **Word count** button appears in the left ribbon. Type in a note and watch the panel update.

### 3. A node

```js
  api.registerNodeTypes([
    {
      type: 'wordcount-goal',
      label: 'Word goal',
      iconName: 'FileText',
      defaultData: { title: 'Word goal', goal: 1000 },
      knowledge: {
        purpose: 'Shows progress toward a word-count goal for the page.',
        fields: { goal: { type: 'number', description: 'Target number of words' } },
      },
      render(container, ctx) {
        const bar = document.createElement('progress');
        const label = document.createElement('p');
        container.append(label, bar);
        let current = ctx;
        const sync = (next = current) => {
          current = next;
          const count = countPage();
          bar.max = next.data.goal;
          bar.value = count;
          label.textContent = `${count} / ${next.data.goal} words`;
        };
        sync(ctx);
        // update() only runs when this node changes, so poll for edits elsewhere on the page.
        const timer = setInterval(() => sync(), 2000);
        return { update: sync, destroy: () => clearInterval(timer) };
      },
    },
  ]);
```

Rescan, press `/`, type "word goal". Because `goal` is declared in `knowledge.fields`, it can be edited in the
properties panel and AI agents know what it means. `update(ctx)` runs when the node's own data changes; the
interval picks up edits to other nodes and is stopped in `destroy()`. Add `"wordcount-goal"` to
`capabilities[0].types` in `plugin.json` so exported pages know this plugin provides it.

That's a complete plugin. The [starter](../plugins/plugin-template/index.js) and the
[flashcard example](../plugins/example-flashcard/index.js) show the same patterns with text input and styling.

## Each building block

Short version; every option is in [PLUGIN_API.md](PLUGIN_API.md).

### Node types

```js
api.registerNodeTypes([{
  type: 'myplugin-card',          // unique, saved in vault files: never rename after release
  label: 'Card',                  // insert-menu name
  iconName: 'Lightbulb',          // see the icon list in PLUGIN_API.md
  defaultData: { title: 'Card', text: '' },
  dimensions: { defaultWidth: 260, defaultHeight: 180 },
  knowledge: { purpose: '…', bodyField: 'text', fields: { text: { type: 'markdown', description: '…' } } },
  render(container, ctx) {
    // build DOM once; read ctx.data; save with ctx.update({ … })
    return { update(next) { /* sync DOM */ }, destroy() { /* cleanup */ } };
  },
}]);
```

Rules of thumb:

- **Draw once, then sync.** Build elements in `render`, change them in `update`. Don't rebuild on each update,
  or inputs lose focus.
- **Don't overwrite what the user is typing:** `if (document.activeElement !== input) input.value = data.text`.
- **Mark interactive elements** with `class="nodrag"` (and `nowheel` for scrollable ones), or clicking/typing
  drags the node.
- **Save with `ctx.update(patch)`.** The data is written to the node's Markdown file and can be undone.
- **Safe HTML only.** Use `textContent` for user data; `ctx.renderMarkdown(text)` returns sanitized HTML you can
  put in `innerHTML` (add class `markdown-content` for the app's Markdown styling).
- **`bodyField`** makes one field the readable body of the Markdown file, which also makes it searchable.

### Panels

```js
api.registerPanels([{
  id: 'outline', label: 'Outline', iconName: 'List',
  render(container, ctx) {
    // ctx.page is { id, name } or null; read nodes with api.workspace.getNodes()
    return { update(next) { /* redraw */ }, destroy() {} };
  },
}]);
```

`update` runs after page switches and edits (batched while dragging), so panels can simply redraw.

### Commands

```js
api.registerCommands([{
  id: 'tidy', label: 'My Plugin: tidy page',
  shortcut: 'Ctrl+Alt+T',             // optional; Ctrl = Cmd on macOS
  enabled: () => !api.workspace.isLocked(),
  handler: async () => { /* … */ },
}]);
```

### Templates

```js
api.registerTemplates([{
  id: 'meeting', name: 'Meeting notes',
  content: () => ({                   // a function: evaluated on insert (dates etc.)
    nodes: [
      { key: 'g', type: 'group', x: 0, y: 0, width: 640, height: 360, data: { title: `Meeting ${new Date().toLocaleDateString()}` } },
      { key: 'agenda', type: 'checklist', parent: 'g', x: 20, y: 50, data: { title: 'Agenda' } },
      { key: 'notes', type: 'note', parent: 'g', x: 330, y: 50, data: { title: 'Notes', content: '' } },
    ],
    edges: [{ from: 'agenda', to: 'notes', fromSide: 'right', toSide: 'left' }],
  }),
}]);
```

### Layouts

```js
api.registerLayouts([{
  id: 'circle', name: 'Circle',
  arrange({ nodes }) {
    const r = 80 * nodes.length;
    return Object.fromEntries(nodes.map((n, i) => {
      const a = (2 * Math.PI * i) / nodes.length;
      return [n.id, { x: r * Math.cos(a), y: r * Math.sin(a) }];
    }));
  },
}]);
```

### Settings

```js
api.settings.register([{ key: 'goal', label: 'Default goal', type: 'number', default: 1000 }]);
const goal = api.settings.get('goal');
const stop = api.settings.onChange((key, value) => { /* redraw */ });   // call stop() in destroy()
```

### Themes and appearance

```js
api.registerThemes([{
  id: 'forest', name: 'Forest',
  variables: { '--mf-bg': '#0f1a14', '--mf-surface': '#13221a', '--mf-text': '#e7f2ea' },
}]);

// Read or change anything in Settings → Appearance (saved for the user):
api.appearance.set({ theme: 'my-name.my-plugin.forest', textScale: 1.1, iconColor: 'accent' });
api.appearance.onChange((a) => { /* react to the user's changes */ });

// Runtime CSS, removed automatically when the plugin is switched off:
const remove = api.ui.addStyles('.ribbon { background: #0b120e; }');
```

All variables and appearance options are listed in [PLUGIN_API.md](PLUGIN_API.md#apiappearance).

## Recipes

**Insert a node next to the selection**

```js
const [id] = api.workspace.getSelection();
const from = api.workspace.getNodes().find((n) => n.id === id);
if (from) {
  const note = api.workspace.createNode('note', { x: from.x + (from.width ?? 260) + 80, y: from.y }, { title: 'Follow-up' });
  api.workspace.createEdge(from.id, note, 'next');
  api.workspace.select([note]);
}
```

**Tag every selected node**

```js
for (const n of api.workspace.getNodes().filter((n) => n.selected)) {
  const tags = Array.isArray(n.data.tags) ? n.data.tags : [];
  if (!tags.includes('review')) api.workspace.updateNodeData(n.id, { tags: [...tags, 'review'] });
}
```

**Fetch data from a web API into a node**

```js
render(container, ctx) {
  const out = document.createElement('p');
  container.appendChild(out);
  let current = ctx;
  const load = async () => {
    const res = await fetch(`https://api.example.com/quote?topic=${encodeURIComponent(current.data.topic ?? '')}`);
    const { text } = await res.json();
    current.update({ quote: text });            // saved in the vault: works offline afterwards
  };
  const sync = (next) => { current = next; out.textContent = next.data.quote ?? 'Loading…'; };
  sync(ctx);
  if (!ctx.data.quote) load().catch((e) => (out.textContent = String(e)));
  return { update: sync };
}
```

**A timer that is cleaned up**

```js
render(container, ctx) {
  const clock = document.createElement('span');
  container.appendChild(clock);
  const timer = setInterval(() => (clock.textContent = new Date().toLocaleTimeString()), 1000);
  return { destroy: () => clearInterval(timer) };
}
```

**Run a built-in command**: `await api.commands.execute('view.fit')`. All ids are listed in
[PLUGIN_API.md](PLUGIN_API.md#built-in-command-ids).

## Using npm packages

The app loads exactly one file, so `import` statements must be bundled into it. With
[esbuild](https://esbuild.github.io/):

```bash
npm init -y && npm install --save-dev esbuild
npm install chart.js            # whatever you need
```

Write your code in `src/main.js` with normal imports, then bundle:

```bash
npx esbuild src/main.js --bundle --format=esm --minify --outfile=index.js
```

Keep `src/`, `package.json` and `node_modules/` out of what you ship (they are skipped when pages are exported
with your plugin, but users don't need them). Imports from URLs (`import x from 'https://…'`) only work when the
app runs from source and are blocked in release builds, so always bundle.

## Debugging

- **Load errors** appear under your plugin in **Settings → Plugins**.
- **Errors in a node or panel** are shown inside that node or panel.
- **Console:** when running MosaicFlow from source (`pnpm tauri dev`), open the developer tools with
  `Ctrl+Shift+I` (`Cmd+Option+I` on macOS). Prefix your logs: `` console.log(`[${api.manifest.id}]`, …) ``.
- **Reload** with **Rescan**. A reload calls `deactivate()` and removes everything before `activate()` runs again.
- **Nothing happens on a shortcut?** It may clash with another command (check **Settings → Keyboard shortcuts**),
  or it's a `canvas` command and focus is in a text field.

## Publishing

A plugin is its folder. To share it:

1. Put the folder in a Git repository (`plugin.json`, `index.js`, `styles.css`, `README.md`, a licence).
2. Create a release with a zip of the folder. Bump `version` (semver) for every release.
3. Users unzip it into their plugins folder, **Rescan** and enable it.

**Plugins travel with pages.** When someone exports pages that use your node types
(**Export → MosaicFlow package**), your plugin is bundled into the `.mosaic` file by default. Whoever imports it
sees your plugin's name, version and description, a warning that plugins run code, and can choose to install it;
newer versions are offered as updates. That's why `capabilities` should list your node types.

## Checklist before you share

- [ ] `id` is unique (`yourname.plugin-name`) and `version` is bumped.
- [ ] Node `type`s are distinctive and listed in `capabilities`; you haven't renamed a released type.
- [ ] Interactive elements have `nodrag` / `nowheel`.
- [ ] No user data goes into `innerHTML` except through `renderMarkdown`.
- [ ] Timers, listeners and `settings.onChange` subscriptions are cleaned up in `destroy()`.
- [ ] CSS classes are prefixed with your plugin name.
- [ ] Works on a view-only page (check `api.workspace.isLocked()` before changing things).
- [ ] `index.js` is a single bundled file with no URL imports.
- [ ] README says what the plugin adds and how to use it.
