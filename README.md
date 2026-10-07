<p align="center">
  <img src="static/MosaicFlow-Word.png" alt="MosaicFlow" width="400">
</p>

<p align="center">
  <strong>A node-based knowledge base: notes, research and ideas on an infinite canvas, stored as plain files you own.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting started</a> •
  <a href="#blocks">Blocks</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a> •
  <a href="#plugins">Plugins</a> •
  <a href="#ai-assistants-mcp">AI / MCP</a> •
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-blue?style=flat-square&logo=tauri" alt="Tauri 2">
  <img src="https://img.shields.io/badge/Svelte-5-orange?style=flat-square&logo=svelte" alt="Svelte 5">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-backend-black?style=flat-square&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
</p>

<p align="center">
  <img src="docs/images/canvas.png" alt="MosaicFlow canvas with the pages sidebar and the properties panel" width="100%">
</p>

---

## Features

### 🧭 Navigate like Notion and Obsidian
- **Pages sidebar**: every canvas of the vault one click away, with recent pages, inline rename and new pages, without leaving the canvas.
- **Back / forward** history (`Alt + ←/→` or mouse buttons) and a **quick switcher** (`Ctrl + K`) for pages and nodes.
- **Vault switcher** (`Ctrl + Shift + O`): jump between vaults; each one reopens the page you last used.
- **Hover previews**: hover any `[[wikilink]]`, backlink or embed to see the target node and a mini-map of its page.

<p align="center">
  <img src="docs/images/link-preview.png" alt="Hover preview of a link to a node on another page" width="100%">
</p>

### ✍️ Add blocks the Notion way
Press <kbd>/</kbd> or double-click empty canvas space to open the block menu: type to filter, arrows to move, <kbd>Enter</kbd> to insert. Dragging a connection into empty space opens the same menu and links the new block automatically.

<p align="center">
  <img src="docs/images/insert-menu.png" alt="The / block menu" width="100%">
</p>

### 🔗 A connected knowledge base
- `[[Wikilinks]]` between nodes, across pages (`[[Page#Node]]`) or to whole pages, with **backlinks** and **#tags**.
- Labelled, styled edges (bezier, straight, step; solid, dashed, dotted, animated; arrow markers).
- **Groups** (`Ctrl + G`) to frame related ideas, and a **Story** view to step through a page in a chosen order.
- Vault-wide **search** across every page and node, plus a canvas filter that fades out non-matching nodes.

### 🎛️ Compact, Notion-style properties
Select a node or edge to edit it in a dense side panel: page-style title, typed properties, tags, links and backlinks, colors, borders, layout and locks.

### 📁 Your data, as plain files
- A **vault** is a folder; each page is a folder; each node is a **Markdown file** with frontmatter. Edit them in any editor and changes sync live.
- **Import** `.mosaic` packages, Obsidian `.canvas`, MosaicFlow JSON, Mermaid flowcharts, or a whole folder of Markdown notes (e.g. an Obsidian vault, where `[[links]]` become edges). Drag & drop works too.
- **Export** a page or a whole vault as `.mosaic`, or a page as Obsidian canvas, JSON, PNG or SVG.

<p align="center">
  <img src="docs/images/overview.png" alt="A full page: grouped code snippets, notes, links and a 4-week plan" width="100%">
</p>

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

### Run

```bash
git clone https://github.com/Fanaperana/MosaicFlow-Svelte.git
cd MosaicFlow-Svelte
pnpm install

pnpm tauri dev      # run the desktop app in development
pnpm tauri build    # build an installer
```

On first launch, create a vault (any folder) or open an existing one, then start adding blocks with <kbd>/</kbd>.

---

## Blocks

| Group | Blocks |
|-------|--------|
| **Basic blocks** | Note (Markdown), Simple Text, Checklist, Callout, Page link, Image, Link, Code, Iframe |
| **People & organizations** | Person, Organization, Timestamp |
| **Research data** | Domain, Hash, Credential, Social Post, Router, Snapshot |
| **Layout & embeds** | Group, Map, Link List, Action, Annotation, Embed |
| **Plugins** | Anything you install, e.g. the example [Flashcard](plugins/example-flashcard/) |

Highlights:
- **Note**: Markdown with live rendering, `[[wikilinks]]` and `#tags`.
- **Checklist**: tasks with progress; <kbd>Enter</kbd> adds a task, <kbd>Backspace</kbd> on an empty one removes it.
- **Callout**: tip / info / warning / danger box; click the emoji to change its style.
- **Page link**: a card linking to another page, with a live outline of it.
- **Embed**: a live, read-only copy of a node from anywhere in the vault.
- **Map**: interactive MapLibre map with markers.

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| <kbd>/</kbd> or double-click | Insert a block |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>O</kbd> | Search pages and nodes |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> | Switch vault |
| <kbd>Ctrl</kbd> + <kbd>\\</kbd> | Show / hide the pages sidebar |
| <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | Back / forward between pages |
| <kbd>Ctrl</kbd> + <kbd>G</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> | Group / ungroup |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Duplicate selection |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Select all nodes |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> | Undo / redo |
| <kbd>Delete</kbd> | Delete selection |
| <kbd>F2</kbd> or double-click (sidebar) | Rename a page |
| <kbd>Space</kbd> + drag | Pan |
| <kbd>Esc</kbd> | Clear selection / close menus |

---

## Plugins

Add your own blocks without rebuilding the app. Plugins live in your app data folder:

| Platform | Folder |
|----------|--------|
| Windows | `%APPDATA%\com.mosaicflow.app\plugins` |
| macOS | `~/Library/Application Support/com.mosaicflow.app/plugins` |
| Linux | `~/.local/share/com.mosaicflow.app/plugins` |

Open **Plugins** (puzzle icon at the bottom of the left ribbon) to open that folder, rescan, and switch plugins on or off. New plugins stay **disabled until you enable them**, because they run with the same access as the app.

<p align="center">
  <img src="docs/images/plugins.png" alt="The Plugins dialog" width="100%">
</p>

A plugin is a folder with a `plugin.json` and a single ES module. Nodes are framework-free:

```js
export function activate(api) {
  api.registerNodeTypes([{
    type: 'hello',
    label: 'Hello',
    render(container, ctx) {
      container.textContent = `Hello from ${ctx.data.title}`;
      return { update: (next) => (container.textContent = `Hello from ${next.data.title}`) };
    },
  }]);
}
```

Share a plugin by publishing its folder on GitHub; users drop it into their plugins folder and enable it. See the [plugin guide](docs/PLUGIN_DEVELOPMENT.md) and the [Flashcard example](plugins/example-flashcard/).

---

## AI assistants (MCP)

`packages/mcp-server` is a [Model Context Protocol](https://modelcontextprotocol.io/) server that lets assistants such as Claude or Copilot read, search and build canvases directly in a vault folder: list and read pages, search, follow links and tags, create and connect nodes, group, auto-layout and import Mermaid. Changes appear live in the open app.

```bash
pnpm --filter @mosaicflow/mcp-server build
node packages/mcp-server/dist/mosaicflow-mcp.mjs "/path/to/your/vault"
```

---

## Development

### Tech stack
- **[Tauri 2](https://v2.tauri.app/)** + **Rust** for the desktop shell, file access and vault services
- **[SvelteKit](https://kit.svelte.dev/)** with **Svelte 5 runes** and **TypeScript**
- **[Svelte Flow](https://svelteflow.dev/)** for the canvas
- **[Tailwind CSS v4](https://tailwindcss.com/)**, [bits-ui](https://bits-ui.com/), [Lucide](https://lucide.dev/) icons
- **[CodeMirror](https://codemirror.net/)** editors and **[MapLibre GL](https://maplibre.org/)** maps

### Project structure

```
MosaicFlow-Svelte/
├── src/                     # SvelteKit app
│   ├── lib/components/      # Canvas, sidebars, panels, node components
│   ├── lib/kernel/          # Plugin loader and registries
│   ├── lib/plugins/         # Built-in plugins (core node sets)
│   ├── lib/stores/          # Svelte 5 rune stores (workspace, vault, pages, plugins…)
│   └── lib/services/        # Navigation, import/export, file services
├── packages/
│   ├── node-*/              # Built-in node types, one package each
│   ├── node-sdk/            # Shared node building blocks
│   ├── vault-core/          # Vault format, Markdown codec, knowledge index, importers
│   └── mcp-server/          # MCP server for AI assistants
├── plugins/example-flashcard/  # Example user plugin
├── crates/                  # Shared Rust crates
├── src-tauri/               # Tauri app (Rust commands and services)
└── docs/                    # Architecture, API and plugin docs
```

### Checks

```bash
pnpm check                                   # svelte-check / TypeScript
pnpm --filter ./packages/vault-core exec vitest run   # vault-core unit tests
cd src-tauri && cargo check                  # Rust
```

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md) and [docs/PLUGIN_DEVELOPMENT.md](docs/PLUGIN_DEVELOPMENT.md).

---

## Contributing

Contributions are welcome! Work in this repo is issue-driven, so every change maps to an issue and a closing commit.

- **Start with an issue** (`bug`, `feature`, `enhancement`, `refactor` or `docs`) describing the change and its acceptance criteria.
- **Branch**: `<type>/<issue-number>-<slug>`, e.g. `feature/42-maplibre-integration`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/), closing the issue in the footer (`Closes #42`).
- **PRs**: reference the issue and keep the scope to it; run `pnpm check` first.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## License

MIT; see [LICENSE](LICENSE).

## Acknowledgments

[Tauri](https://tauri.app/), [Svelte](https://svelte.dev/), [xyflow](https://xyflow.com/), [shadcn-svelte](https://shadcn-svelte.com/) and [MapLibre](https://maplibre.org/), and the Notion and Obsidian teams for the inspiration.

<p align="center">
  Made with ❤️ for researchers, students and visual thinkers
</p>
