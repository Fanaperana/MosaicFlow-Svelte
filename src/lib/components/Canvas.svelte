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
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import { workspace } from '$lib/stores/workspace.svelte';
  import { nodeTypes } from '$lib/components/nodes';
  import type { NodeType, MosaicNode, MosaicEdge } from '$lib/types';
  import { NODE_TYPE_INFO } from '$lib/types';
  import { resolveCollisions, findNonOverlappingPosition } from '$lib/utils/resolve-collisions';
  import { calculateSnapGuides, calculateSelectionSnapGuides, type SnapGuide } from '$lib/utils/snap-guides';
  import SnapGuides from '$lib/components/SnapGuides.svelte';
  import NodeListSidebar from '$lib/components/NodeListSidebar.svelte';
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
    StickyNote, 
    Image, 
    Link, 
    Code, 
    Clock, 
    User, 
    Building2, 
    Globe, 
    FileDigit, 
    KeyRound, 
    MessageSquare, 
    FolderOpen, 
    MapPin, 
    List, 
    Router, 
    Camera, 
    CheckSquare,
    Group,
    Ungroup,
    Copy,
    Clipboard,
    Trash2,
    ZoomIn,
    ZoomOut,
    Maximize,
    LayoutGrid
  } from 'lucide-svelte';

  // Two-way binding with workspace state - using $state.raw for better performance
  let nodes = $state.raw(workspace.nodes as Node[]);
  let edges = $state.raw(workspace.edges as Edge[]);
  
  // Viewport state for coordinate conversion
  let viewport = $state({ x: 0, y: 0, zoom: 1 });
  let flowContainer: HTMLDivElement | undefined;
  
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
  
  // Snap guides state
  let snapGuides = $state<SnapGuide[]>([]);
  const SNAP_THRESHOLD = 8; // Distance in pixels to show guides
  
  // Edge drop menu state - for creating nodes when dropping connection on empty canvas
  let edgeDropMenuOpen = $state(false);
  let edgeDropMenuPosition = $state({ x: 0, y: 0 });
  let pendingConnectionSource = $state<{ nodeId: string; handleId: string | null; handleType: 'source' | 'target' } | null>(null);
  
  // Sync workspace changes to local state
  $effect(() => {
    nodes = workspace.nodes as Node[];
  });
  
  $effect(() => {
    edges = workspace.edges as Edge[];
  });
  
  // Sync local state changes back to workspace
  $effect(() => {
    if (nodes !== workspace.nodes) {
      workspace.nodes = nodes as MosaicNode[];
    }
  });
  
  $effect(() => {
    if (edges !== workspace.edges) {
      workspace.edges = edges as MosaicEdge[];
    }
  });

  // Handle edge connection
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
    
    // Convert screen position to flow position
    const flowPosition = screenToFlowPosition({
      x: edgeDropMenuPosition.x,
      y: edgeDropMenuPosition.y,
    });
    
    // Get default node size
    const nodeSize = getNodeSizeForType(type);
    
    // Offset position to center the node on the drop point
    const position = {
      x: flowPosition.x - nodeSize.width / 2,
      y: flowPosition.y - nodeSize.height / 2,
    };
    
    // Find non-overlapping position
    const finalPosition = findNonOverlappingPosition(position, nodeSize, nodes, 20);
    
    // Create the node
    const newNode = workspace.createNode(type, finalPosition);
    
    // Create edge based on which handle type was used
    if (pendingConnectionSource.handleType === 'source') {
      // Dragged from source, so new node is target
      workspace.createEdge(
        pendingConnectionSource.nodeId,
        newNode.id,
        undefined,
        pendingConnectionSource.handleId,
        'left' // Default target handle
      );
    } else {
      // Dragged from target, so new node is source
      workspace.createEdge(
        newNode.id,
        pendingConnectionSource.nodeId,
        undefined,
        'right', // Default source handle
        pendingConnectionSource.handleId
      );
    }
    
    // Run collision resolution
    setTimeout(() => {
      nodes = resolveCollisions(nodes, { 
        maxIterations: 100, 
        overlapThreshold: 0.5, 
        margin: 15 
      });
      
      // Select the new node
      nodes = nodes.map(n => ({
        ...n,
        selected: n.id === newNode.id
      }));
      workspace.setSelectedNodes([newNode.id]);
    }, 50);
    
    // Clean up
    pendingConnectionSource = null;
    edgeDropMenuOpen = false;
  }

  // Handle selection changes
  function handleSelectionChange(params: { nodes: Node[]; edges: Edge[] }) {
    workspace.setSelectedNodes(params.nodes.map(n => n.id));
    workspace.setSelectedEdges(params.edges.map(e => e.id));
  }

  // Handle drop for adding new nodes
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  // Handle node drag stop - resolve collisions and clear snap guides
  function handleNodeDragStop() {
    // Clear snap guides
    snapGuides = [];
    
    // Resolve collisions
    nodes = resolveCollisions(nodes, { 
      maxIterations: 100, 
      overlapThreshold: 0.5, 
      margin: 15 
    });
  }

  // Handle node drag - calculate snap alignment guides
  function handleNodeDrag(event: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent }) {
    // Get the nodes being dragged
    const draggingNodes = event.nodes.length > 0 ? event.nodes : (event.targetNode ? [event.targetNode] : []);
    
    if (draggingNodes.length === 0) {
      snapGuides = [];
      return;
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
    const viewport = workspace.viewport;
    
    // Convert screen coordinates to flow coordinates
    const initialPosition = {
      x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
      y: (event.clientY - bounds.top - viewport.y) / viewport.zoom,
    };

    // Get default node size based on type
    const nodeSize = { width: 200, height: 100 };
    if (type === 'timestamp') {
      nodeSize.width = 160;
      nodeSize.height = 36;
    } else if (type === 'image') {
      nodeSize.width = 200;
      nodeSize.height = 200;
    } else if (type === 'note') {
      nodeSize.width = 300;
      nodeSize.height = 200;
    } else if (type === 'code') {
      nodeSize.width = 400;
      nodeSize.height = 250;
    }

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

  // Add node from context menu
  function addNodeFromContextMenu(type: NodeType) {
    if (!flowContainer) return;
    
    const bounds = flowContainer.getBoundingClientRect();
    const viewport = workspace.viewport;
    
    // Convert screen coordinates to flow coordinates
    const initialPosition = {
      x: (contextMenuPosition.x - bounds.left - viewport.x) / viewport.zoom,
      y: (contextMenuPosition.y - bounds.top - viewport.y) / viewport.zoom,
    };

    // Get default node size based on type
    const nodeSize = getNodeSizeForType(type);

    // Find non-overlapping position before creation
    const position = findNonOverlappingPosition(initialPosition, nodeSize, nodes, 20);

    // Create the node
    const newNode = workspace.createNode(type, position);

    // After creation, run collision resolution and select the new node
    setTimeout(() => {
      nodes = resolveCollisions(nodes, { 
        maxIterations: 100, 
        overlapThreshold: 0.5, 
        margin: 15 
      });
      
      nodes = nodes.map(n => ({
        ...n,
        selected: n.id === newNode.id
      }));
      
      workspace.setSelectedNodes([newNode.id]);
    }, 50);
  }

  function getNodeSizeForType(type: NodeType): { width: number; height: number } {
    const sizes: Partial<Record<NodeType, { width: number; height: number }>> = {
      timestamp: { width: 160, height: 36 },
      image: { width: 200, height: 200 },
      note: { width: 300, height: 200 },
      code: { width: 400, height: 250 },
      group: { width: 400, height: 300 },
      annotation: { width: 200, height: 100 },
    };
    return sizes[type] || { width: 200, height: 100 };
  }

  // Get node icon component
  function getNodeIcon(type: NodeType) {
    const icons: Record<NodeType, any> = {
      note: StickyNote,
      image: Image,
      link: Link,
      code: Code,
      timestamp: Clock,
      person: User,
      organization: Building2,
      domain: Globe,
      hash: FileDigit,
      credential: KeyRound,
      socialPost: MessageSquare,
      group: FolderOpen,
      map: MapPin,
      router: Router,
      linkList: List,
      snapshot: Camera,
      action: CheckSquare,
      iframe: LayoutGrid,
      annotation: StickyNote,
    };
    return icons[type];
  }

  // Group selected nodes
  function handleGroupNodes() {
    workspace.groupSelectedNodes();
  }

  // Ungroup selected group node
  function handleUngroupNodes() {
    if (workspace.selectedNodeIds.length === 1) {
      const node = workspace.getNode(workspace.selectedNodeIds[0]);
      if (node?.type === 'group') {
        workspace.ungroupNode(node.id);
      }
    }
  }

  // Duplicate selected nodes
  function handleDuplicateNodes() {
    const selectedNodes = workspace.nodes.filter(n => workspace.selectedNodeIds.includes(n.id));
    const newNodeIds: string[] = [];
    
    for (const node of selectedNodes) {
      const newPosition = {
        x: node.position.x + 50,
        y: node.position.y + 50,
      };
      const newNode = workspace.createNode(node.type as NodeType, newPosition, { ...node.data });
      newNodeIds.push(newNode.id);
    }
    
    // Select the duplicated nodes
    if (newNodeIds.length > 0) {
      workspace.setSelectedNodes(newNodeIds);
    }
  }

  // Delete selected nodes/edges
  function handleDeleteSelected() {
    if (workspace.selectedNodeIds.length > 0) {
      workspace.deleteNodes(workspace.selectedNodeIds);
    }
    if (workspace.selectedEdgeIds.length > 0) {
      workspace.selectedEdgeIds.forEach(id => workspace.deleteEdge(id));
    }
  }

  // Check if we can group (2+ nodes selected, and none of them are inside a group)
  const canGroup = $derived(() => {
    if (workspace.selectedNodeIds.length < 2) return false;
    
    // Check if any selected node is a child of a group
    for (const nodeId of workspace.selectedNodeIds) {
      const parentGroup = workspace.nodes.find(
        n => n.type === 'group' && (n.data as any).childNodeIds?.includes(nodeId)
      );
      if (parentGroup) return false;
    }
    return true;
  });
  
  // Check if we can ungroup
  const canUngroup = $derived(
    workspace.selectedNodeIds.length === 1 && 
    workspace.getNode(workspace.selectedNodeIds[0])?.type === 'group'
  );
  
  // Check if selected nodes are inside a group
  const hasNodesSelected = $derived(workspace.selectedNodeIds.length > 0);

  // Handle node deletion
  function handleKeyDown(event: KeyboardEvent) {
    // Don't handle delete if user is typing in an input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    if (event.key === 'Delete' || event.key === 'Backspace') {
      handleDeleteSelected();
    }
    
    // Ctrl/Cmd + G to group
    if ((event.ctrlKey || event.metaKey) && event.key === 'g' && !event.shiftKey) {
      event.preventDefault();
      if (canGroup()) handleGroupNodes();
    }
    
    // Ctrl/Cmd + Shift + G to ungroup
    if ((event.ctrlKey || event.metaKey) && event.key === 'g' && event.shiftKey) {
      event.preventDefault();
      if (canUngroup) handleUngroupNodes();
    }
    
    // Ctrl/Cmd + D to duplicate
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      if (workspace.selectedNodeIds.length > 0) handleDuplicateNodes();
    }
  }

  // Derive interaction modes from canvas mode
  const panOnDrag = $derived(workspace.canvasMode === 'drag' ? [0, 1, 2] : [1, 2]);
  const selectionOnDrag = $derived(workspace.canvasMode === 'select');
</script>

<svelte:window onkeydown={handleKeyDown} />

<ContextMenu.Root>
  <ContextMenu.Trigger class="canvas-context-trigger">
    <div 
      class="canvas-container"
      class:drag-mode={workspace.canvasMode === 'drag'}
      bind:this={flowContainer}
      ondragover={handleDragOver}
      ondrop={handleDrop}
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
        bind:nodes
        bind:edges
        bind:viewport
        {nodeTypes}
        onconnect={handleConnect}
        onconnectstart={handleConnectStart}
        onconnectend={handleConnectEnd}
        onselectionchange={handleSelectionChange}
        onnodedrag={handleNodeDrag}
        onnodedragstop={handleNodeDragStop}
        fitView
        elevateNodesOnSelect={false}
        connectionLineType={ConnectionLineType.Bezier}
        panOnDrag={panOnDrag}
        selectionOnDrag={selectionOnDrag}
        minZoom={0.25}
        maxZoom={2}
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
    
    <Controls position="bottom-right" />
    
    {#if workspace.settings.showMinimap}
      <MiniMap 
        position="bottom-left"
        pannable
        zoomable
        style="background: #1a1d21; border: 1px solid #333;"
      />
    {/if}
    
    <Background 
      variant={BackgroundVariant.Dots} 
      gap={workspace.settings.gridSize}
      size={1}
    />
    
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
        <ContextMenu.Shortcut>Ctrl+D</ContextMenu.Shortcut>
      </ContextMenu.Item>

      {#if canGroup()}
        <ContextMenu.Item class="context-menu-item" onclick={handleGroupNodes}>
          <Group size={14} />
          <span>Group</span>
          <ContextMenu.Shortcut>Ctrl+G</ContextMenu.Shortcut>
        </ContextMenu.Item>
      {/if}

      {#if canUngroup}
        <ContextMenu.Item class="context-menu-item" onclick={handleUngroupNodes}>
          <Ungroup size={14} />
          <span>Ungroup</span>
          <ContextMenu.Shortcut>Ctrl+Shift+G</ContextMenu.Shortcut>
        </ContextMenu.Item>
      {/if}

      <ContextMenu.Separator class="context-menu-separator" />

      <ContextMenu.Item class="context-menu-item context-menu-item-danger" onclick={handleDeleteSelected}>
        <Trash2 size={14} />
        <span>Delete</span>
        <ContextMenu.Shortcut>Del</ContextMenu.Shortcut>
      </ContextMenu.Item>
    {:else}
      <!-- Canvas Actions (shown when clicking on empty canvas) -->
      <!-- Add Node Submenu -->
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger class="context-menu-item">
          <Plus size={14} />
          <span>Add Node</span>
        </ContextMenu.SubTrigger>
        <ContextMenu.SubContent class="context-menu-content">
          <!-- Content Nodes -->
          <ContextMenu.Group>
            <ContextMenu.GroupHeading class="context-menu-heading">Content</ContextMenu.GroupHeading>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('note')}>
              <StickyNote size={14} />
              <span>Note</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('image')}>
              <Image size={14} />
              <span>Image</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('link')}>
              <Link size={14} />
              <span>Link</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('code')}>
              <Code size={14} />
              <span>Code</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('timestamp')}>
              <Clock size={14} />
              <span>Timestamp</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('iframe')}>
              <LayoutGrid size={14} />
              <span>Iframe</span>
            </ContextMenu.Item>
          </ContextMenu.Group>

          <ContextMenu.Separator class="context-menu-separator" />

          <!-- Entity Nodes -->
          <ContextMenu.Group>
            <ContextMenu.GroupHeading class="context-menu-heading">Entity</ContextMenu.GroupHeading>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('person')}>
              <User size={14} />
              <span>Person</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('organization')}>
              <Building2 size={14} />
              <span>Organization</span>
            </ContextMenu.Item>
          </ContextMenu.Group>

          <ContextMenu.Separator class="context-menu-separator" />

          <!-- OSINT Nodes -->
          <ContextMenu.Group>
            <ContextMenu.GroupHeading class="context-menu-heading">OSINT</ContextMenu.GroupHeading>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('domain')}>
              <Globe size={14} />
              <span>Domain</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('hash')}>
              <FileDigit size={14} />
              <span>Hash</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('credential')}>
              <KeyRound size={14} />
              <span>Credential</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('socialPost')}>
              <MessageSquare size={14} />
              <span>Social Post</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('router')}>
              <Router size={14} />
              <span>Router</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('snapshot')}>
              <Camera size={14} />
              <span>Snapshot</span>
            </ContextMenu.Item>
          </ContextMenu.Group>

          <ContextMenu.Separator class="context-menu-separator" />

          <!-- Utility Nodes -->
          <ContextMenu.Group>
            <ContextMenu.GroupHeading class="context-menu-heading">Utility</ContextMenu.GroupHeading>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('group')}>
              <FolderOpen size={14} />
              <span>Group</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('map')}>
              <MapPin size={14} />
              <span>Map</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('linkList')}>
              <List size={14} />
              <span>Link List</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('action')}>
              <CheckSquare size={14} />
              <span>Action</span>
            </ContextMenu.Item>
            <ContextMenu.Item class="context-menu-item" onclick={() => addNodeFromContextMenu('annotation')}>
              <StickyNote size={14} />
              <span>Annotation</span>
            </ContextMenu.Item>
          </ContextMenu.Group>
        </ContextMenu.SubContent>
      </ContextMenu.Sub>

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

<!-- Edge Drop Menu - appears when dropping connection on empty canvas -->
{#if edgeDropMenuOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div 
    class="edge-drop-overlay"
    role="presentation"
    onclick={() => { edgeDropMenuOpen = false; pendingConnectionSource = null; }}
  ></div>
  <div 
    class="edge-drop-menu"
    style="left: {edgeDropMenuPosition.x}px; top: {edgeDropMenuPosition.y}px;"
  >
    <div class="edge-drop-header">
      <Plus size={14} />
      <span>Add & Connect Node</span>
    </div>
    
    <div class="edge-drop-section">
      <div class="edge-drop-section-title">Content</div>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('note')}>
        <StickyNote size={14} /> Note
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('image')}>
        <Image size={14} /> Image
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('link')}>
        <Link size={14} /> Link
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('code')}>
        <Code size={14} /> Code
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('iframe')}>
        <LayoutGrid size={14} /> Iframe
      </button>
    </div>
    
    <div class="edge-drop-section">
      <div class="edge-drop-section-title">Entity</div>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('person')}>
        <User size={14} /> Person
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('organization')}>
        <Building2 size={14} /> Organization
      </button>
    </div>
    
    <div class="edge-drop-section">
      <div class="edge-drop-section-title">OSINT</div>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('domain')}>
        <Globe size={14} /> Domain
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('hash')}>
        <FileDigit size={14} /> Hash
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('credential')}>
        <KeyRound size={14} /> Credential
      </button>
    </div>
    
    <div class="edge-drop-section">
      <div class="edge-drop-section-title">Utility</div>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('group')}>
        <FolderOpen size={14} /> Group
      </button>
      <button class="edge-drop-item" onclick={() => createNodeFromEdgeDrop('timestamp')}>
        <Clock size={14} /> Timestamp
      </button>
    </div>
  </div>
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
    min-width: 180px;
    background: #1a1d21 !important;
    border: 1px solid #333 !important;
    border-radius: 8px !important;
    padding: 4px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
    z-index: 1000;
  }

  :global(.context-menu-item) {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 8px 12px !important;
    font-size: 13px !important;
    color: #e0e0e0 !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    outline: none !important;
  }

  :global(.context-menu-item:hover),
  :global(.context-menu-item:focus) {
    background: rgba(59, 130, 246, 0.2) !important;
  }

  :global(.context-menu-item.active) {
    background: rgba(59, 130, 246, 0.3) !important;
  }

  :global(.context-menu-item-danger:hover) {
    background: rgba(239, 68, 68, 0.2) !important;
    color: #ef4444 !important;
  }

  :global(.context-menu-heading) {
    padding: 6px 12px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    color: #888 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
  }

  :global(.context-menu-separator) {
    height: 1px !important;
    margin: 4px 0 !important;
    background: #333 !important;
  }

  :global(.svelte-flow) {
    background: #0d1117 !important;
    /* macOS text blur fix - use subpixel-antialiased for sharper text */
    -webkit-font-smoothing: subpixel-antialiased;
    -moz-osx-font-smoothing: auto;
  }

  :global(.svelte-flow__background) {
    background: #0d1117 !important;
  }

  :global(.svelte-flow__background pattern circle) {
    fill: #333 !important;
  }

  /* Optimize viewport transform rendering on macOS */
  :global(.svelte-flow__viewport) {
    /* Removed backface-visibility and transform-style as they cause blur on modern WebKit */
    transform: translate3d(0, 0, 0);
  }

  /* Node text rendering optimization */
  :global(.svelte-flow__node) {
    -webkit-font-smoothing: subpixel-antialiased;
    -moz-osx-font-smoothing: auto;
    text-rendering: optimizeLegibility;
    /* Removed backface-visibility as it causes blur */
  }

  :global(.svelte-flow__controls) {
    background: #1a1d21;
    border: 1px solid #333;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  :global(.svelte-flow__controls-button) {
    background: #1a1d21 !important;
    border: none !important;
    border-bottom: 1px solid #333 !important;
    color: #888 !important;
  }

  :global(.svelte-flow__controls-button:hover) {
    background: #252a30 !important;
    color: #fafafa !important;
  }

  :global(.svelte-flow__controls-button:last-child) {
    border-bottom: none !important;
  }

  :global(.svelte-flow__controls-button svg) {
    fill: currentColor !important;
  }

  :global(.svelte-flow__edge-path) {
    stroke: #555555 !important;
  }

  :global(.svelte-flow__edge.selected .svelte-flow__edge-path) {
    stroke: #3b82f6 !important;
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
    background: #1a1d21 !important;
    border: 1px solid #333 !important;
    border-radius: 6px !important;
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

  /* Edge Drop Menu Styles */
  .edge-drop-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
  }

  .edge-drop-menu {
    position: fixed;
    z-index: 1000;
    background: #1a1d21;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    min-width: 180px;
    max-height: 400px;
    overflow-y: auto;
    transform: translate(-50%, 0);
  }

  .edge-drop-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    color: #3b82f6;
    font-size: 12px;
    font-weight: 600;
    border-bottom: 1px solid #333;
    margin-bottom: 8px;
  }

  .edge-drop-section {
    margin-bottom: 8px;
  }

  .edge-drop-section:last-child {
    margin-bottom: 0;
  }

  .edge-drop-section-title {
    padding: 4px 12px;
    font-size: 10px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .edge-drop-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: #e0e0e0;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
  }

  .edge-drop-item:hover {
    background: rgba(59, 130, 246, 0.2);
  }
</style>
