<script lang="ts">
  import {
    SvelteFlow,
    SvelteFlowProvider,
    Controls,
    MiniMap,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
    ConnectionLineType,
    SelectionMode,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { untrack } from 'svelte';

  import { workspace } from '$lib/stores/workspace.svelte';
  import { nodeRegistry } from '$lib/kernel/registries/node-registry';
  import { GlowEdge } from '$lib/components/edges';
  import type { NodeType, MosaicNode, MosaicEdge } from '$lib/types';
  import { resolveCollisions, findNonOverlappingPosition } from '$lib/utils/resolve-collisions';
  import { calculateSnapGuides, calculateSelectionSnapGuides, calculateSnapOffset, type SnapGuide } from '$lib/utils/snap-guides';
  import { SpatialIndex } from '$lib/utils/spatial-index';
  import SnapGuides from '$lib/components/SnapGuides.svelte';
  import NodeListSidebar from '$lib/components/NodeListSidebar.svelte';
  import FlowHelper from '$lib/components/FlowHelper.svelte';
  import CanvasFilterBar from '$lib/components/CanvasFilterBar.svelte';
  import NodeInsertMenu from '$lib/components/NodeInsertMenu.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { keybindings } from '$lib/kernel/keybindings.svelte';

  const BACKGROUND_VARIANTS = {
    dots: BackgroundVariant.Dots,
    lines: BackgroundVariant.Lines,
    cross: BackgroundVariant.Cross,
  } as const;
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  interface Props {
    showNodeList?: boolean;
    onToggleNodeList?: () => void;
  }

  let { showNodeList = false, onToggleNodeList }: Props = $props();

  import { 
    MousePointer2, 
    Hand, 
    Plus, 
    Group,
    Ungroup,
    Copy,
    Clipboard,
    Trash2,
    ZoomIn,
    ZoomOut,
    Maximize,
  } from 'lucide-svelte';

  // Custom edge types with glow effect on selection
  // All edge types use GlowEdge which renders the path based on data.pathType
  const edgeTypes = {
    default: GlowEdge,
    straight: GlowEdge,
    step: GlowEdge,
    smoothstep: GlowEdge,
    bezier: GlowEdge,
  };

  // Reactive node types from the plugin registry
  let registryVersion = $state(0);
  $effect(() => {
    return nodeRegistry.subscribe(() => { registryVersion++; });
  });
  const nodeTypes = $derived.by(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    registryVersion; // trigger reactivity
    return nodeRegistry.getNodeTypes();
  });

  // Two-way binding with workspace state - using $state.raw for better performance
  let nodes = $state.raw(workspace.nodes as Node[]);
  let edges = $state.raw(workspace.edges as Edge[]);
  
  // Viewport state for coordinate conversion
  let viewport = $state({ x: 0, y: 0, zoom: 1 });
  let flowContainer: HTMLDivElement | undefined;

  // Round viewport translate coordinates to integers.
  // CSS transform: translate(Xpx, Ypx) with fractional values causes
  // subpixel rendering — the browser rasterizes at 1x then scales the bitmap,
  // making text, images and borders look blurry. Rounding eliminates *one*
  // major source of that blur (the translate part).
  $effect(() => {
    const rx = Math.round(viewport.x);
    const ry = Math.round(viewport.y);
    if (viewport.x !== rx || viewport.y !== ry) {
      viewport = { x: rx, y: ry, zoom: viewport.zoom };
    }
  });
  
  // Helper function to convert screen coordinates to flow coordinates
  function screenToFlowPosition(screenPos: { x: number; y: number }) {
    if (!flowContainer) {
      return { x: screenPos.x, y: screenPos.y };
    }
    const bounds = flowContainer.getBoundingClientRect();
    return {
      x: (screenPos.x - bounds.left - viewport.x) / viewport.zoom,
      y: (screenPos.y - bounds.top - viewport.y) / viewport.zoom,
    };
  }
  
  // Context menu state
  let contextMenuPosition = $state({ x: 0, y: 0 });
  let contextMenuOpen = $state(false);
  let contextMenuOnNode = $state(false); // Track if context menu was opened on a node

  // Block picker: `menu` is where it opens, `at` is where the node goes (screen coords).
  let insertMenu = $state<{ menu: { x: number; y: number }; at: { x: number; y: number }; centered: boolean } | null>(null);
  let lastPointer: { x: number; y: number } | null = null;

  function openInsertMenu(menu: { x: number; y: number }, at = menu, centered = false) {
    insertMenu = { menu, at, centered };
  }

  function openInsertMenuAtPointer() {
    const bounds = flowContainer?.getBoundingClientRect();
    const inside = lastPointer && bounds &&
      lastPointer.x >= bounds.left && lastPointer.x <= bounds.right &&
      lastPointer.y >= bounds.top && lastPointer.y <= bounds.bottom;
    if (inside) openInsertMenu(lastPointer!);
    else if (bounds) {
      const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      openInsertMenu({ x: center.x - 160, y: center.y - 120 }, center, true);
    }
  }

  function insertFromMenu(type: string) {
    if (!insertMenu) return;
    const { at, centered } = insertMenu;
    insertMenu = null;
    const size = getNodeSizeForType(type);
    const point = screenToFlowPosition(at);
    const start = centered ? { x: point.x - size.width / 2, y: point.y - size.height / 2 } : point;
    const newNode = workspace.createNode(type, findNonOverlappingPosition(start, size, nodes, 20));
    workspace.setSelectedNodes([newNode.id]);
  }

  function handlePaneDoubleClick(e: MouseEvent) {
    if (!settings.current.canvas.doubleClickInsert) return;
    const target = e.target as HTMLElement;
    if (!target.closest('.svelte-flow__pane') || target.closest('.svelte-flow__node, .svelte-flow__edge')) return;
    openInsertMenu({ x: e.clientX, y: e.clientY });
  }

  $effect(() => {
    const onRequest = (e: Event) => {
      const anchor = (e as CustomEvent<{ x: number; y: number }>).detail;
      const bounds = flowContainer?.getBoundingClientRect();
      if (!bounds) return;
      openInsertMenu(anchor, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }, true);
    };
    window.addEventListener('mosaicflow:insertMenu', onRequest);
    const onInsertAtPointer = () => { if (!insertMenu) openInsertMenuAtPointer(); };
    window.addEventListener('mosaicflow:insertAtPointer', onInsertAtPointer);
    return () => {
      window.removeEventListener('mosaicflow:insertMenu', onRequest);
      window.removeEventListener('mosaicflow:insertAtPointer', onInsertAtPointer);
    };
  });
  
  // Snap guides state
  let snapGuides = $state<SnapGuide[]>([]);
  const SNAP_THRESHOLD = 8; // Distance in pixels to show guides
  const SNAP_DISTANCE = 12; // Screen pixels within which Shift-drag snaps to a guide
  
  // Spatial index for efficient node culling at extreme zoom
  let spatialIndex = $state(new SpatialIndex());
  let rebuildIndexScheduled = $state(false);
  
  // LOD (Level of Detail) state
  let isExporting = $state(false);
  
  // Determine LOD based on zoom level (but always detailed during export)
  let currentLOD = $derived<'detailed' | 'medium' | 'simplified'>(
    isExporting ? 'detailed' :
    viewport.zoom > 0.25 ? 'detailed' :
    viewport.zoom > 0.08 ? 'medium' :
    'simplified'
  );
  
  // Listen for export start/end events
  $effect(() => {
    const handleExportStart = () => {
      console.log('Export started - switching to detailed LOD');
      isExporting = true;
    };
    const handleExportEnd = () => {
      console.log('Export ended - resuming normal LOD');
      isExporting = false;
    };
    
    window.addEventListener('mosaicflow:exportStart', handleExportStart);
    window.addEventListener('mosaicflow:exportEnd', handleExportEnd);
    
    return () => {
      window.removeEventListener('mosaicflow:exportStart', handleExportStart);
      window.removeEventListener('mosaicflow:exportEnd', handleExportEnd);
    };
  });
  
  // Rebuild spatial index when nodes change significantly
  $effect(() => {
    if (nodes.length > 50 && !rebuildIndexScheduled) {
      rebuildIndexScheduled = true;
      queueMicrotask(() => {
        spatialIndex.rebuild(workspace.nodes);
        rebuildIndexScheduled = false;
      });
    }
  });
  
  // Edge drop menu state - for creating nodes when dropping connection on empty canvas
  let edgeDropMenuOpen = $state(false);
  let edgeDropMenuPosition = $state({ x: 0, y: 0 });
  let pendingConnectionSource = $state<{ nodeId: string; handleId: string | null; handleType: 'source' | 'target' } | null>(null);
  
  // Track previous node dimensions for detecting resize changes
  let prevNodeDimensions = new Map<string, { width?: number; height?: number }>();
  // Track if history has been saved for current resize operation
  let resizeHistorySaved = $state(false);
  
  // Sync workspace changes to local state
  $effect(() => {
    nodes = workspace.nodes as Node[];
  });
  
  $effect(() => {
    // Ensure all edges have the 'default' type for custom GlowEdge rendering
    const workspaceEdges = workspace.edges;
    const needsTypeUpdate = workspaceEdges.some(edge => !edge.type);
    if (needsTypeUpdate) {
      edges = workspaceEdges.map(edge => ({
        ...edge,
        type: edge.type || 'default'
      })) as Edge[];
    } else {
      edges = workspaceEdges as Edge[];
    }
  });
  
  // Sync local state changes back to workspace and detect dimension changes
  $effect(() => {
    if (nodes !== workspace.nodes) {
      // Detect nodes with changed dimensions (from resize)
      for (const node of nodes) {
        const prev = prevNodeDimensions.get(node.id);
        if (prev && (prev.width !== node.width || prev.height !== node.height)) {
          // Save history before first resize change
          if (!resizeHistorySaved) {
            workspace.saveToHistory();
            resizeHistorySaved = true;
          }
          // Dimension changed - save to file
          workspace.updateNode(node.id, {
            width: node.width,
            height: node.height,
          });
        }
        // Update tracking
        prevNodeDimensions.set(node.id, { width: node.width, height: node.height });
      }
      
      workspace.nodes = nodes as MosaicNode[];
    }
  });
  
  $effect(() => {
    if (edges !== workspace.edges) {
      workspace.edges = edges as MosaicEdge[];
    }
  });
  
  // Sync local viewport to workspace viewport so other components can use it
  $effect(() => {
    workspace.setViewport(viewport);
  });
  
  // Handle edge connection
  // Blocks self-loops and exact duplicates while the user is still dragging.
  function isValidConnection(c: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) {
    return c.source !== c.target && !workspace.hasEdge(c.source, c.target, c.sourceHandle, c.targetHandle);
  }
  function handleConnect(params: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) {
    if (params.source && params.target) {
      workspace.createEdge(params.source, params.target, undefined, params.sourceHandle, params.targetHandle);
    }
  }

  // Handle connection start - track the source for edge drop
  function handleConnectStart(event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: 'source' | 'target' | null }) {
    if (params.nodeId && params.handleType) {
      pendingConnectionSource = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        handleType: params.handleType,
      };
    }
  }

  // Handle connection end - show menu if dropped on empty canvas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleConnectEnd(event: MouseEvent | TouchEvent, connectionState: any) {
    // If connection was successful (connected to a node), do nothing
    if (connectionState.isValid) {
      pendingConnectionSource = null;
      return;
    }
    
    // If dropped on empty canvas (no target node), show the node creation menu
    // connectionState.toNode is the target node (null if dropped on empty canvas)
    if (pendingConnectionSource && !connectionState.toNode) {
      const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX ?? 0;
      const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY ?? 0;
      
      edgeDropMenuPosition = { x: clientX, y: clientY };
      edgeDropMenuOpen = true;
    } else {
      pendingConnectionSource = null;
    }
  }

  // Create node from edge drop and connect it
  function createNodeFromEdgeDrop(type: NodeType) {
    if (!pendingConnectionSource) return;
    const { nodeId, handleId, handleType } = pendingConnectionSource;

    const flowPosition = screenToFlowPosition(edgeDropMenuPosition);
    const { width, height } = getNodeSizeForType(type);

    // The new node's handle faces the handle the drag started from.
    const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const;
    const startSide = handleId?.split('-')[0];
    const fromSide = startSide && startSide in OPPOSITE
      ? startSide as keyof typeof OPPOSITE
      : handleType === 'source' ? 'right' : 'left';
    const newSide = OPPOSITE[fromSide];
    const newHandleId = `${newSide}-${handleType === 'source' ? 'target' : 'source'}`;

    // Place the new node so its connecting handle sits at the release point.
    const position = {
      left: { x: flowPosition.x, y: flowPosition.y - height / 2 },
      right: { x: flowPosition.x - width, y: flowPosition.y - height / 2 },
      top: { x: flowPosition.x - width / 2, y: flowPosition.y },
      bottom: { x: flowPosition.x - width / 2, y: flowPosition.y - height },
    }[newSide];

    const newNode = workspace.createNode(type, findNonOverlappingPosition(position, { width, height }, nodes, 20));

    if (handleType === 'source') {
      workspace.createEdge(nodeId, newNode.id, undefined, handleId, newHandleId);
    } else {
      workspace.createEdge(newNode.id, nodeId, undefined, newHandleId, handleId);
    }

    workspace.setSelectedNodes([newNode.id]);

    pendingConnectionSource = null;
    edgeDropMenuOpen = false;
  }

  // Selection lives in node flags (shared with the store); this only post-processes and syncs UI.
  // Called from inside xyflow's effect, so it must not track the state it reads.
  function handleSelectionChange(params: { nodes: Node[]; edges: Edge[] }) {
    untrack(() => applySelectionChange(params.edges));
  }

  function applySelectionChange(selectedEdges: Edge[]) {
    const edgeIds = selectedEdges.map(e => e.id);
    if (edgeIds.join() !== workspace.selectedEdgeIds.join()) {
      workspace.setSelectedEdges(edgeIds);
    }

    const selectedNodes = nodes.filter(n => n.selected);
    let keep = selectedNodes;
    
    // Fix for issue: clicking on a single node shouldn't accidentally select child nodes inside groups
    // This can happen due to overlapping bounds or z-index issues with subflows
    if (selectedNodes.length > 1) {
      const hasRootNodes = selectedNodes.some(n => !n.parentId);
      const hasChildNodes = selectedNodes.some(n => n.parentId);
      
      if (hasRootNodes && hasChildNodes) {
        const selectedGroupIds = new Set(selectedNodes.filter(n => nodeRegistry.isContainer(n.type)).map(n => n.id));
        const orphanChildren = selectedNodes.filter(n => n.parentId && !selectedGroupIds.has(n.parentId));
        
        if (orphanChildren.length > 0 && !selectedNodes.some(n => nodeRegistry.isContainer(n.type))) {
          keep = selectedNodes.filter(n => !n.parentId);
        }
      }
    }
    
    if (keep.length !== selectedNodes.length) {
      workspace.setSelectedNodes(keep.map(n => n.id));
    }
  }

  // xyflow reports selection before the store has synced, so drive the panel from the store itself.
  const selectionKey = $derived(workspace.selectedNodeIds.join(','));
  $effect(() => {
    selectionKey;
    untrack(() => workspace.syncPropertiesPanel());
  });

  // Handle drop for adding new nodes
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Check if a node is inside a group's bounds
   */
  function isNodeInsideGroup(node: Node, group: Node): boolean {
    const nodeWidth = node.measured?.width ?? node.width ?? 200;
    const nodeHeight = node.measured?.height ?? node.height ?? 100;
    const groupWidth = group.measured?.width ?? group.width ?? 400;
    const groupHeight = group.measured?.height ?? group.height ?? 300;
    
    // Node center point
    const nodeCenterX = node.position.x + nodeWidth / 2;
    const nodeCenterY = node.position.y + nodeHeight / 2;
    
    // Check if center is inside group
    return (
      nodeCenterX > group.position.x &&
      nodeCenterX < group.position.x + groupWidth &&
      nodeCenterY > group.position.y &&
      nodeCenterY < group.position.y + groupHeight
    );
  }

  /**
   * Add a node as a child of a group (subflow)
   */
  function addNodeToGroup(nodeId: string, groupId: string) {
    const node = workspace.getNode(nodeId);
    const group = workspace.getNode(groupId);
    if (!node || !group) return;
    
    const pad = 20;
    const nodeW = node.measured?.width ?? node.width ?? 200;
    const nodeH = node.measured?.height ?? node.height ?? 100;
    const groupW = group.measured?.width ?? group.width ?? 400;
    const groupH = group.measured?.height ?? group.height ?? 300;
    const rel = { x: node.position.x - group.position.x, y: node.position.y - group.position.y };

    // Grow the group so the new child sits fully inside it.
    const shiftX = Math.min(0, rel.x - pad);
    const shiftY = Math.min(0, rel.y - pad);
    const width = Math.max(groupW, rel.x + nodeW + pad) - shiftX;
    const height = Math.max(groupH, rel.y + nodeH + pad) - shiftY;
    if (shiftX < 0 || shiftY < 0 || width !== groupW || height !== groupH) {
      workspace.updateNode(groupId, {
        position: { x: group.position.x + shiftX, y: group.position.y + shiftY },
        width,
        height,
      });
      if (shiftX < 0 || shiftY < 0) {
        for (const child of workspace.getChildNodes(groupId)) {
          workspace.updateNode(child.id, {
            position: { x: child.position.x - shiftX, y: child.position.y - shiftY },
          });
        }
      }
    }
    
    workspace.updateNode(nodeId, {
      parentId: groupId,
      position: { x: rel.x - shiftX, y: rel.y - shiftY },
      extent: undefined,
      expandParent: undefined,
    });
  }

  /**
   * Remove a node from its parent group
   */
  function removeNodeFromGroup(nodeId: string) {
    const node = workspace.getNode(nodeId);
    if (!node || !node.parentId) return;
    
    const parent = workspace.getNode(node.parentId);
    if (!parent) return;
    
    // Calculate absolute position
    const absolutePosition = {
      x: node.position.x + parent.position.x,
      y: node.position.y + parent.position.y,
    };
    
    // Update the node to remove parent relationship
    workspace.updateNode(nodeId, {
      parentId: undefined,
      position: absolutePosition,
      extent: undefined,
      expandParent: undefined,
    });
  }

  // Handle node drag start - save history before moving nodes
  function handleNodeDragStart() {
    workspace.saveToHistory();
  }

  // Handle node drag stop - resolve collisions, save positions, handle subflow, and clear snap guides
  function handleNodeDragStop(event: { nodes: Node[]; event: MouseEvent | TouchEvent }) {
    snapGuides = [];

    // Work on the store so every step below sees the previous step's result.
    if (nodes !== workspace.nodes) workspace.nodes = nodes as MosaicNode[];
    const draggedIds = new Set(event.nodes.map(n => n.id));

    // xyflow commits its own (unsnapped) positions on release, so snap again here.
    if (event.event.shiftKey) {
      const dragged = workspace.nodes.filter(n => draggedIds.has(n.id));
      const { dx, dy } = calculateSnapOffset(dragged, workspace.nodes, SNAP_DISTANCE / viewport.zoom);
      if (dx || dy) {
        workspace.nodes = workspace.nodes.map(n =>
          draggedIds.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n
        );
      }
    }

    const regrouped = new Set<string>();
    
    for (const draggedNode of event.nodes) {
      if (nodeRegistry.isContainer(draggedNode.type)) continue;
      
      const currentNode = workspace.getNode(draggedNode.id);
      if (!currentNode) continue;

      let absolutePos = { ...currentNode.position };
      const currentParent = currentNode.parentId ? workspace.getNode(currentNode.parentId) : undefined;
      if (currentParent) {
        absolutePos = {
          x: currentNode.position.x + currentParent.position.x,
          y: currentNode.position.y + currentParent.position.y,
        };
      }
      const probe = { ...currentNode, position: absolutePos } as Node;
      const foundGroup = workspace.nodes.find(
        g => nodeRegistry.isContainer(g.type) && g.id !== currentNode.id && !g.parentId && isNodeInsideGroup(probe, g as Node)
      );
      
      if (foundGroup && currentNode.parentId !== foundGroup.id) {
        if (currentNode.parentId) removeNodeFromGroup(currentNode.id);
        addNodeToGroup(currentNode.id, foundGroup.id);
        regrouped.add(currentNode.id);
      } else if (!foundGroup && currentNode.parentId) {
        removeNodeFromGroup(currentNode.id);
        regrouped.add(currentNode.id);
      }
    }
    
    // Resolve collisions (skips child nodes and groups) and persist every node that moved
    const before = workspace.nodes;
    const resolved = resolveCollisions(before, { 
      maxIterations: 100, 
      overlapThreshold: 0.5, 
      margin: 15 
    });
    resolved.forEach((node, i) => {
      const moved = node !== before[i];
      if (regrouped.has(node.id) && !moved) return;
      if (moved || draggedIds.has(node.id)) {
        workspace.updateNode(node.id, {
          position: node.position,
          width: node.width,
          height: node.height,
        });
      }
    });
  }

  // Handle node drag - calculate snap alignment guides
  function handleNodeDrag(event: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent }) {
    // Get the nodes being dragged
    const eventDraggingNodes = event.nodes.length > 0 ? event.nodes : (event.targetNode ? [event.targetNode] : []);
    
    if (eventDraggingNodes.length === 0) {
      snapGuides = [];
      return;
    }
    
    // Look up the full node data from our local nodes array to ensure we have correct parentId
    // The event nodes may not have all properties correctly set
    let draggingNodes = eventDraggingNodes.map(eventNode => {
      const fullNode = nodes.find(n => n.id === eventNode.id);
      // Merge event node position (which is current during drag) with full node data
      return fullNode ? { ...fullNode, position: eventNode.position } : eventNode;
    });

    // Shift snaps the dragged nodes onto the nearest alignment guide.
    if (event.event.shiftKey) {
      const { dx, dy } = calculateSnapOffset(draggingNodes, nodes, SNAP_DISTANCE / viewport.zoom);
      if (dx || dy) {
        draggingNodes = draggingNodes.map(n => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }));
        const snapped = new Map(draggingNodes.map(n => [n.id, n.position]));
        nodes = nodes.map(n => (snapped.has(n.id) ? { ...n, position: snapped.get(n.id)! } : n));
      }
    }
    
    // Calculate guides based on single or multiple nodes being dragged
    if (draggingNodes.length === 1) {
      snapGuides = calculateSnapGuides(draggingNodes[0], nodes, SNAP_THRESHOLD);
    } else {
      snapGuides = calculateSelectionSnapGuides(draggingNodes, nodes, SNAP_THRESHOLD);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    
    const type = event.dataTransfer?.getData('application/mosaicflow-node') as NodeType;
    
    if (!type || !flowContainer) return;
    
    // Calculate position relative to the container
    const bounds = flowContainer.getBoundingClientRect();
    
    // Convert screen coordinates to flow coordinates
    const initialPosition = {
      x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
      y: (event.clientY - bounds.top - viewport.y) / viewport.zoom,
    };

    // Get default node size from centralized registry
    const nodeSize = getNodeSizeForType(type);

    // Find non-overlapping position before creation
    const position = findNonOverlappingPosition(initialPosition, nodeSize, nodes, 20);

    // Create the node
    const newNode = workspace.createNode(type, position);

    // After creation, run collision resolution and select the new node
    // Use setTimeout to let the state update first
    setTimeout(() => {
      // Run collision resolution
      nodes = resolveCollisions(nodes, { 
        maxIterations: 100, 
        overlapThreshold: 0.5, 
        margin: 15 
      });
      
      // Programmatically select the new node by updating nodes array
      nodes = nodes.map(n => ({
        ...n,
        selected: n.id === newNode.id
      }));
      
      // Also update workspace selection state
      workspace.setSelectedNodes([newNode.id]);
    }, 50);
  }

  // Get node size from plugin registry
  function getNodeSizeForType(type: NodeType): { width: number; height: number } {
    const dims = nodeRegistry.getDimensions(type);
    return { width: dims.defaultWidth, height: dims.defaultHeight };
  }

  // Group selected nodes
  function handleGroupNodes() {
    workspace.groupSelectedNodes();
  }

  // Ungroup selected group node
  function handleUngroupNodes() {
    if (workspace.selectedNodeIds.length === 1) {
      const node = workspace.getNode(workspace.selectedNodeIds[0]);
      if (node && nodeRegistry.isContainer(node.type)) {
        workspace.ungroupNode(node.id);
      }
    }
  }

  // Duplicate selected nodes
  function handleDuplicateNodes() {
    if (workspace.selectedNodeIds.length === 0) return;
    
    const newNodes = workspace.duplicateNodes(workspace.selectedNodeIds);
    
    // Select the duplicated nodes
    if (newNodes.length > 0) {
      workspace.setSelectedNodes(newNodes.map(n => n.id));
    }
  }

  // Delete selected nodes/edges
  function handleDeleteSelected() {
    workspace.deleteSelection([...workspace.selectedNodeIds], [...workspace.selectedEdgeIds]);
  }

  // Check if we can group (2+ top-level nodes selected)
  const canGroup = $derived(() =>
    workspace.selectedNodeIds.filter(id => !workspace.getNode(id)?.parentId).length >= 2
  );
  
  // Check if we can ungroup
  const canUngroup = $derived(
    workspace.selectedNodeIds.length === 1 && 
    nodeRegistry.isContainer(workspace.getNode(workspace.selectedNodeIds[0])?.type)
  );
  
  // Check if selected nodes are inside a group
  const hasNodesSelected = $derived(workspace.selectedNodeIds.length > 0);

  // Escape is contextual (menus first, then selection); every other shortcut is a command (see commands/core.ts).
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    if (edgeDropMenuOpen) {
      edgeDropMenuOpen = false;
      pendingConnectionSource = null;
      return;
    }
    if (workspace.selectedNodeIds.length > 0 || workspace.selectedEdgeIds.length > 0) {
      workspace.setSelectedEdges([]);
      workspace.edges = workspace.edges.map(e => (e.selected ? { ...e, selected: false } : e));
      workspace.setSelectedNodes([]);
    }
  }

  // Reset resize history flag on mouseup (end of resize operation)
  function handleMouseUp() {
    if (resizeHistorySaved) {
      resizeHistorySaved = false;
    }
  }

  // Derive interaction modes from canvas mode
  const panOnDrag = $derived(workspace.canvasMode === 'drag' ? [0, 1, 2] : [1, 2]);
  const selectionOnDrag = $derived(workspace.canvasMode === 'select');
</script>

<svelte:window onkeydown={handleKeyDown} onmouseup={handleMouseUp} />

<ContextMenu.Root>
  <ContextMenu.Trigger class="canvas-context-trigger">
    <div 
      class="canvas-container"
      class:drag-mode={workspace.canvasMode === 'drag'}
      bind:this={flowContainer}
      ondragover={handleDragOver}
      ondrop={handleDrop}
      ondblclick={handlePaneDoubleClick}
      onpointermove={(e) => (lastPointer = { x: e.clientX, y: e.clientY })}
      oncontextmenu={(e) => { 
        contextMenuPosition = { x: e.clientX, y: e.clientY };
        // Check if right-click is on a node
        const target = e.target as HTMLElement;
        const nodeElement = target.closest('.svelte-flow__node');
        contextMenuOnNode = nodeElement !== null || workspace.selectedNodeIds.length > 0;
      }}
      role="application"
    >
      <SvelteFlow
        id="mosaic-flow"
        class="lod-{currentLOD}"
        bind:nodes
        bind:edges
        bind:viewport
        {nodeTypes}
        {edgeTypes}
        onconnect={handleConnect}
        {isValidConnection}
        onconnectstart={handleConnectStart}
        onconnectend={handleConnectEnd}
        onselectionchange={handleSelectionChange}
        onnodedragstart={handleNodeDragStart}
        onnodedrag={handleNodeDrag}
        onnodedragstop={handleNodeDragStop}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}        elevateNodesOnSelect={false}
        zoomOnDoubleClick={false}
        snapGrid={settings.current.canvas.snapToGrid ? [settings.current.canvas.gridSize, settings.current.canvas.gridSize] : undefined}
        connectionLineType={ConnectionLineType.Bezier}
        panOnDrag={panOnDrag}
        selectionOnDrag={selectionOnDrag}
        selectionMode={SelectionMode.Partial}
        minZoom={0.01}
        maxZoom={8}
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
          style: 'stroke: #555555; stroke-width: 2px;',
        }}
        defaultMarkerColor="#555555"
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
    <!-- Snap alignment guides -->
    <SnapGuides guides={snapGuides} />
    
    <!-- Flow helper for programmatic control (fitView, zoom, etc.) -->
    <FlowHelper />

    <CanvasFilterBar />
    
    {#if settings.current.canvas.showControls}
      <Controls position="bottom-right" />
    {/if}
    
    {#if settings.current.canvas.showMinimap}
      <MiniMap 
        position="bottom-left"
        pannable
        zoomable
        style="background: #1a1d21; border: 1px solid #333;"
      />
    {/if}
    
    {#if settings.current.canvas.background !== 'none'}
      <Background 
        variant={BACKGROUND_VARIANTS[settings.current.canvas.background]} 
        gap={settings.current.canvas.gridSize}
        size={settings.current.canvas.background === 'cross' ? 6 : 1}
      />
    {/if}
    
    <NodeListSidebar isOpen={showNodeList} onClose={() => onToggleNodeList?.()} />
      </SvelteFlow>
    </div>
  </ContextMenu.Trigger>

  <ContextMenu.Content class="context-menu-content">
    {#if hasNodesSelected}
      <!-- Node Actions (shown when nodes are selected) -->
      <ContextMenu.Item class="context-menu-item" onclick={handleDuplicateNodes}>
        <Copy size={14} />
        <span>Duplicate</span>
        <ContextMenu.Shortcut>{keybindings.label('edit.duplicate')}</ContextMenu.Shortcut>
      </ContextMenu.Item>

      {#if canGroup()}
        <ContextMenu.Item class="context-menu-item" onclick={handleGroupNodes}>
          <Group size={14} />
          <span>Group</span>
          <ContextMenu.Shortcut>{keybindings.label('edit.group')}</ContextMenu.Shortcut>
        </ContextMenu.Item>
      {/if}

      {#if canUngroup}
        <ContextMenu.Item class="context-menu-item" onclick={handleUngroupNodes}>
          <Ungroup size={14} />
          <span>Ungroup</span>
          <ContextMenu.Shortcut>{keybindings.label('edit.ungroup')}</ContextMenu.Shortcut>
        </ContextMenu.Item>
      {/if}

      <ContextMenu.Separator class="context-menu-separator" />

      <ContextMenu.Item class="context-menu-item context-menu-item-danger" onclick={handleDeleteSelected}>
        <Trash2 size={14} />
        <span>Delete</span>
        <ContextMenu.Shortcut>{keybindings.label('edit.delete')}</ContextMenu.Shortcut>
      </ContextMenu.Item>
    {:else}
      <!-- Canvas Actions (shown when clicking on empty canvas) -->
      <ContextMenu.Item class="context-menu-item" onclick={() => openInsertMenu(contextMenuPosition)}>
        <Plus size={14} />
        <span>Insert block…</span>
        <ContextMenu.Shortcut>{keybindings.label('canvas.insert')}</ContextMenu.Shortcut>
      </ContextMenu.Item>

      <ContextMenu.Separator class="context-menu-separator" />

      <!-- Canvas Mode Toggle -->
      <ContextMenu.Item 
        class="context-menu-item"
        onclick={() => workspace.setCanvasMode(workspace.canvasMode === 'select' ? 'drag' : 'select')}
      >
        {#if workspace.canvasMode === 'select'}
          <Hand size={14} />
          <span>Switch to Drag Mode</span>
        {:else}
          <MousePointer2 size={14} />
          <span>Switch to Select Mode</span>
        {/if}
      </ContextMenu.Item>
    {/if}
  </ContextMenu.Content>
</ContextMenu.Root>

<!-- Edge drop: pick a block to create and connect -->
{#if edgeDropMenuOpen}
  <NodeInsertMenu
    x={edgeDropMenuPosition.x}
    y={edgeDropMenuPosition.y}
    heading="Add & connect"
    filter={(reg) => nodeRegistry.isConnectable(reg.type)}
    onPick={createNodeFromEdgeDrop}
    onClose={() => { edgeDropMenuOpen = false; pendingConnectionSource = null; }}
  />
{/if}

{#if insertMenu}
  <NodeInsertMenu
    x={insertMenu.menu.x}
    y={insertMenu.menu.y}
    onPick={insertFromMenu}
    onClose={() => (insertMenu = null)}
  />
{/if}

<style>
  :global(.canvas-context-trigger) {
    display: contents;
  }

  .canvas-container {
    flex: 1;
    height: 100%;
    width: 100%;
    background: #0d1117;
  }

  .canvas-container.drag-mode {
    cursor: grab;
  }

  .canvas-container.drag-mode:active {
    cursor: grabbing;
  }

  :global(.context-menu-content) {
    min-width: 184px;
    background: var(--mf-surface-2) !important;
    border: 1px solid var(--mf-border-strong) !important;
    border-radius: 8px !important;
    padding: 4px !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45) !important;
    font-family: var(--mf-font-ui);
    outline: none !important;
    z-index: 1000;
  }

  :global(.context-menu-item) {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    height: var(--mf-row);
    padding: 0 8px !important;
    font-size: 12.5px !important;
    color: var(--mf-text) !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    outline: none !important;
  }

  :global(.context-menu-item svg) {
    color: var(--mf-text-2);
  }

  :global(.context-menu-item:hover),
  :global(.context-menu-item:focus),
  :global(.context-menu-item[data-highlighted]) {
    background: var(--mf-hover) !important;
  }

  :global(.context-menu-item.active) {
    background: var(--mf-active) !important;
  }

  :global(.context-menu-item-danger),
  :global(.context-menu-item-danger svg) {
    color: var(--mf-danger) !important;
  }

  :global(.context-menu-item-danger:hover) {
    background: var(--mf-danger-soft) !important;
  }

  :global(.context-menu-heading) {
    padding: 6px 8px 2px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    color: var(--mf-text-3) !important;
  }

  :global(.context-menu-separator) {
    height: 1px !important;
    margin: 4px 0 !important;
    background: var(--mf-border) !important;
  }

  :global(.svelte-flow) {
    background: #0d1117 !important;
    /* Grayscale AA stays sharp under CSS transforms (subpixel AA breaks) */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(.svelte-flow__background) {
    background: #0d1117 !important;
  }

  :global(.svelte-flow__background pattern circle) {
    fill: #333 !important;
  }

  /*
   * Viewport is the container xyflow applies `transform: translate() scale()` to.
   * Do NOT add translate3d, will-change, or preserve-3d here — they create an
   * extra compositing layer that rasterizes at 1x then GPU-scales, worsening blur.
   */
  /* intentionally empty — let xyflow control this */
  :global(.svelte-flow__viewport) {
    contain: none;
  }

  /*
   * DO NOT add backface-visibility:hidden here.
   *
   * On macOS WKWebView (and WebKitGTK on Linux), backface-visibility:hidden
   * promotes each node into its own compositing layer. WebKit rasterizes
   * those layers at base DPR only — it does NOT include the ancestor's CSS
   * scale() in the tile resolution. The GPU compositor then applies the
   * xyflow viewport scale on top of an under-rasterized bitmap → blurry text.
   *
   * Without it, nodes are rasterized as part of the viewport layer at full
   * quality: DPR × viewport scale → crisp at any zoom level.
   *
   * Chromium/WebView2 (Windows) is unaffected because Blink uses an
   * "ideal contents scale" that includes ancestor transforms when tiling
   * composited layers, so it stays crisp either way.
   */
  :global(.svelte-flow__node) {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /* Sharper images inside nodes when zoomed */
  :global(.svelte-flow__node img) {
    image-rendering: auto;
    /* -webkit-optimize-contrast gives macOS WebKit sharper upscaling */
    image-rendering: -webkit-optimize-contrast;
  }

  :global(.svelte-flow__controls) {
    background: var(--mf-surface-2);
    border: 1px solid var(--mf-border-strong);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  :global(.svelte-flow__controls-button) {
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid var(--mf-border) !important;
    color: var(--mf-text-2) !important;
  }

  :global(.svelte-flow__controls-button:hover) {
    background: var(--mf-hover) !important;
    color: var(--mf-text) !important;
  }

  :global(.svelte-flow__controls-button:last-child) {
    border-bottom: none !important;
  }

  :global(.svelte-flow__controls-button svg) {
    fill: currentColor !important;
  }

  /* Removed !important to allow inline styles to override */
  :global(.svelte-flow__edge-path) {
    stroke: #555555;
  }

  /* Prevent animation on glow paths inside animated edges */
  :global(.svelte-flow__edge.animated .glow-path-inner) {
    stroke-dasharray: none !important;
    animation: none !important;
  }

  /* Group node (subflow container) styling */
  :global(.svelte-flow__node-group) {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    /* Ensure proper click detection on the group node */
    pointer-events: all !important;
  }

  /* Ensure the group node's content area is clickable */
  :global(.svelte-flow__node-group > .group-container) {
    pointer-events: all;
  }

  /* Edge markers (arrowheads) */
  :global(.svelte-flow__arrowhead) {
    stroke-width: 1;
  }

  :global(.svelte-flow__arrowhead polyline) {
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  :global(.svelte-flow__marker svg) {
    overflow: visible;
  }

  :global(.svelte-flow__handle) {
    background: #555555 !important;
    border: 2px solid #333 !important;
    width: 10px !important;
    height: 10px !important;
    border-radius: 2px !important;
  }

  :global(.svelte-flow__handle:hover) {
    background: #f6b83b !important;
  }

  :global(.svelte-flow__minimap) {
    background: var(--mf-surface) !important;
    border: 1px solid var(--mf-border-strong) !important;
    border-radius: 8px !important;
    overflow: hidden;
  }

  :global(.svelte-flow__minimap-mask) {
    fill: rgba(0, 0, 0, 0.6) !important;
  }

  :global(.svelte-flow__minimap-node) {
    fill: #333 !important;
    stroke: #555 !important;
  }

  /* Make NodeResizer more subtle so it doesn't interfere with style previews */
  :global(.svelte-flow__resize-control) {
    background: transparent !important;
    border: none !important;
  }

  :global(.svelte-flow__resize-control.handle) {
    width: 8px !important;
    height: 8px !important;
    background: rgba(59, 130, 246, 0.6) !important;
    border: 1px solid #3b82f6 !important;
    border-radius: 2px !important;
  }

  :global(.svelte-flow__resize-control.handle:hover) {
    background: #3b82f6 !important;
  }

  :global(.svelte-flow__resize-control.line) {
    border-color: rgba(59, 130, 246, 0.3) !important;
  }

  /* Make selection outline more subtle */
  :global(.svelte-flow__node.selected) {
    outline: none !important;
  }

  /* Locked nodes (draggable=false) show a small lock badge so they don't feel broken */
  :global(.svelte-flow__node.selectable:not(.draggable)::after) {
    content: '';
    position: absolute;
    top: -8px;
    right: -8px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--mf-surface-2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23a6a6ad' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='11' width='18' height='11' rx='2'/%3E%3Cpath d='M7 11V7a5 5 0 0 1 10 0v4'/%3E%3C/svg%3E") center / 11px no-repeat;
    border: 1px solid var(--mf-border-strong);
    pointer-events: none;
    z-index: 10;
  }

  /* LOD (Level of Detail) Rendering Optimizations */
  :global(.lod-simplified .svelte-flow__node .node-content) {
    display: none !important;
  }
  
  :global(.lod-simplified .svelte-flow__handle) {
    display: none !important;
  }
  
  :global(.lod-simplified .svelte-flow__node .node-header) {
    font-size: 24px !important;
    font-weight: 600;
  }
  
  :global(.lod-simplified .svelte-flow__resize-control) {
    display: none !important;
  }
  
  :global(.lod-medium .svelte-flow__node .node-content) {
    opacity: 0.7;
  }
  
  :global(.lod-medium .svelte-flow__handle) {
    opacity: 0.5;
  }
  
  :global(.lod-medium .svelte-flow__resize-control.handle) {
    opacity: 0.3;
  }
  
  :global(.lod-simplified .svelte-flow__edge) {
    opacity: 0.3 !important;
  }
  
  :global(.lod-medium .svelte-flow__edge) {
    opacity: 0.6 !important;
  }
  
  :global(.lod-simplified .svelte-flow__edge-label) {
    display: none !important;
  }
  
  :global(.lod-medium .svelte-flow__edge-label) {
    opacity: 0.7;
  }

  /* Disable LOD during PNG export for high-quality output */
  :global([data-exporting="true"] .lod-simplified .svelte-flow__node .node-content),
  :global([data-exporting="true"] .lod-medium .svelte-flow__node .node-content) {
    display: block !important;
    opacity: 1 !important;
  }
  
  :global([data-exporting="true"] .lod-simplified .svelte-flow__handle),
  :global([data-exporting="true"] .lod-medium .svelte-flow__handle) {
    display: block !important;
    opacity: 1 !important;
  }
  
  :global([data-exporting="true"] .lod-simplified .svelte-flow__node .node-header) {
    font-size: inherit !important;
  }
  
  :global([data-exporting="true"] .lod-simplified .svelte-flow__edge),
  :global([data-exporting="true"] .lod-medium .svelte-flow__edge) {
    opacity: 1 !important;
  }
  
  :global([data-exporting="true"] .lod-simplified .svelte-flow__edge-label),
  :global([data-exporting="true"] .lod-medium .svelte-flow__edge-label) {
    display: block !important;
    opacity: 1 !important;
  }
</style>
