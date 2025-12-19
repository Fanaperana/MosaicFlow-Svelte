<!--
  DomainNode - OSINT Category
  
  Domain/IP information for OSINT research.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { DomainNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Globe, Shield, Server, Clock } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type DomainNodeType = Node<DomainNodeData, 'domain'>;

  let { data, selected, id }: NodeProps<DomainNodeType> = $props();

  function updateField(field: keyof DomainNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  const isSecure = $derived(data.protocol === 'https');
</script>

<NodeWrapper {data} {selected} {id} nodeType="domain" class="domain-node">
  {#snippet header()}
    <span class="node-icon"><Globe size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.domain || data.title}</span>
  {/snippet}
  
  <div class="domain-status" class:secure={isSecure}>
    <Shield size={12} strokeWidth={1.5} />
    <span>{isSecure ? 'HTTPS' : 'HTTP'}</span>
  </div>
  
  <NodeField 
    label="Domain"
    value={data.domain || ''}
    placeholder="example.com"
    oninput={(v) => updateField('domain', v)}
  />
  
  <div class="domain-details">
    {#if data.ip}
      <div class="detail-item">
        <Server size={12} strokeWidth={1.5} />
        <span>IP: {data.ip}</span>
      </div>
    {/if}
    {#if data.registrar}
      <div class="detail-item">
        <span>Registrar: {data.registrar}</span>
      </div>
    {/if}
    {#if data.created}
      <div class="detail-item">
        <Clock size={12} strokeWidth={1.5} />
        <span>Created: {data.created}</span>
      </div>
    {/if}
    {#if data.expires}
      <div class="detail-item">
        <Clock size={12} strokeWidth={1.5} />
        <span>Expires: {data.expires}</span>
      </div>
    {/if}
  </div>
  
  {#if data.nameservers && data.nameservers.length > 0}
    <div class="nameservers">
      <span class="label">Nameservers</span>
      {#each data.nameservers as ns}
        <span class="ns-item">{ns}</span>
      {/each}
    </div>
  {/if}
</NodeWrapper>

<style>
  .domain-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    font-size: 10px;
    color: #ef4444;
    margin-bottom: 8px;
  }

  .domain-status.secure {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .domain-details {
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
  }

  .nameservers {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
  }

  .nameservers .label {
    display: block;
    font-size: 10px;
    color: #666;
    margin-bottom: 4px;
  }

  .ns-item {
    display: block;
    font-size: 11px;
    font-family: monospace;
    color: #60a5fa;
  }
</style>
