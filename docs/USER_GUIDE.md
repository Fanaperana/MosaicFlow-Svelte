# MosaicFlow user guide

MosaicFlow is a knowledge base on an infinite canvas. You place **blocks** (notes, links, people, checklists,
maps, …) on **pages**, connect them, and everything is saved as plain Markdown files in a folder you own.

- [Vaults and pages](#vaults-and-pages)
- [The window](#the-window)
- [Working on the canvas](#working-on-the-canvas)
- [Blocks](#blocks)
- [Connections](#connections)
- [Groups](#groups)
- [The properties panel](#the-properties-panel)
- [Links, backlinks and tags](#links-backlinks-and-tags)
- [Writing notes](#writing-notes)
- [Finding things](#finding-things)
- [Graph view](#graph-view)
- [Story and node list](#story-and-node-list)
- [Command palette, templates and layouts](#command-palette-templates-and-layouts)
- [View-only pages](#view-only-pages)
- [Import and export](#import-and-export)
- [Sharing pages that use plugins](#sharing-pages-that-use-plugins)
- [Plugins](#plugins)
- [Settings](#settings)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Your files](#your-files)
- [AI assistants](#ai-assistants)

---

## Vaults and pages

A **vault** is a folder on your computer. Each **page** in it is an infinite canvas.

- **Start screen:** **Create New Vault** (pick a name and a parent folder) or **Open Existing Vault**.
  Recent vaults are listed; removing one from the list doesn't delete its files.
- **All pages:** the page list shows every page of the vault, sorted by **Recent** or **Name**, with a search box
  (names and tags). The sidebar lists your vaults with their page counts; vaults whose folder was moved or
  deleted are marked so you can remove them. Drag the divider to resize the sidebar.
- **Pages:** create with **New page** (`Ctrl+N`), rename by clicking the title in the page header, delete from
  the page list (you're asked to confirm; this can be turned off in Settings).
- **Switch vault:** `Ctrl+Shift+O`. Each vault reopens the page you used last.

On macOS, read `Ctrl` as `Cmd` throughout this guide.

## The window

| Area | What it does |
|------|--------------|
| **Ribbon** (far left) | Pages sidebar, search, graph view, undo/redo, zoom, fit, delete; plugin panels; at the bottom: plugins, export, settings |
| **Pages sidebar** (`Ctrl+\`) | Recent pages and all pages of the vault, new page |
| **Page header** | Back/forward, page title, lock (view only), node list, properties panel toggle |
| **Toolbar** (top centre) | Quick-insert buttons for common blocks |
| **Canvas** | Your page. Minimap and zoom controls in the corners (both optional) |
| **Properties panel** (`Ctrl+Shift+\`) | Edit the selected block or connection |
| **Plugin panel** | Opens on the right when you click a plugin's ribbon button |

## Working on the canvas

| To | Do |
|----|----|
| Insert a block | `/`, double-click empty space, right-click → **Insert block…**, or a toolbar button |
| Select | Click; `Shift`+click to add; drag on empty space to box-select; `Ctrl+A` for all |
| Move | Drag. Hold `Shift` to snap to the edges and centres of nearby blocks (guides appear) |
| Resize | Drag a selected block's edges or corners; `Shift` snaps here too |
| Pan | Drag empty space with the hand tool (`H`); `V` returns to the select tool |
| Zoom | Scroll, `Ctrl+=` / `Ctrl+-`, or the ribbon; `Shift+1` fits everything |
| Duplicate / delete | `Ctrl+D` / `Delete` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` |

Right-click a block for **Copy link**, **Duplicate**, **Group**/**Ungroup** and **Delete**. Right-click empty
space for **Insert block…**, **Lock page** and switching between select and drag mode.

**Snap to grid** and the **grid style** are in Settings → Canvas.

Everything saves automatically.

## Blocks

Press `/` and type to filter; arrow keys and `Enter` insert. Recently used blocks come first.

| Group | Blocks |
|-------|--------|
| **Basic** | Note (Markdown), Simple text, Checklist, Callout, Page link, Image, Link, Code, Iframe |
| **People & organizations** | Person, Organization, Timestamp |
| **Research data** | Domain, Hash, Credential, Social post, Router, Snapshot |
| **Layout & embeds** | Group, Map, Link list, Action, Annotation, Embed, Calendar, Timer |
| **Plugins** | Blocks from plugins you've enabled |

Highlights:

- **Note:** Markdown with live rendering, `[[links]]` and `#tags`.
- **Checklist:** `Enter` adds a task, `Backspace` on an empty task removes it; shows progress.
- **Callout:** tip / info / warning / danger; click the emoji to change it.
- **Page link:** a card for another page with a live outline of it; click to open.
- **Embed:** a live, read-only copy of another block from anywhere in the vault.
- **Annotation:** free text without a frame, with adjustable font size and family and an optional arrow; good
  for labelling parts of a page.
- **Map:** an interactive map with markers.
- **Calendar:** month and agenda views; events can repeat and remind you with a desktop notification, even when
  the page isn't open.
- **Timer:** countdown, stopwatch with laps, and pomodoro; keeps running when you switch pages and notifies you.

## Connections

- **Connect:** drag from a dot on a block's edge to another block. Drag into empty space to create a new block
  that's already connected.
- **Reconnect:** select a connection, then drag one of the grab dots near its ends to another block.
- **Label:** select the connection and type a label in the properties panel. Labels stay readable above blocks;
  clicking a label selects its connection.
- **Style:** in the properties panel: curved, straight or stepped; solid, dashed, dotted or animated; colour,
  width and arrows at either end.

## Groups

Select blocks and press `Ctrl+G` (or right-click → **Group**) to frame them. Drag blocks into or out of a group.
`Ctrl+Shift+G` ungroups. Moving a group moves everything in it. Layouts and `Shift`-snapping work inside groups
too.

## The properties panel

Select a block to edit:

- **Title**, and the block's own **properties** (text, URL, dates, …)
- **Tags**
- **Links** (to other blocks) and **Backlinks** (blocks that link here); click to jump
- **Appearance:** fill, text colour, border, style, corner radius, header on/off
- **Layout:** size and locks
- **Copy link** (a `[[link]]` that never breaks), **Duplicate**, **Delete**

Select a connection to edit its label, path type, line style, colour, width and arrows.

## Links, backlinks and tags

In any text field that supports Markdown, type `[[` to pick a block or page to link to.

| You write | Links to |
|-----------|----------|
| `[[Title]]` | A block with that title (or a page with that name) |
| `[[Page#Title]]` | A block on a specific page |
| `[[Page]]` | A page |
| `[[node-id]]` | A specific block by id; it always shows the block's current title, so renames never break it |

- **Hover** a link, backlink or embed to preview the target and a mini-map of its page (delay and on/off in
  Settings → General).
- **Click** a link to go there; `Alt+←` / `Alt+→` (or the mouse's back/forward buttons) move through your history.
- **`#tags`** in text and the **Tags** property are collected vault-wide. Click a tag to highlight it.

## Writing notes

- **`/` commands:** type `/` at the start of a line or after a space for headings, lists, tasks, quotes, code,
  tables, math, Mermaid diagrams, dividers, inline formatting and links. Keep typing to filter, `Enter` or `Tab`
  inserts, `Esc` closes. Text already on the line is converted where it makes sense (`Intro /h1` → `# Intro`).
  Inside a table it also offers add/delete row or column, column alignment and format.
- **Tables:** `Tab` / `Shift+Tab` move between cells and re-align the whole table as you type; `Enter` goes to
  the next row (adding one at the end); `Ctrl+Enter` leaves the table. Typing `| a | b` and pressing `Tab` turns
  it into a table.

  | Shortcut | In a table |
  |----------|------------|
  | `Ctrl+Shift+F` / `Ctrl+Alt+Shift+F` | Format this table / every table in the note |
  | `Ctrl+Alt+←` `→` `↑` `↓` | Align column left / right / center / none |
  | `Alt+↑` `↓` / `Alt+←` `→` | Move row / column |

- **Math:** `$x^2$` inline, `$$ … $$` or a ` ```math ` block for display equations (KaTeX). Amounts like
  `$5 and $10` stay text.
- **Diagrams:** a ` ```mermaid ` block renders as a diagram.

Formulas, diagrams and tables show their source while the cursor is inside them; click one to edit it.

## Finding things

- **Search** (`Ctrl+K` or `Ctrl+O`): every page and block in the vault. Type, use the arrows, `Enter` opens.
- **Filter the page:** the filter button on the canvas fades out blocks that don't match a word or `#tag` (groups
  stay visible for context). Bookmark filters you use often.

## Graph view

`Ctrl+Alt+G` or the ribbon: every block and page as a network, coloured by page.

- **Whole vault** / **This page**; **Page hubs**, **Canvas connections** and **Unlinked nodes** can be switched on
  or off; search to highlight.
- Hover to see a block's links, drag blocks around, scroll to zoom, drag the background to pan.
- Click a block to open it on its page. `Esc` closes.

## Story and node list

The node list (`Ctrl+Shift+L` or the list button in the page header) shows every block on the page.

- **Story:** walk through the page step by step with the arrows; drag items to change the order (it's saved with
  the page). Good for presenting or reading a page in a set order.
- **Canvas:** the blocks as they're arranged, with groups and their contents.

## Command palette, templates and layouts

`Ctrl+P` opens the **command palette**: every action in the app and in your plugins, searchable, with shortcuts.

- **Insert template: …** adds a ready-made set of blocks at the centre of the view.
- **Arrange: …** tidies blocks. Built in: **Flow left to right** and **Flow top to bottom** (follow the
  connections) and **Grid**. Select two or more blocks to arrange only those; otherwise the whole page is arranged.
- **Toggle panel: …** opens or closes a plugin panel.

Templates and arrangements are one undo step each. Plugins can add more of all three.

## View-only pages

Lock a page (`Ctrl+Shift+K`, the lock in the page header, or right-click → **Lock page**) to read it and follow
links without moving or changing anything by accident. Unlock the same way.

## Import and export

**Import** (page list → **Import**, or drag and drop files onto the window):

| Format | Becomes |
|--------|---------|
| `.mosaic` / `.zip` | MosaicFlow pages (with a preview, see below) |
| `.canvas` | An Obsidian canvas as a page |
| `.json` | A MosaicFlow JSON export |
| `.mmd`, `.mermaid`, Markdown with a Mermaid flowchart | A page of connected blocks |
| **Markdown notes folder…** | A page per folder of notes, e.g. an Obsidian vault: each note becomes a block and `[[wikilinks]]` become connections |

Double-clicking a `.mosaic` file in your file manager opens it in MosaicFlow.

When importing a `.mosaic`, a preview lets you choose:

- **Which pages** to import.
- **Import into** this vault or a **New vault**.
- **If a page already exists:** **Keep both** (the copy gets a number), **Replace** (links to the old page keep
  working) or **Skip**.
- **Which bundled plugins** to install (see below).

**Export** (ribbon → export button, or `Ctrl+Shift+E`):

| Format | Contains |
|--------|----------|
| **MosaicFlow package** (`.mosaic`) | This page, some pages, or the whole vault, with images and attachments, and optionally the plugins they use |
| **Obsidian canvas** (`.canvas`) | The current page |
| **JSON** | The current page |
| **Image** (`.png`) / **Vector** (`.svg`) | A picture of the current page |

## Sharing pages that use plugins

If the pages you export use blocks from plugins, the export dialog lists those plugins and includes them in the
`.mosaic` file (you can untick them). It also warns about block types whose plugin you don't have installed.

When you import a file that contains plugins, the preview shows each one with its version and what it's used
for, and whether it's new, an update, or already installed. Tick the ones you want: they're installed and
switched on before the pages are added. Plugins run with full access to the app and your files, so only install
plugins from people you trust; unticked plugins are skipped and their blocks show as placeholders until the
plugin is installed.

## Plugins

Plugins add blocks, sidebar panels, commands, templates, layouts, themes and settings, and can adjust the
appearance options.

- Open **Plugins** (puzzle icon at the bottom of the ribbon, or Settings → Plugins).
- **Open plugins folder**, drop a plugin's folder in it, click **Rescan**, then switch the plugin on. New plugins
  are always off until you enable them.
- A plugin's settings appear under it in the same place.
- Switching a plugin off removes everything it added; its blocks stay in your files and come back when you switch
  it on again.

Want to build one? See the [plugin guide](PLUGIN_DEVELOPMENT.md).

## Settings

`Ctrl+,` or the gear at the bottom of the ribbon. Settings are saved in `settings.json` in the app data folder,
so you can back them up or copy them to another computer. Click a percentage to reset that slider to 100%;
**Reset** restores a whole section.

| Section | Setting | Default |
|---------|---------|---------|
| **General** | Link hover previews | On |
| | Preview delay | 380 ms |
| | Confirm before deleting pages | On |
| **Appearance** | Theme | MosaicFlow (or Midnight, Graphite, Nord, Solarized dark, High contrast, and plugin themes) |
| | Accent colour | Blue `#5b8def` |
| | Interface scale (zooms the whole window) | 100% |
| | Text size (menus, panels, dialogs) | 100% |
| | Density (row height of menus and lists) | Default (or Compact, Comfortable) |
| | Corner radius | 6 px |
| | Interface font | Space Grotesk (or System, Serif, PT Mono, or any installed font by name) |
| | Code font | PT Mono (or Space Mono, System monospace, or any installed font) |
| | Icon size | 100% |
| | Icon colour | Default (or Accent, Custom) |
| | Icon weight | Regular (or Thin, Bold) |
| | Reduce motion | Off |
| | Custom CSS | Your own CSS on top of everything, e.g. `:root { --mf-bg: #101418; }` |
| **Canvas** | Background | Dots (or Lines, Cross, None) |
| | Grid size | 20 px |
| | Snap to grid | Off |
| | Minimap | On |
| | Zoom controls | On |
| | Double-click to insert | On |
| **Keyboard shortcuts** | Change, add or remove the keys of any command, including plugin commands | |
| **Plugins** | Enable, disable, rescan, and plugin settings | |

## Keyboard shortcuts

All of these can be changed in **Settings → Keyboard shortcuts** (`Ctrl+/`).

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Command palette |
| `Ctrl+K`, `Ctrl+O` | Search pages and blocks |
| `/` | Insert a block |
| `Ctrl+N` | New page |
| `Ctrl+Shift+O` | Switch vault |
| `Alt+←` / `Alt+→` | Back / forward |
| `Ctrl+\` | Pages sidebar |
| `Ctrl+Shift+\` | Properties panel |
| `Ctrl+Shift+L` | Node list / story |
| `Ctrl+Alt+G` | Graph view |
| `Ctrl+Shift+K` | Lock / unlock page |
| `Ctrl+Shift+E` | Export as `.mosaic` |
| `Shift+1` | Fit view |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |
| `V` / `H` | Select tool / hand tool |
| `Ctrl+A` | Select all |
| `Ctrl+D` | Duplicate |
| `Delete`, `Backspace` | Delete selection |
| `Ctrl+G` / `Ctrl+Shift+G` | Group / ungroup |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Ctrl+,` | Settings |
| `Ctrl+/` | Keyboard shortcuts |
| `Esc` | Clear selection, close menus and dialogs |

## Your files

Everything is plain files in the vault folder:

```
MyVault/
├── vault.json
├── AGENTS.md                 # instructions for AI tools (refreshed by the app)
├── .mosaicflow/node-types.json
└── My Page/
    ├── canvas.json           # page settings and layout
    ├── nodes/<id>.md         # one Markdown file per block, with frontmatter
    └── edges/<id>.json       # one file per connection
```

You can edit the Markdown files in any editor or sync the folder with Git or a cloud drive; open pages update
live when files change. The format is documented in [VAULT_FORMAT.md](VAULT_FORMAT.md).

`AGENTS.md` explains the format to AI coding tools that open the folder. MosaicFlow refreshes it when the vault
opens; delete its first line to keep your own version.

## AI assistants

MosaicFlow includes an MCP server so assistants such as Claude Desktop, VS Code Copilot or Cursor can search
your vault, answer from your notes, and build pages for you. Setup is in the
[README](../README.md#ai-assistants-mcp).
