<!--
  OrganizationNode - Entity Category
  
  Company/organization profile.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { OrganizationNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Building, Globe, MapPin, Users } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type OrgNodeType = Node<OrganizationNodeData, 'organization'>;

  let { data, selected, id }: NodeProps<OrgNodeType> = $props();

  function updateField(field: keyof OrganizationNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="organization" class="org-node">
  {#snippet header()}
    <span class="node-icon"><Building size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.name || data.title}</span>
  {/snippet}
  
  <div class="org-logo-section">
    {#if data.logo}
      <img src={data.logo} alt={data.name} class="org-logo" />
    {:else}
      <div class="org-logo-placeholder">
        <Building size={24} strokeWidth={1.5} />
      </div>
    {/if}
  </div>
  
  <NodeField 
    label="Name"
    value={data.name || ''}
    placeholder="Organization name"
    oninput={(v) => updateField('name', v)}
  />
  
  <NodeField 
    label="Industry"
    value={data.industry || ''}
    placeholder="Industry/sector"
    oninput={(v) => updateField('industry', v)}
  />
  
  <div class="org-info">
    {#if data.website}
      <div class="info-item">
        <Globe size={12} strokeWidth={1.5} />
        <a href={data.website} target="_blank" rel="noopener noreferrer">{data.website}</a>
      </div>
    {/if}
    {#if data.location}
      <div class="info-item">
        <MapPin size={12} strokeWidth={1.5} />
        <span>{data.location}</span>
      </div>
    {/if}
    {#if data.size}
      <div class="info-item">
        <Users size={12} strokeWidth={1.5} />
        <span>{data.size} employees</span>
      </div>
    {/if}
  </div>
  
  {#if data.description}
    <div class="org-description">{data.description}</div>
  {/if}
</NodeWrapper>

<style>
  .org-logo-section {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }

  .org-logo {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    object-fit: contain;
    background: white;
    padding: 4px;
  }

  .org-logo-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  .org-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    font-size: 11px;
    color: #888;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info-item a {
    color: #60a5fa;
    text-decoration: none;
  }

  .info-item a:hover {
    text-decoration: underline;
  }

  .org-description {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 11px;
    color: #999;
    line-height: 1.4;
  }
</style>
