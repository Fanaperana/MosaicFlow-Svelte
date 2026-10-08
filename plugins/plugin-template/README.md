# My Plugin

A MosaicFlow plugin. It adds:

- **My Plugin card**: a block with text and a click counter (press `/` on a page)
- **My Plugin outline**: a sidebar panel listing the page's nodes (ribbon button)
- **My Plugin: count nodes on this page**: a command (`Ctrl+P`)
- **My Plugin starter**: a template (`Ctrl+P` → "Insert template")
- **Single column**: a layout (`Ctrl+P` → "Arrange")
- Settings under **Settings → Plugins → My Plugin**

## Install

1. In MosaicFlow, open **Plugins** (puzzle icon at the bottom of the left ribbon) → **Open plugins folder**.
2. Copy this folder into it.
3. Click **Rescan**, then switch **My Plugin** on.

## Develop

| File | Purpose |
|------|---------|
| `plugin.json` | Id, name, version and entry files |
| `index.js` | The plugin: `activate(api)` registers everything |
| `styles.css` | Styles (global, so prefix every class) |
| `mosaicflow.d.ts` | API types for editor autocomplete; not loaded by the app |

Edit, then click **Rescan** in the Plugins dialog to reload. Errors appear under the plugin in that dialog and in
the developer console (`Ctrl+Shift+I`).

Guide: [Plugin development](https://github.com/Fanaperana/MosaicFlow-Svelte/blob/main/docs/PLUGIN_DEVELOPMENT.md) ·
Reference: [Plugin API](https://github.com/Fanaperana/MosaicFlow-Svelte/blob/main/docs/PLUGIN_API.md)
