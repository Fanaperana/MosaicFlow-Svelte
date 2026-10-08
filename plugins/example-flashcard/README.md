# Example plugin: Flashcard

Adds a **Flashcard** block: a question on the front and a markdown answer on the back, with a flip button and a review counter. Also:

- **Flashcard review** panel (lightbulb in the ribbon): step through the page's cards, least-reviewed first
- **Study set** template: `Ctrl+P` → "Insert template: Study set"
- **Flashcard deck** layout: `Ctrl+P` → "Arrange: Flashcard deck (rows of 4)"
- **Reset review counts** command: `Ctrl+P` → "Flashcards: reset…"

## Install

1. In MosaicFlow, click the **Plugins** button (puzzle icon, bottom of the left ribbon) and choose **Open plugins folder**.
   The folder is `{APP_DATA}/plugins`, for example `%APPDATA%\com.mosaicflow.app\plugins` on Windows.
2. Copy this whole `example-flashcard` folder into it.
3. Back in the Plugins dialog, click **Rescan** and switch **Flashcard** on.
4. Press `/` on a canvas and type `flash`.

## Files

```
example-flashcard/
├── plugin.json   # manifest: id, name, version, entry points
├── index.js      # ES module exporting activate(api)
└── styles.css    # optional, injected while the plugin is enabled
```

See the [plugin guide](../../docs/PLUGIN_DEVELOPMENT.md) and the [API reference](../../docs/PLUGIN_API.md). To start
your own plugin, use the [starter template](../plugin-template/) (`pnpm create-plugin "Name"`).
