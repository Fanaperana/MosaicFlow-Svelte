<script lang="ts">
  import { useSvelteFlow, type Edge } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { absoluteRects } from '@mosaicflow/vault-core';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  
  // Get the SvelteFlow instance functions
  const { fitView, getViewport, setViewport, zoomIn, zoomOut, updateEdge, setCenter } = useSvelteFlow();

  // Select a node and pan to it (used by wikilinks, search and backlinks)
  function handleFocusNode(event: CustomEvent<{ id: string; zoom?: number }>) {
    const { id, zoom } = event.detail;
    const rect = absoluteRects(workspace.nodes).get(id);
    if (!rect) return;
    workspace.setSelectedNodes([id]);
    setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, {
      zoom: zoom ?? Math.max(getViewport().zoom, 0.9),
      duration: 500,
    });
  }
  
  // Export a global trigger for fitView that can be called from anywhere
  // We use a custom event pattern
  function handleFitView(event: CustomEvent<{ padding?: number; maxZoom?: number; duration?: number }>) {
    const options = event.detail || {};
    fitView({
      padding: options.padding ?? 0.1,
      maxZoom: options.maxZoom,
      duration: options.duration ?? 200,
    });
  }
  
  function handleZoomIn() {
    zoomIn({ duration: 150 });
  }
  
  function handleZoomOut() {
    zoomOut({ duration: 150 });
  }
  
  // Handle edge updates from outside SvelteFlow (e.g., PropertiesPanel)
  function handleUpdateEdge(event: CustomEvent<{ id: string; updates: Partial<Edge> }>) {
    const { id, updates } = event.detail;
    updateEdge(id, updates);
  }

  // Through setViewport (not the bound viewport) so the next wheel zoom starts from here.
  function handlePanBy(event: CustomEvent<{ x: number; y: number }>) {
    const vp = getViewport();
    setViewport({ x: vp.x + event.detail.x, y: vp.y + event.detail.y, zoom: vp.zoom });
  }

  // Repeated zooms keep the first saved view, so going back returns to the overview.
  function handleZoomToSelection() {
    const ids = workspace.selectedNodeIds;
    if (!ids.length) return;
    ui.zoomReturn ??= getViewport();
    fitView({ nodes: ids.map((id) => ({ id })), padding: 0.25, maxZoom: 1.5, duration: 300 });
  }

  function handleZoomBack() {
    const view = ui.zoomReturn;
    if (!view) return;
    ui.zoomReturn = null;
    setViewport(view, { duration: 300 });
  }

  function handleSetViewport(event: CustomEvent<{ x: number; y: number; zoom: number }>) {
    setViewport(event.detail);
  }

  // Pans (without zooming) only when the node is not already fully on screen.
  function handleRevealNode(event: CustomEvent<{ id: string }>) {
    const rect = absoluteRects(workspace.nodes).get(event.detail.id);
    const pane = document.querySelector('.svelte-flow')?.getBoundingClientRect();
    if (!rect || !pane) return;
    const vp = getViewport();
    const left = rect.x * vp.zoom + vp.x;
    const top = rect.y * vp.zoom + vp.y;
    const inside = left >= 0 && top >= 0 && left + rect.width * vp.zoom <= pane.width && top + rect.height * vp.zoom <= pane.height;
    if (!inside) setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, { zoom: vp.zoom, duration: 200 });
  }
  
  onMount(() => {
    window.addEventListener('mosaicflow:zoomToSelection', handleZoomToSelection);
    window.addEventListener('mosaicflow:zoomBack', handleZoomBack);
    window.addEventListener('mosaicflow:setViewport', handleSetViewport as EventListener);
    window.addEventListener('mosaicflow:revealNode', handleRevealNode as EventListener);
    // Listen for fitView events from anywhere in the app
    window.addEventListener('mosaicflow:fitView', handleFitView as EventListener);
    window.addEventListener('mosaicflow:zoomIn', handleZoomIn);
    window.addEventListener('mosaicflow:zoomOut', handleZoomOut);
    window.addEventListener('mosaicflow:updateEdge', handleUpdateEdge as EventListener);
    window.addEventListener('mosaicflow:focusNode', handleFocusNode as EventListener);
    window.addEventListener('mosaicflow:panBy', handlePanBy as EventListener);
    
    return () => {
      window.removeEventListener('mosaicflow:zoomToSelection', handleZoomToSelection);
      window.removeEventListener('mosaicflow:zoomBack', handleZoomBack);
      window.removeEventListener('mosaicflow:setViewport', handleSetViewport as EventListener);
      window.removeEventListener('mosaicflow:revealNode', handleRevealNode as EventListener);
      window.removeEventListener('mosaicflow:panBy', handlePanBy as EventListener);
      window.removeEventListener('mosaicflow:focusNode', handleFocusNode as EventListener);
      window.removeEventListener('mosaicflow:fitView', handleFitView as EventListener);
      window.removeEventListener('mosaicflow:zoomIn', handleZoomIn);
      window.removeEventListener('mosaicflow:zoomOut', handleZoomOut);
      window.removeEventListener('mosaicflow:updateEdge', handleUpdateEdge as EventListener);
    };
  });
</script>

<!-- This component renders nothing, it just bridges SvelteFlow functions to the global scope -->
