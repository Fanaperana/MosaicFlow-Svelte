<!--
  IframeNode - Content Category
  
  Embedded web content via iframe.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { IframeNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Globe, ExternalLink, RefreshCw } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type IframeNodeType = Node<IframeNodeData, 'iframe'>;

  let { data, selected, id }: NodeProps<IframeNodeType> = $props();
  
  let iframeRef: HTMLIFrameElement | null = $state(null);

  function handleUrlChange(value: string) {
    workspace.updateNodeData(id, { url: value });
  }

  function openExternal() {
    if (data.url) {
      window.open(data.url, '_blank');
    }
  }

  function refresh() {
    if (iframeRef) {
      iframeRef.src = iframeRef.src;
    }
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="iframe" class="iframe-node">
  {#snippet header()}
    <span class="node-icon"><Globe size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <button class="node-action-btn" onclick={refresh} title="Refresh">
      <RefreshCw size={14} strokeWidth={1.5} />
    </button>
    {#if data.url}
      <button class="node-action-btn primary" onclick={openExternal} title="Open in browser">
        <ExternalLink size={14} strokeWidth={1.5} />
      </button>
    {/if}
  {/snippet}
  
  <NodeField 
    label="URL"
    type="url"
    value={data.url || ''}
    placeholder="https://..."
    oninput={handleUrlChange}
  />
  
  <div class="iframe-container">
    {#if data.url}
      <iframe
        bind:this={iframeRef}
        src={data.url}
        title={data.title}
        sandbox="allow-scripts allow-same-origin allow-forms"
        loading="lazy"
      ></iframe>
    {:else}
      <div class="placeholder">Enter a URL to embed content</div>
    {/if}
  </div>
</NodeWrapper>

<style>
  .iframe-container {
    flex: 1;
    min-height: 150px;
    margin-top: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
  }

  .iframe-container iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    font-size: 12px;
  }
</style>
