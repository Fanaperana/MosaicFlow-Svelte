# GitHub Copilot Instructions for MosaicFlow

This document provides instructions for GitHub Copilot to better assist with the MosaicFlow project.

## Project Overview

**MosaicFlow** is a powerful node-based canvas application for visual information mapping and OSINT (Open Source Intelligence) investigations. It's built as a desktop application using Tauri 2.0 with a Svelte 5 frontend.

## Tech Stack

### Frontend
- **Svelte 5** - Using the new runes API (`$state`, `$derived`, `$effect`, `$props`)
- **SvelteKit** - For routing and build tooling
- **TypeScript** - Strict type checking enabled
- **Tailwind CSS v4** - For styling
- **@xyflow/svelte** - For the node-based canvas
- **svelte-maplibre-gl** - For interactive map components (inspired by [mapcn](https://mapcn.vercel.app/))
- **bits-ui** - For accessible UI components
- **lucide-svelte** - For icons

### Backend
- **Tauri 2.0** - Rust-based desktop application framework
- **Rust** - For native performance and security

### Package Manager
- **pnpm** - Preferred package manager

## Project Structure

```
src/
├── lib/
│   ├── api/           # Tauri bridge and API utilities
│   ├── components/    # Svelte components
│   │   ├── nodes/     # Node type components (18+ types)
│   │   │   ├── _shared/   # Shared node utilities
│   │   │   ├── content/   # Content nodes (Note, Image, Link, etc.)
│   │   │   ├── entity/    # Entity nodes (Person, Organization, etc.)
│   │   │   ├── osint/     # OSINT nodes (Domain, IP, Hash, etc.)
│   │   │   └── utility/   # Utility nodes (Group, Map, LinkList, etc.)
│   │   ├── edges/     # Edge components
│   │   ├── editor/    # Editor components
│   │   └── ui/        # UI components
│   ├── services/      # Business logic services
│   ├── stores/        # Svelte stores (using runes)
│   ├── types.ts       # TypeScript type definitions
│   └── utils.ts       # Utility functions
├── routes/            # SvelteKit routes
└── app.css           # Global styles

src-tauri/
├── src/
│   ├── commands/     # Tauri commands
│   ├── core/         # Core utilities
│   ├── events/       # Event handling
│   ├── models/       # Data models
│   └── services/     # Backend services
└── tauri.conf.json   # Tauri configuration
```

## Coding Conventions

### Svelte 5 Runes

Always use Svelte 5 runes API:

```svelte
<script lang="ts">
  // ✅ Use runes
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  $effect(() => {
    console.log('Count changed:', count);
  });
  
  // ✅ Props with runes
  let { data, selected }: Props = $props();
  
  // ❌ Don't use legacy reactive declarations
  // $: doubled = count * 2;  // Old syntax
</script>
```

### Component Structure

```svelte
<script lang="ts">
  // 1. Imports
  import { SomeComponent } from './SomeComponent.svelte';
  
  // 2. Types
  type MyProps = { /* ... */ };
  
  // 3. Props
  let { prop1, prop2 }: MyProps = $props();
  
  // 4. State
  let localState = $state('');
  
  // 5. Derived values
  let computed = $derived(/* ... */);
  
  // 6. Effects
  $effect(() => { /* ... */ });
  
  // 7. Functions
  function handleClick() { /* ... */ }
</script>

<!-- Template -->
<div class="...">
  <!-- ... -->
</div>

<style>
  /* Scoped styles */
</style>
```

### Node Components

When creating or modifying node components:

1. Follow the pattern in existing nodes (see `src/lib/components/nodes/`)
2. Use `NodeWrapper` for consistent styling
3. Define proper TypeScript interfaces in `src/lib/types.ts`
4. Register nodes in `src/lib/components/nodes/index.ts`
5. Update the node registry in `src/lib/components/nodes/registry.ts`

Example node structure:
```svelte
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { MyNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type MyNodeType = Node<MyNodeData, 'mynode'>;
  let { data, selected, id }: NodeProps<MyNodeType> = $props();

  function updateField(field: keyof MyNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="mynode">
  {#snippet header()}
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  <!-- Node content -->
</NodeWrapper>
```

### TypeScript

- Use strict types
- Define interfaces for all data structures
- Use type guards when needed
- Prefer `type` over `interface` for consistency

### Styling

- Use Tailwind CSS classes when possible
- Use scoped `<style>` blocks for component-specific styles
- Follow the dark theme design (dark backgrounds, light text)
- Use CSS variables from `app.css` for consistency

### Map Components

When working with map features, use `svelte-maplibre-gl`:

```svelte
<script lang="ts">
  import { MapLibre, Marker, NavigationControl } from 'svelte-maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
</script>

<MapLibre
  class="map-container"
  style="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
  zoom={12}
  center={{ lng: -74.006, lat: 40.7128 }}
>
  <NavigationControl />
  <Marker lnglat={{ lng: -74.006, lat: 40.7128 }} draggable />
</MapLibre>
```

## Git Workflow

### Issue-Driven Development

**IMPORTANT**: All changes should be tracked through GitHub Issues.

1. **Before making changes**, create an issue describing:
   - Bug reports: Include steps to reproduce, expected vs actual behavior
   - Features: Include description, acceptance criteria, and design considerations
   - Improvements: Include current state and proposed changes

2. **Issue Templates** to use:
   - `bug`: For bug fixes
   - `feature`: For new features
   - `enhancement`: For improvements to existing features
   - `refactor`: For code refactoring
   - `docs`: For documentation updates

3. **Commit Messages** should reference issues:
   ```
   feat(nodes): add interactive map with MapLibre GL

   - Integrate svelte-maplibre-gl for MapNode
   - Add draggable markers and zoom controls
   - Use CartoDB dark theme style

   Closes #42
   ```

4. **Closing Issues**: Use keywords in commit messages:
   - `Closes #<issue_number>` - Closes the issue when merged
   - `Fixes #<issue_number>` - For bug fixes
   - `Resolves #<issue_number>` - Alternative closing keyword

### Branch Naming

```
<type>/<issue-number>-<short-description>
```

Examples:
- `feature/42-maplibre-integration`
- `bugfix/15-node-collision-fix`
- `refactor/28-store-migration`

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, no code change
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

Scopes:
- `nodes`: Node components
- `canvas`: Canvas functionality
- `stores`: State management
- `api`: Tauri bridge/API
- `ui`: UI components
- `editor`: Editor components

## Common Tasks

### Adding a New Node Type

1. Create the type interface in `src/lib/types.ts`
2. Create the component in the appropriate category folder
3. Export from `src/lib/components/nodes/index.ts`
4. Add to registry in `src/lib/components/nodes/registry.ts`
5. Add default data factory
6. Update node size constraints in `_shared/utils.ts`

### Modifying Tauri Commands

1. Add/modify command in `src-tauri/src/commands/`
2. Update `mod.rs` exports
3. Register in `lib.rs`
4. Update TypeScript types in `src/lib/api/types.ts`
5. Add bridge function in `src/lib/api/`

### Working with Stores

Use Svelte 5 runes for stores:

```typescript
// src/lib/stores/mystore.svelte.ts
class MyStore {
  value = $state(initialValue);
  
  derived = $derived(/* ... */);
  
  updateValue(newValue: string) {
    this.value = newValue;
  }
}

export const myStore = new MyStore();
```

## Testing

- Run type checking: `pnpm check`
- Run dev server: `pnpm dev`
- Build for production: `pnpm build`
- Run Tauri dev: `pnpm tauri dev`

## Resources

- [Svelte 5 Docs](https://svelte.dev/docs)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Tauri 2.0 Docs](https://v2.tauri.app/)
- [xyflow/svelte Docs](https://svelteflow.dev/)
- [svelte-maplibre-gl Docs](https://svelte-maplibre-gl.mierune.dev/)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [mapcn Design Inspiration](https://mapcn.vercel.app/)

## AI Assistant Guidelines

When suggesting code:
1. Always use Svelte 5 runes syntax
2. Include proper TypeScript types
3. Follow the established project patterns
4. Reference existing similar code as examples
5. Suggest creating issues for significant changes
6. Include issue references in commit suggestions
