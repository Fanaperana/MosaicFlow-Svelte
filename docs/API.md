# MosaicFlow API Documentation

This document describes the frontend TypeScript APIs for MosaicFlow. These services interact with the Rust backend via Tauri commands and handle real-time file persistence.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Vault Service](#vault-service)
3. [Workspace Store](#workspace-store)
4. [Node File Service](#node-file-service)
5. [Edge File Service](#edge-file-service)
6. [File Operations](#file-operations)
7. [Data Types](#data-types)
8. [File Structure](#file-structure)

---

## Architecture Overview

MosaicFlow uses a real-time persistence model - all changes are automatically saved without requiring a manual "Save" action.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Svelte)                         │
├─────────────────────────────────────────────────────────────────┤
│  workspace.svelte.ts   │  Node/Edge operations, state management │
│  nodeFileService.ts    │  Real-time node file I/O (debounced)    │
│  edgeFileService.ts    │  Real-time edge file I/O (debounced)    │
│  vaultService.ts       │  Vault/Canvas CRUD via Tauri commands   │
│  fileOperations.ts     │  Workspace loading, export functions     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Tauri invoke / Plugin FS
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Rust)                            │
│  commands/             │  Tauri command handlers                 │
│  services/             │  Business logic                         │
│  models/               │  Data structures                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Vault Service

**File:** `src/lib/services/vaultService.ts`

Handles vault and canvas CRUD operations via Rust backend commands.

### Types

```typescript
interface VaultInfo {
  id: string;           // UUID v4
  path: string;         // Absolute filesystem path
  name: string;         // Display name
  description: string;  // Optional description
  created_at: string;   // ISO 8601 timestamp
  updated_at: string;   // ISO 8601 timestamp
  canvas_count: number; // Number of canvases
}

interface CanvasInfo {
  id: string;           // UUID v4
  vault_id: string;     // Parent vault UUID
  name: string;         // Display name
  description: string;  // Optional description
  path: string;         // Absolute filesystem path
  created_at: string;   // ISO 8601 timestamp
  updated_at: string;   // ISO 8601 timestamp
  tags: string[];       // Organization tags
}

interface AppConfig {
  current_vault_path: string | null;
  recent_vaults: RecentVault[];
}

interface RecentVault {
  name: string;
  path: string;
  last_opened: string;  // ISO 8601 timestamp
}
```

### Functions

#### `loadAppConfig(): Promise<AppConfig>`
Load application configuration (recent vaults, last opened vault).

#### `saveAppConfig(config: AppConfig): Promise<boolean>`
Save application configuration.

#### `createVault(path: string, name: string): Promise<VaultOperationResult>`
Create a new vault at the specified path.
- Creates vault folder structure
- Initializes `vault.json` metadata
- Creates default "Untitled" canvas

#### `openVault(path: string): Promise<VaultInfo | null>`
Open an existing vault by path.
- Validates vault structure
- Returns vault metadata

#### `isValidVault(path: string): Promise<boolean>`
Check if a path contains a valid vault.

#### `getVaultInfo(path: string): Promise<VaultInfo | null>`
Get vault metadata without fully opening it.

#### `renameVault(vaultPath: string, newName: string): Promise<VaultInfo | null>`
Rename a vault.

#### `listCanvases(vaultPath: string): Promise<CanvasInfo[]>`
List all canvases in a vault.

#### `createCanvas(vaultPath: string, vaultId: string, name: string, description?: string): Promise<CanvasInfo | null>`
Create a new canvas in the vault.
- Creates canvas folder structure (`nodes/`, `edges/`, `.mosaic/`)
- Initializes metadata files

#### `renameCanvas(canvasPath: string, newName: string): Promise<CanvasInfo | null>`
Rename a canvas.

#### `deleteCanvas(canvasPath: string): Promise<boolean>`
Delete a canvas and all its contents.

---

## Workspace Store

**File:** `src/lib/stores/workspace.svelte.ts`

Central state management for the current canvas workspace. Uses Svelte 5 runes for reactivity.

### State Properties

```typescript
// Core data
nodes: MosaicNode[]      // All nodes in workspace
edges: MosaicEdge[]      // All edges in workspace

// Metadata
name: string             // Workspace display name
description: string      // Optional description
createdAt: string        // ISO 8601 timestamp
updatedAt: string        // ISO 8601 timestamp
workspacePath: string | null  // Current workspace path

// Viewport
viewport: { x: number; y: number; zoom: number }

// Settings
settings: WorkspaceSettings

// UI State
selectedNodeIds: string[]
selectedEdgeIds: string[]
propertiesPanelOpen: boolean
canvasMode: 'select' | 'drag'
```

### Node Operations

#### `createNode(type: NodeType, position: { x: number; y: number }, data?: Partial<MosaicNodeData>): MosaicNode`
Create a new node and save it to files.

```typescript
// Example: Create a note node
const node = workspace.createNode('note', { x: 100, y: 200 }, {
  title: 'My Note',
  content: 'Hello world'
});
```

#### `updateNode(id: string, updates: Partial<MosaicNode>): void`
Update node properties (position, size, etc.). Automatically saves to file.

#### `updateNodeData(id: string, dataUpdates: Partial<MosaicNodeData>): void`
Update node data (content, title, etc.). Automatically saves to file.

#### `deleteNode(id: string): void`
Delete a node and its connected edges. Removes files.

#### `deleteNodes(ids: string[]): void`
Delete multiple nodes. Removes files.

### Edge Operations

#### `createEdge(source: string, target: string, label?: string, sourceHandle?: string | null, targetHandle?: string | null): MosaicEdge`
Create a new edge connecting two nodes. Automatically saves to file.

#### `updateEdge(id: string, updates: Partial<MosaicEdge>): void`
Update edge properties. Automatically computes derived styles and saves.

#### `deleteEdge(id: string): void`
Delete an edge. Removes file.

### Group Operations

#### `groupSelectedNodes(): MosaicNode | null`
Group selected nodes into a group node.

#### `ungroupNode(groupId: string): void`
Ungroup a group node, restoring child nodes.

### Selection Management

#### `setSelectedNodes(ids: string[]): void`
Set selected nodes. Opens properties panel for single selection.

#### `setSelectedEdges(ids: string[]): void`
Set selected edges.

### Workspace Management

#### `initFileServices(path: string): void`
Initialize file services for a workspace path. Must be called before save operations.

#### `saveWorkspaceManifest(): Promise<void>`
Save the workspace manifest (`workspace.json`). Called automatically on node/edge changes.

#### `clear(): void`
Clear the workspace and reset all state.

#### `fitView(padding?: number): void`
Fit viewport to show all nodes.

---

## Node File Service

**File:** `src/lib/services/nodeFileService.ts`

Handles real-time file persistence for nodes. Each node is stored in its own folder.

### Folder Structure

```
nodes/
└── {node-id}/
    └── data/
        ├── content        # Primary content (text, URL, etc.)
        └── properties.json # Position, size, styling, metadata
```

### Functions

#### `initNodeFileService(path: string): void`
Initialize the service with workspace path.

#### `saveNodeContent(node: MosaicNode): void`
Save node content to file (debounced, 300ms).
- Called automatically when node data changes

#### `saveNodeProperties(node: MosaicNode): void`
Save node properties to file (debounced, 100ms).
- Called automatically when node position/size changes

#### `saveNodeImmediate(node: MosaicNode): Promise<void>`
Save node immediately without debouncing.
- Used for new node creation

#### `deleteNodeFolder(nodeId: string): Promise<void>`
Delete a node's folder and all its files.

#### `loadNode(nodeId: string, type: NodeType): Promise<MosaicNode | null>`
Load a single node from files.

#### `loadAllNodes(nodesManifest: Record<string, { type: NodeType }>): Promise<MosaicNode[]>`
Load all nodes from the nodes folder.

#### `resetNodeFileService(): void`
Reset the service state. Flushes pending saves.

### Content Mapping by Node Type

| Node Type    | Content File Contains                          |
|--------------|-----------------------------------------------|
| note         | `data.content` (markdown text)                |
| code         | `data.code` (source code)                     |
| image        | `data.imageUrl` or `data.imagePath`           |
| link         | `data.url`                                    |
| iframe       | `data.url`                                    |
| timestamp    | `data.customTimestamp` (empty = live time)    |
| person       | `data.name`                                   |
| organization | `data.name`                                   |
| domain       | `data.domain`                                 |
| hash         | `data.hash`                                   |
| credential   | `data.username`                               |
| socialPost   | `data.content`                                |
| snapshot     | `data.imageUrl` or `data.sourceUrl`           |
| group        | `data.label`                                  |
| map          | `latitude,longitude` (comma-separated)        |
| router       | `data.name`                                   |
| linkList     | Lines of `title|url`                          |
| action       | `data.action`                                 |
| annotation   | `data.label`                                  |

---

## Edge File Service

**File:** `src/lib/services/edgeFileService.ts`

Handles real-time file persistence for edges.

### Folder Structure

```
edges/
└── {edge-id}/
    └── joined.json    # Edge data (source, target, styling)
```

### Functions

#### `initEdgeFileService(path: string): void`
Initialize the service with workspace path.

#### `saveEdge(edge: MosaicEdge): void`
Save edge to file (debounced, 100ms).

#### `saveEdgeImmediate(edge: MosaicEdge): Promise<void>`
Save edge immediately without debouncing.

#### `deleteEdgeFolder(edgeId: string): Promise<void>`
Delete an edge's folder.

#### `loadEdge(edgeId: string): Promise<MosaicEdge | null>`
Load a single edge from file.

#### `loadAllEdges(): Promise<MosaicEdge[]>`
Load all edges from the edges folder.

#### `resetEdgeFileService(): void`
Reset the service state. Flushes pending saves.

### Edge Data Structure

```typescript
{
  source: string;       // Source node ID
  target: string;       // Target node ID
  sourceHandle?: string; // Source handle ID
  targetHandle?: string; // Target handle ID
  label?: string;       // Edge label text
  type: string;         // Edge type (default, step, smoothstep, etc.)
  animated: boolean;    // Animation enabled
  data: {
    color?: string;           // Stroke color
    strokeWidth?: number;     // Stroke width (px)
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    labelColor?: string;      // Label text color
    labelBgColor?: string;    // Label background color
  }
}
```

---

## File Operations

**File:** `src/lib/services/fileOperations.ts`

High-level workspace operations.

### Functions

#### `loadWorkspace(path: string): Promise<boolean>`
Load a workspace from disk.
- Supports both v1 (legacy) and v2 (individual files) formats
- Automatically migrates v1 to v2 format
- Initializes file services
- Loads nodes and edges from individual files

#### `createWorkspace(path: string, name: string): Promise<boolean>`
Create a new workspace with v2 folder structure.

#### `openWorkspaceDialog(): Promise<string | null>`
Open a folder picker dialog to select a workspace.

#### `exportAsZip(): Promise<boolean>`
Export workspace as JSON file (browser download).

#### `exportAsPng(): Promise<boolean>`
Export canvas as PNG image.

---

## Data Types

**File:** `src/lib/types.ts`

### Node Types

```typescript
type NodeType = 
  | 'note'
  | 'image'
  | 'link'
  | 'code'
  | 'timestamp'
  | 'person'
  | 'organization'
  | 'domain'
  | 'hash'
  | 'credential'
  | 'socialPost'
  | 'group'
  | 'map'
  | 'router'
  | 'linkList'
  | 'snapshot'
  | 'action'
  | 'iframe'
  | 'annotation';
```

### MosaicNode

```typescript
interface MosaicNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: MosaicNodeData;
  width?: number;
  height?: number;
  zIndex?: number;
  parentId?: string;    // For grouped nodes
  extent?: 'parent';    // Constrain to parent bounds
}
```

### MosaicEdge

```typescript
interface MosaicEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
  animated?: boolean;
  style?: string;
  labelStyle?: string;
  labelBgStyle?: string;
  data?: EdgeData;
}
```

---

## File Structure

### Vault Structure

```
MyVault/
├── vault.json              # Vault metadata (id, name, timestamps)
├── .mosaicflow/            # Vault-level config (hidden)
└── canvases/
    └── MyCanvas/
        ├── workspace.json  # Manifest (node/edge IDs, settings)
        ├── .mosaic/        # Canvas metadata (hidden)
        │   ├── meta.json   # Canvas UUID, name, timestamps
        │   └── state.json  # Viewport, selection state
        ├── nodes/          # Individual node folders
        │   └── {uuid}/
        │       └── data/
        │           ├── content         # Primary content
        │           └── properties.json # Position, size, styling
        ├── edges/          # Individual edge folders
        │   └── {uuid}/
        │       └── joined.json
        ├── images/         # Attached images
        └── attachments/    # Other attachments
```

### workspace.json (Manifest)

```json
{
  "metadata": {
    "name": "My Canvas",
    "description": "",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "version": "2.0.0",
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "settings": { ... }
  },
  "nodes": {
    "uuid-1": { "id": "uuid-1", "type": "note" },
    "uuid-2": { "id": "uuid-2", "type": "timestamp" }
  },
  "edges": {
    "uuid-3": { "id": "uuid-3" }
  }
}
```

---

## Usage Examples

### Creating a New Note

```typescript
import { workspace } from '$lib/stores/workspace.svelte';

const note = workspace.createNode('note', { x: 100, y: 100 }, {
  title: 'Meeting Notes',
  content: '# Agenda\n\n- Item 1\n- Item 2'
});
```

### Connecting Two Nodes

```typescript
const edge = workspace.createEdge(sourceNodeId, targetNodeId, 'Connected');
```

### Updating Node Content

```typescript
workspace.updateNodeData(nodeId, {
  content: 'Updated content here'
});
```

### Loading a Workspace

```typescript
import { loadWorkspace } from '$lib/services/fileOperations';

const success = await loadWorkspace('/path/to/canvas');
if (success) {
  console.log('Loaded', workspace.nodes.length, 'nodes');
}
```

---

## Best Practices

1. **Always initialize file services** before performing save operations:
   ```typescript
   workspace.initFileServices(canvasPath);
   ```

2. **Don't call save functions manually** - the workspace store handles all saves automatically.

3. **Use `saveNodeImmediate` and `saveEdgeImmediate`** only for newly created nodes/edges.

4. **Check `workspacePath`** before operations that require file access.

5. **Handle errors gracefully** - all file operations can fail due to permissions or disk space.
