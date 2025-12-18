<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { IframeNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Globe, ExternalLink, RefreshCw, Maximize2, AlertTriangle } from 'lucide-svelte';
  import { openUrl } from '@tauri-apps/plugin-opener';

  type IframeNode = Node<IframeNodeData, 'iframe'>;

  let { data, selected, id }: NodeProps<IframeNode> = $props();
  
  let url = $state('');
  let isLoading = $state(false);
  let hasError = $state(false);
  let loadTimeout: ReturnType<typeof setTimeout> | null = null;
  let iframeRef: HTMLIFrameElement | null = $state(null);
  
  $effect(() => {
    url = data.url || '';
  });

  function handleUrlChange(e: Event) {
    const target = e.target as HTMLInputElement;
    url = target.value;
  }

  function handleUrlSubmit(e: Event) {
    e.preventDefault();
    let finalUrl = url.trim();
    
    // Add https if no protocol
    if (finalUrl && !finalUrl.match(/^https?:\/\//i)) {
      finalUrl = 'https://' + finalUrl;
    }
    
    workspace.updateNodeData(id, { url: finalUrl });
    hasError = false;
    isLoading = true;
    
    // Set a timeout to detect if iframe fails silently (X-Frame-Options)
    if (loadTimeout) clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      // If still loading after 10 seconds, likely blocked
      if (isLoading) {
        isLoading = false;
        // Don't show error automatically, let user see if it loads
      }
    }, 10000);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleUrlSubmit(e);
    }
  }

  function refreshIframe() {
    if (iframeRef && data.url) {
      isLoading = true;
      hasError = false;
      // Force reload by resetting src
      const currentSrc = iframeRef.src;
      iframeRef.src = '';
      setTimeout(() => {
        if (iframeRef) iframeRef.src = currentSrc;
      }, 50);
    }
  }

  async function openInBrowser() {
    if (data.url) {
      try {
        await openUrl(data.url);
      } catch {
        // Fallback to window.open
        window.open(data.url, '_blank');
      }
    }
  }

  function handleIframeLoad() {
    isLoading = false;
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
  }

  function handleIframeError() {
    isLoading = false;
    hasError = true;
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
  }

  const displayUrl = $derived(() => {
    try {
      const parsed = new URL(data.url || '');
      return parsed.hostname;
    } catch {
      return data.url || 'No URL';
    }
  });

  // Border styling
  const borderWidth = $derived((data.borderWidth as number) ?? 1);
  const borderStyle = $derived((data.borderStyle as string) ?? 'solid');
  const borderRadius = $derived((data.borderRadius as number) ?? 4);
  const bgOpacity = $derived((data.bgOpacity as number) ?? 1);

  function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return hex;
  }
  const backgroundColor = $derived(hexToRgba(data.color || '#1a1d21', bgOpacity));
</script>

<NodeResizer 
  minWidth={300} 
  minHeight={200} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="iframe-node"
  class:selected
  style="
    background: {backgroundColor};
    border-color: {data.borderColor || '#333'};
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
    color: {data.textColor || '#e0e0e0'};
  "
>
  <div class="node-header">
    <span class="node-icon"><Globe size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title || displayUrl()}</span>
    <div class="header-actions">
      {#if data.url}
        <button class="action-btn" onclick={refreshIframe} title="Refresh">
          <RefreshCw size={12} strokeWidth={1.5} class={isLoading ? 'spinning' : ''} />
        </button>
        <button class="action-btn" onclick={openInBrowser} title="Open in browser">
          <ExternalLink size={12} strokeWidth={1.5} />
        </button>
      {/if}
    </div>
  </div>
  
  <div class="node-content">
    {#if data.url}
      <div class="iframe-container" class:loading={isLoading} class:error={hasError}>
        {#if isLoading}
          <div class="loading-overlay">
            <RefreshCw size={24} class="spinning" />
            <span>Loading...</span>
          </div>
        {/if}
        {#if hasError}
          <div class="error-overlay">
            <Globe size={32} />
            <span>Unable to load page</span>
            <span class="error-hint">This site blocks iframe embedding</span>
            <button class="retry-btn" onclick={openInBrowser}>Open in browser</button>
          </div>
        {:else}
          <iframe
            bind:this={iframeRef}
            src={data.url}
            title={data.title || 'Embedded content'}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="lazy"
            onload={handleIframeLoad}
            onerror={handleIframeError}
            class="nodrag nowheel"
          ></iframe>
        {/if}
      </div>
    {:else}
      <div class="url-input-container">
        <Globe size={32} strokeWidth={1} />
        <p>Embed a webpage</p>
        <form onsubmit={handleUrlSubmit} class="url-form">
          <input 
            type="text" 
            class="url-input nodrag"
            placeholder="e.g., wikipedia.org, youtube.com/embed/..."
            value={url}
            oninput={handleUrlChange}
            onkeydown={handleKeyDown}
          />
          <button type="submit" class="submit-btn">
            <Maximize2 size={14} />
            Embed
          </button>
        </form>
        <p class="embed-hint">
          <AlertTriangle size={12} />
          <span>Some sites block embedding. Use embed URLs when available.</span>
        </p>
      </div>
    {/if}
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .iframe-node {
    min-width: 300px;
    min-height: 200px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .iframe-node.selected {
    border-color: #3b82f6 !important;
  }

  .node-header {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .node-icon {
    display: flex;
    align-items: center;
    opacity: 0.7;
  }

  .node-title {
    font-weight: 600;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    padding: 4px;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .node-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 150px;
  }

  .iframe-container {
    flex: 1;
    position: relative;
    background: #0d1117;
  }

  .iframe-container.loading iframe {
    opacity: 0.3;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
  }

  .loading-overlay,
  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(13, 17, 23, 0.9);
    color: #888;
    font-size: 12px;
  }

  .error-hint {
    font-size: 10px;
    color: #666;
  }

  .retry-btn {
    margin-top: 8px;
    padding: 6px 12px;
    background: #3b82f6;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 11px;
    cursor: pointer;
  }

  .retry-btn:hover {
    background: #2563eb;
  }

  .url-input-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    height: 100%;
    text-align: center;
    gap: 12px;
    color: #666;
  }

  .url-input-container p {
    margin: 0;
    font-size: 13px;
    color: #888;
  }

  .url-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 280px;
  }

  .url-input {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 12px;
    outline: none;
    text-align: center;
  }

  .url-input:focus {
    border-color: #3b82f6;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .submit-btn:hover {
    background: #2563eb;
  }

  .embed-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 8px 12px;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 6px;
    font-size: 10px;
    color: #fbbf24;
  }

  .embed-hint span {
    opacity: 0.9;
  }

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
