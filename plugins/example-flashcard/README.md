# Example plugin: Flashcard

Adds a **Flashcard** block: a question on the front and a markdown answer on the back, with a flip button and a review counter.

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

See [docs/PLUGIN_DEVELOPMENT.md](../../docs/PLUGIN_DEVELOPMENT.md) for the full API.
