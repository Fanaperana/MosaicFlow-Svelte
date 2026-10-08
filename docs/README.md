# MosaicFlow documentation

## Using MosaicFlow

| Document | Contents |
|----------|----------|
| [User guide](USER_GUIDE.md) | Vaults, pages, blocks, connections, links, search, graph, palette, import/export, settings, shortcuts |
| [Vault format](VAULT_FORMAT.md) | How vaults are stored on disk, for editing files by hand or with other tools |

## Building plugins

| Document | Contents |
|----------|----------|
| [Plugin guide](PLUGIN_DEVELOPMENT.md) | What plugins can do, quick start, tutorial, recipes, bundling, publishing |
| [Plugin API reference](PLUGIN_API.md) | Every API member, render contexts, built-in ids, icons, CSS variables, limits |
| [plugin.json](PLUGIN_MANIFEST.md) | Manifest fields |
| [Starter template](../plugins/plugin-template/) | A working plugin with one of everything; `pnpm create-plugin "Name"` copies it |
| [Flashcard example](../plugins/example-flashcard/) | A complete plugin: node, panel, template, layout, command |

## Developing MosaicFlow

| Document | Contents |
|----------|----------|
| [Architecture](ARCHITECTURE.md) | Kernel, registries, plugin loading |
| [Internal API](API.md) | Stores and services inside the app |
| [Node components](../src/lib/components/nodes/README.md) | Writing built-in node types |
| [UI test cases](TEST_CASES.md) | Manual test plan |
| [Contributing](../CONTRIBUTING.md) | Issues, branches, commits |
