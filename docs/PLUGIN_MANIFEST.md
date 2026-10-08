# plugin.json

Every plugin folder needs a `plugin.json`. MosaicFlow reads it to list the plugin in **Settings → Plugins**, to
load its code, and to work out which plugin provides a node type when pages are exported.

```json
{
  "id": "yourname.word-count",
  "name": "Word Count",
  "version": "1.2.0",
  "description": "Counts the words on a page and tracks goals.",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://github.com/yourname/word-count",
  "apiVersion": "0.1.0",
  "capabilities": [{ "type": "nodeTypes", "types": ["wordcount-goal"] }],
  "frontend": {
    "main": "./index.js",
    "styles": "./styles.css"
  }
}
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | **yes** | Unique id: letters, numbers, `.`, `-`, `_`, max 128 characters, not starting with `core.`. Use `yourname.plugin-name`. Never change it after release: it identifies the plugin for updates, enabled state and settings. |
| `name` | **yes** | Display name in the Plugins list, notifications and the command palette |
| `version` | **yes** | [Semantic version](https://semver.org/) (`1.2.0`). When pages are imported with a bundled copy, versions are compared to offer an update. |
| `frontend.main` | **yes** | Path of your ES module inside the folder |
| `frontend.styles` | no | Path of a CSS file, injected while the plugin is on |
| `description` | no | One line shown in the Plugins list and the import dialog |
| `author` | no | Shown in the Plugins list and the import dialog |
| `license` | no | SPDX id, e.g. `MIT` |
| `homepage` | no | Repository or website |
| `apiVersion` | no | Plugin API version you built against (currently `0.1.0`) |
| `capabilities` | recommended | `[{ "type": "nodeTypes", "types": [...] }]`: the node types you register. Used to bundle your plugin with exported pages and to tell users which plugin a missing node type needs. |

Paths in `frontend` are relative to the folder and can't point outside it.

Other fields (`permissions`, `dependencies`, `pluginType`, `core`) are accepted for compatibility but not used:
plugins currently run with full access, and users are warned about that before enabling or installing one.

## Folder layout

```
plugins/
└── word-count/          # folder name doesn't matter; the id does
    ├── plugin.json
    ├── index.js
    ├── styles.css
    └── README.md
```

Only files inside the folder are read. When pages are exported with your plugin, the whole folder is copied
except `.git` and `node_modules`.
