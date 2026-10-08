# MosaicFlow vault format (v3)

A MosaicFlow vault is a plain folder of JSON and Markdown files. Anything that can read and write files (a text editor, a script, git, or an AI agent) can read and change it. The app watches the open page and shows external changes live.

This document is the complete contract. If you are an AI agent: read [Rules for editing](#rules-for-editing) first, then use the [recipes](#recipes).

> Prefer the MCP server (`packages/mcp-server`) when it is available: it applies all of these rules for you.

## Layout

```
MyVault/
├── vault.json                          vault metadata
├── attachments/                        shared files (optional, created when needed)
├── .mosaicflow/
│   ├── node-types.json                 node type schemas — read this to learn the fields
│   ├── .gitignore                      ignores state/, cache/, backup/
│   ├── state/<page-id>.json            viewport + selection, per device      (do not edit)
│   ├── cache/                          parsed-file cache, rebuildable        (do not edit)
│   └── backup/                         copies made by format migrations      (do not edit)
└── canvases/
    └── <Page folder>/                  one folder per page
        ├── canvas.json                 page metadata + settings
        ├── nodes/<node-id>.md          one Markdown file per node
        └── edges/<edge-id>.json        one JSON file per edge
```

Content you may read and write: `vault.json`, `canvases/**`, `attachments/**`.
Everything in `.mosaicflow/` is owned by the app; `node-types.json` is regenerated whenever a page opens.

## Identifiers

- Node, edge and page ids must match `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` and must not contain `..`. Readable slugs are preferred: `ada-lovelace`, `e-ada-babbage`.
- The **file name is the id**: `nodes/ada-lovelace.md` is node `ada-lovelace` even if its frontmatter says otherwise. Keep both equal.
- Node ids are unique within a page. Edge ids are unique within a page.
- Page ids (`canvas.json` → `id`) and the vault id are UUIDs.

## vault.json

```json
{
  "id": "db147a04-4ed4-480a-9dd5-357e4151318c",
  "name": "Research",
  "description": "",
  "created_at": "2026-01-16T04:59:05Z",
  "updated_at": "2026-01-16T04:59:05Z",
  "version": "2.0.0"
}
```

## canvas.json (a page)

```json
{
  "formatVersion": 3,
  "id": "36f0380e-4f05-46dd-a7a8-fdf834d97bdb",
  "vaultId": "db147a04-4ed4-480a-9dd5-357e4151318c",
  "name": "History of Computing",
  "description": "Pioneers, institutions and a timeline.",
  "tags": ["history"],
  "createdAt": "2026-10-06T14:17:40.166Z",
  "updatedAt": "2026-10-07T23:14:19.473Z",
  "settings": { "gridSize": 20, "locked": false, "savedFilters": ["#rust"] }
}
```

| Field | Notes |
|---|---|
| `formatVersion` | Always `3`. A page folder without it is an older format; the app migrates it when the vault opens. |
| `id` | UUID. Never change it: page links point at it. |
| `vaultId` | `id` from `vault.json`. |
| `name` | Display name; also the page part of `[[Page#Node]]` links. The folder name does not have to match. |
| `updatedAt` | ISO 8601. **Set it to now after you change anything in the page** so the app re-indexes it. |
| `settings` | Owned by the app (grid, view-only `locked`, saved filters). Keep unknown keys as they are. |

## Node files: `nodes/<id>.md`

YAML frontmatter, then a Markdown body.

```markdown
---
id: ada-lovelace
type: person
title: Ada Lovelace
layout:
  x: 430
  y: 60
  width: 270
  height: 300
  zIndex: 1
  parent: pioneers
data:
  name: Ada Lovelace
  role: Mathematician
  aliases:
    - Augusta Ada King
  tags:
    - math
  color: "#1d1a2e"
  borderColor: "#8b5cf6"
---
Wrote the first published algorithm intended for a machine. See [[Charles Babbage]].
```

| Key | Required | Meaning |
|---|---|---|
| `id` | yes | Same as the file name. |
| `type` | yes | A node type from `node-types.json` (`note`, `person`, `group`, …). |
| `title` | yes | Shown as the card title; also how `[[links]]` find the node. |
| `layout.x`, `layout.y` | yes | Position in px. Relative to the parent's top-left corner when `layout.parent` is set, otherwise page coordinates. |
| `layout.width`, `layout.height` | recommended | Size in px. Start from the type's `defaultSize`; never smaller than `minSize`. |
| `layout.zIndex` | no | `-1` for groups, `1` for cards. |
| `layout.parent` | no | Id of a container node (`capabilities.container: true`, e.g. `group`) in the same page. |
| `data` | no | All other fields of the node type (see `node-types.json` → `knowledge.fields`) plus styling. |

**Body.** The Markdown body holds one data field, named by the type's `knowledge.bodyField` (default `notes`). Do not also put that field in `data`. If the type has `knowledge.bodyLanguageField` (e.g. `code`), the body is a fenced block and the fence language is that field:

````markdown
---
id: fast-io
type: code
title: Fast input
layout: { x: 0, y: 0, width: 420, height: 260 }
data:
  language: rust
---
```rust
let mut s = String::new();
```
````

**YAML pitfalls**

- Quote every value starting with `#`: `color: "#1d1a2e"`. Unquoted, `#…` is a YAML comment and the value is lost.
- Quote values containing `: ` or starting with `[`, `{`, `*`, `&`, `!`, `|`, `>`, `@`, `` ` ``.
- Dates are ISO 8601 strings; store calendar dates at `12:00:00.000Z` so they do not shift across time zones.

## Edge files: `edges/<id>.json`

```json
{
  "source": "ada-lovelace",
  "target": "charles-babbage",
  "sourceHandle": "left-source",
  "targetHandle": "right-target",
  "label": "collaborated",
  "type": "straight",
  "animated": false,
  "data": {
    "pathType": "straight",
    "color": "#8b5cf6",
    "strokeWidth": 2.5,
    "strokeStyle": "solid",
    "markerEnd": "arrowclosed",
    "labelColor": "#8b5cf6",
    "labelBgColor": "#0d1117"
  }
}
```

| Field | Meaning |
|---|---|
| `source`, `target` | Node ids in the same page. Both nodes must exist and be connectable (`capabilities.connectable` is not `false`). |
| `sourceHandle` | `left-source`, `right-source`, `top-source` or `bottom-source`. |
| `targetHandle` | `left-target`, `right-target`, `top-target` or `bottom-target`. |
| `type` | `default` (bezier), `straight`, `step` or `smoothstep`. Mirror it in `data.pathType` (`bezier` for `default`). |
| `label` | Optional, 1–3 words. |
| `data` | Styling: `color`, `strokeWidth`, `strokeStyle` (`solid`/`dashed`/`dotted`), `markerStart`/`markerEnd` (`none`/`arrow`/`arrowclosed`), `labelColor`, `labelBgColor`, `animated`. |

Do not create two edges with the same source, target and handles, or an edge from a node to itself.

## Links, tags and references

- **Wikilinks** in any text field or body: `[[target]]`, `[[target|shown text]]`, `[[Page name#target]]`. `target` matches a node **title or id**, case-insensitive; a node on the same page wins when titles repeat. To link to a whole page, use a Page link node.
- **Tags**: `#word` in text (must start with a letter, so `#3b82f6` and `# Heading` are not tags), or `data.tags: [a, b]`.
- **Embed** node: `data.ref: "Page name#node title or id"` shows a live copy of that node.
- **Page link** node (`type: page`): `data.canvasId` = the target page's `canvas.json` id, `data.page` = its name.
- Backlinks are computed; never stored.

## node-types.json

`.mosaicflow/node-types.json` describes every node type the app knows, including plugins:

- `nodeTypes[].type`: value for `type:` in node files.
- `knowledge.purpose`: when to use it.
- `knowledge.fields`: the meaningful `data` fields with types and allowed values.
- `knowledge.bodyField`, `knowledge.bodyLanguageField`: see [Body](#node-files-nodesidmd).
- `capabilities.container`, `capabilities.connectable`; `defaultSize`, `minSize`, `defaultData`.
- `design`: colour palette and layout rules for readable boards.

Read it before creating nodes; it is the source of truth for field names.

## Rules for editing

1. Only touch `vault.json`, `canvases/**` and `attachments/**`. Leave `.mosaicflow/` alone.
2. Write each file completely, UTF-8. When possible write to a temporary file in the same folder and rename it over the target, so the app never reads a half-written file.
3. Keep the file name and the `id` inside equal; use only safe id characters.
4. After changing a page, set `updatedAt` in its `canvas.json` to the current time.
5. Keep unknown fields as they are: plugins and future versions may use them.
6. Keep the graph consistent:
   - every edge's `source` and `target` exist in the same page;
   - every `layout.parent` points to a container in the same page;
   - deleting a node also deletes its edges and detaches its children.
7. Never edit `canvas.json` → `id` or `vaultId`.
8. If the app has unsaved changes to the same node, the app's version wins. Edit one node at a time and let the app pick it up.

## Recipes

**Read a page.** Open `canvas.json`, then every `nodes/*.md` (frontmatter + body) and `edges/*.json`.

**Add a node.** Pick a free id, choose a `type` from `node-types.json`, write `nodes/<id>.md` with `id`, `type`, `title`, `layout` (size ≥ `minSize`, not overlapping other nodes) and `data`; put the body field in the Markdown body. Bump `updatedAt`.

**Edit a node.** Change only the keys you mean to change; keep the rest of the frontmatter and body. Bump `updatedAt`.

**Connect two nodes.** Write `edges/e-<source>-<target>.json` with handles facing each other (e.g. `right-source` → `left-target` when the target is to the right). Bump `updatedAt`.

**Put a node in a group.** Set `layout.parent: <group-id>` and convert its position to group-relative: `x = nodeX - groupX`, `y = nodeY - groupY`. Leave 30 px side padding and 60 px top padding; grow the group if needed.

**Take a node out of a group.** Remove `layout.parent` and convert back: `x = groupX + x`, `y = groupY + y`.

**Delete a node.** Delete `nodes/<id>.md`; delete every `edges/*.json` whose `source` or `target` is that id; for each child with `layout.parent: <id>`, remove the parent and make its position absolute.

**Create a page.** Create `canvases/<Folder name>/` with `nodes/`, `edges/` and a `canvas.json`: `formatVersion: 3`, a new UUID `id`, `vaultId` from `vault.json`, `name`, `createdAt` = `updatedAt` = now. Page names must be unique in the vault (case-insensitive).

**Rename a page.** Change `name` in `canvas.json`, update `[[Old name#…]]` links and `data.page` of Page link nodes in other pages. Renaming the folder is optional.

**Delete a page.** Delete its folder. Links to it become unresolved.

## Older formats

Pages written by earlier versions have `.mosaic/meta.json`, `workspace.json` and `edges/<id>/joined.json`. When the app opens such a vault it converts every page to v3 and copies the replaced files to `.mosaicflow/backup/v2-<date>/`. Tools should only write v3.
