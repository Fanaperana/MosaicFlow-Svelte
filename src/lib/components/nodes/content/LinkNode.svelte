<!--
  LinkNode - Content Category
  
  Web URLs with descriptions and preview.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { LinkNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Link, ExternalLink } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type LinkNodeType = Node<LinkNodeData, 'link'>;

  let { data, selected, id }: NodeProps<LinkNodeType> = $props();

  const displayUrl = $derived(() => {
    try {
      const parsed = new URL(data.url || '');
      return parsed.hostname;
    } catch {
      return data.url || 'No URL';
    }
  });

  function updateField(field: keyof LinkNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openLink() {
    if (data.url) {
      window.open(data.url, '_blank');
    }
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="link">
  {#snippet header()}
    <span class="node-icon"><Link size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    {#if data.url}
      <button class="node-action-btn primary" onclick={openLink} title="Open link">
        <ExternalLink size={14} strokeWidth={1.5} />
      </button>
    {/if}
  {/snippet}
  
  <NodeField 
    label="URL"
    type="url"
    value={data.url || ''}
    placeholder="https://..."
    oninput={(v) => updateField('url', v)}
  />
  
  <NodeField 
    label="Description"
    value={data.description || ''}
    placeholder="Link description..."
    oninput={(v) => updateField('description', v)}
  />
  
  {#if data.url}
    <div class="link-preview">
      <span class="link-display">{displayUrl()}</span>
    </div>
  {/if}
</NodeWrapper>

<style>
  .link-preview {
    margin-top: 8px;
    padding: 6px 8px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
    font-size: 11px;
  }

  .link-display {
    color: #60a5fa;
  }
</style>
