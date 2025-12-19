<!--
  RouterNode - OSINT Category
  
  Network router/device information.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { RouterNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Router, Wifi, Signal, Network } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type RouterNodeType = Node<RouterNodeData, 'router'>;

  let { data, selected, id }: NodeProps<RouterNodeType> = $props();

  function updateField(field: keyof RouterNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  const statusColor = $derived(() => {
    if (data.status === 'online') return '#22c55e';
    if (data.status === 'offline') return '#ef4444';
    return '#f59e0b';
  });
</script>

<NodeWrapper {data} {selected} {id} nodeType="router" class="router-node">
  {#snippet header()}
    <span class="node-icon"><Router size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.name || data.title}</span>
  {/snippet}
  
  <div class="router-status" style="--status-color: {statusColor()}">
    <div class="status-dot"></div>
    <span>{data.status || 'unknown'}</span>
  </div>
  
  <div class="router-icon">
    <Router size={32} strokeWidth={1} />
  </div>
  
  <NodeField 
    label="Name"
    value={data.name || ''}
    placeholder="Device name"
    oninput={(v) => updateField('name', v)}
  />
  
  <div class="router-details">
    {#if data.ip}
      <div class="detail-item">
        <Network size={12} />
        <span>{data.ip}</span>
      </div>
    {/if}
    {#if data.mac}
      <div class="detail-item">
        <span>MAC: {data.mac}</span>
      </div>
    {/if}
    {#if data.vendor}
      <div class="detail-item">
        <span>Vendor: {data.vendor}</span>
      </div>
    {/if}
    {#if data.model}
      <div class="detail-item">
        <span>Model: {data.model}</span>
      </div>
    {/if}
  </div>
  
  {#if data.ports && data.ports.length > 0}
    <div class="open-ports">
      <span class="label">Open Ports</span>
      <div class="ports-list">
        {#each data.ports as port}
          <span class="port-tag">{port}</span>
        {/each}
      </div>
    </div>
  {/if}
</NodeWrapper>

<style>
  .router-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 11px;
    text-transform: capitalize;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-color);
    box-shadow: 0 0 6px var(--status-color);
  }

  .router-icon {
    display: flex;
    justify-content: center;
    padding: 12px;
    color: #666;
  }

  .router-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    font-size: 11px;
    color: #888;
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: monospace;
  }

  .open-ports {
    margin-top: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
  }

  .open-ports .label {
    display: block;
    font-size: 10px;
    color: #666;
    margin-bottom: 6px;
  }

  .ports-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .port-tag {
    padding: 2px 6px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 3px;
    font-size: 10px;
    font-family: monospace;
    color: #60a5fa;
  }
</style>
