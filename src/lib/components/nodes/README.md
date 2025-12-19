# Node Components Architecture

This directory contains all canvas node components organized by category with shared utilities and a central registry system.

## 📁 Directory Structure

```
nodes/
├── _shared/                 # Shared utilities and base components
│   ├── index.ts            # Module exports
│   ├── utils.ts            # Utility functions (hexToRgba, getNodeStyles, etc.)
│   ├── styles.css          # Shared CSS classes
│   ├── NodeWrapper.svelte  # Base wrapper component with NodeResizer
│   ├── NodeHeader.svelte   # Reusable header component
│   ├── NodeField.svelte    # Reusable form field component
│   └── NodeHandles.svelte  # Standard handle configuration
│
├── content/                 # Content-focused nodes
│   ├── index.ts
│   ├── NoteNode.svelte     # Markdown notes
│   ├── ImageNode.svelte    # Image display
│   ├── LinkNode.svelte     # Web links
│   ├── CodeNode.svelte     # Code blocks
│   └── IframeNode.svelte   # Embedded content
│
├── entity/                  # Entity/data nodes
│   ├── index.ts
│   ├── PersonNode.svelte   # Person profiles
│   ├── OrganizationNode.svelte
│   └── TimestampNode.svelte
│
├── osint/                   # OSINT/security research nodes
│   ├── index.ts
│   ├── DomainNode.svelte
│   ├── HashNode.svelte
│   ├── CredentialNode.svelte
│   ├── SocialPostNode.svelte
│   ├── RouterNode.svelte
│   └── SnapshotNode.svelte
│
├── utility/                 # Utility/helper nodes
│   ├── index.ts
│   ├── GroupNode.svelte
│   ├── MapNode.svelte
│   ├── LinkListNode.svelte
│   ├── ActionNode.svelte
│   └── AnnotationNode.svelte
│
├── index.ts                 # Main exports
├── registry.ts              # Central node registry
└── README.md               # This file
```

## 🚀 Creating a New Node

### Step 1: Choose the Category

Decide which category your node belongs to:

| Category | Purpose | Examples |
|----------|---------|----------|
| `content/` | Text, media, embedded content | Note, Image, Code, Link |
| `entity/` | People, organizations, time | Person, Organization, Timestamp |
| `osint/` | Security research, intelligence | Domain, Hash, Credential |
| `utility/` | Canvas helpers, grouping | Group, Action, Annotation |

### Step 2: Create the Component File

Create a new `.svelte` file in the appropriate category folder:

```svelte
<!--
  MyCustomNode - [Category] Category
  
  Brief description of what this node does.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { MyCustomNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { MyIcon } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  // Define your node type
  type MyCustomNodeType = Node<MyCustomNodeData, 'myCustom'>;

  // Use $props() for Svelte 5
  let { data, selected, id }: NodeProps<MyCustomNodeType> = $props();

  // Your node logic here...
  function updateField(field: keyof MyCustomNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="myCustom">
  {#snippet header()}
    <span class="node-icon"><MyIcon size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <!-- Optional action buttons -->
  {/snippet}
  
  <!-- Your node content -->
  <NodeField 
    label="Field Name"
    value={data.fieldValue || ''}
    placeholder="Enter value..."
    oninput={(v) => updateField('fieldValue', v)}
  />
</NodeWrapper>

<style>
  /* Node-specific styles only */
</style>
```

### Step 3: Define the Type

Add your node's data type in `$lib/types.ts`:

```typescript
export interface MyCustomNodeData extends BaseNodeData {
  title: string;
  fieldValue?: string;
  // ... other fields
}
```

### Step 4: Register the Node

Add your node to `registry.ts`:

```typescript
// 1. Import the component
import MyCustomNode from './category/MyCustomNode.svelte';

// 2. Add to NODE_REGISTRY
myCustom: {
  type: 'myCustom',
  label: 'My Custom Node',
  description: 'Brief description',
  category: 'content', // or entity, osint, utility
  icon: MyIcon,
  component: MyCustomNode,
  defaultData: {
    title: 'New Custom Node',
    fieldValue: '',
  },
},

// 3. Add to nodeTypes map
myCustom: MyCustomNode,
```

### Step 5: Export from Category Index

Add the export to your category's `index.ts`:

```typescript
export { default as MyCustomNode } from './MyCustomNode.svelte';
```

## 🧩 Using Shared Components

### NodeWrapper

The base wrapper provides NodeResizer, selection styling, and handles:

```svelte
<NodeWrapper {data} {selected} {id} nodeType="myNode">
  {#snippet header()}<!-- Header content -->{/snippet}
  {#snippet headerActions()}<!-- Action buttons -->{/snippet}
  <!-- Body content -->
</NodeWrapper>
```

**Props:**
- `data` - Node data from props
- `selected` - Selection state
- `id` - Node ID
- `nodeType` - Type identifier for dimensions/styling
- `class` - Additional CSS classes

### NodeField

Reusable form input with label:

```svelte
<NodeField 
  label="Email"
  type="email"
  value={data.email || ''}
  placeholder="user@example.com"
  oninput={(v) => updateField('email', v)}
/>
```

**Props:**
- `label` - Field label
- `type` - Input type (text, url, email, date, time, number)
- `value` - Current value
- `placeholder` - Placeholder text
- `oninput` - Handler receiving the new value

### NodeHeader

Standalone header component:

```svelte
<NodeHeader title="My Node" icon={MyIcon}>
  {#snippet actions()}
    <button>Action</button>
  {/snippet}
</NodeHeader>
```

### NodeHandles

Standard 4-handle configuration:

```svelte
<NodeHandles showLeft showRight showTop={false} showBottom={false} />
```

## 🎨 Utility Functions

From `_shared/utils.ts`:

```typescript
import { hexToRgba, getNodeStyles, getNodeDimensions, darkenColor } from './_shared';

// Convert hex to RGBA
const bgColor = hexToRgba('#3b82f6', 0.1);

// Get computed styles for a node
const styles = getNodeStyles(data);

// Get dimensions for a node type
const dims = getNodeDimensions('note');
```

## 📝 Styling Guidelines

1. **Use shared styles** from `_shared/styles.css` via CSS classes:
   - `.mosaic-node` - Base node styling
   - `.node-header` - Header layout
   - `.node-content` - Content area
   - `.node-field` - Form fields
   - `.node-action-btn` - Action buttons
   - `.node-tag` - Tag/badge styling

2. **Node-specific styles** go in the component's `<style>` block

3. **Color scheme**: Nodes get their color from `data.color`, use `hexToRgba()` for opacity

4. **Handle `nodrag` and `nowheel`** classes on interactive elements:
   ```svelte
   <input class="nodrag" />
   <textarea class="nodrag nowheel" />
   ```

## 🔧 Best Practices

1. **Use `$effect()` for syncing** local state with node data
2. **Use `$derived()` for computed** values from data
3. **Call `workspace.updateNodeData()`** to persist changes
4. **Import icons from** `lucide-svelte`
5. **Keep components focused** - complex logic goes in services
6. **Test with different** node sizes and colors

## 📚 Registry API

```typescript
import { 
  nodeTypes,           // SvelteFlow node types map
  NODE_REGISTRY,       // Full node definitions
  getNodeDefinition,   // Get single node def
  getNodesByCategory,  // Filter by category
  getDefaultNodeData,  // Get default data for type
  NODE_CATEGORIES,     // Category metadata
} from './registry';

// Get all OSINT nodes
const osintNodes = getNodesByCategory('osint');

// Get default data for a new note
const noteDefaults = getDefaultNodeData('note');
```
