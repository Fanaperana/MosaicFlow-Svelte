<script lang="ts">
  import { useSvelteFlow, type Edge } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  
  // Get the SvelteFlow instance functions
  const { fitView, getViewport, setViewport, zoomIn, zoomOut, updateEdge } = useSvelteFlow();
  
  // Export a global trigger for fitView that can be called from anywhere
  // We use a custom event pattern
  function handleFitView(event: CustomEvent<{ padding?: number }>) {
    const options = event.detail || {};
    fitView({
      padding: options.padding ?? 0.1,
      duration: 200,
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
  
  onMount(() => {
    // Listen for fitView events from anywhere in the app
    window.addEventListener('mosaicflow:fitView', handleFitView as EventListener);
    window.addEventListener('mosaicflow:zoomIn', handleZoomIn);
    window.addEventListener('mosaicflow:zoomOut', handleZoomOut);
    window.addEventListener('mosaicflow:updateEdge', handleUpdateEdge as EventListener);
    
    return () => {
      window.removeEventListener('mosaicflow:fitView', handleFitView as EventListener);
      window.removeEventListener('mosaicflow:zoomIn', handleZoomIn);
      window.removeEventListener('mosaicflow:zoomOut', handleZoomOut);
      window.removeEventListener('mosaicflow:updateEdge', handleUpdateEdge as EventListener);
    };
  });
</script>

<!-- This component renders nothing, it just bridges SvelteFlow functions to the global scope -->
