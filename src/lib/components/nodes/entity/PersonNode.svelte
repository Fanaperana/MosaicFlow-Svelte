<!--
  PersonNode - Entity Category
  
  Profile information for persons/contacts.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { PersonNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { User, Mail, Phone, Building } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type PersonNodeType = Node<PersonNodeData, 'person'>;

  let { data, selected, id }: NodeProps<PersonNodeType> = $props();

  function updateField(field: keyof PersonNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="person" class="person-node">
  {#snippet header()}
    <span class="node-icon"><User size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.name || data.title}</span>
  {/snippet}
  
  <div class="avatar-section">
    {#if data.avatar}
      <img src={data.avatar} alt={data.name} class="avatar-img" />
    {:else}
      <div class="avatar-placeholder">
        <User size={24} strokeWidth={1.5} />
      </div>
    {/if}
  </div>
  
  <NodeField 
    label="Name"
    value={data.name || ''}
    placeholder="Full name"
    oninput={(v) => updateField('name', v)}
  />
  
  <NodeField 
    label="Role"
    value={data.role || ''}
    placeholder="Job title / role"
    oninput={(v) => updateField('role', v)}
  />
  
  <div class="contact-info">
    {#if data.email}
      <div class="contact-item">
        <Mail size={12} strokeWidth={1.5} />
        <span>{data.email}</span>
      </div>
    {/if}
    {#if data.phone}
      <div class="contact-item">
        <Phone size={12} strokeWidth={1.5} />
        <span>{data.phone}</span>
      </div>
    {/if}
    {#if data.organization}
      <div class="contact-item">
        <Building size={12} strokeWidth={1.5} />
        <span>{data.organization}</span>
      </div>
    {/if}
  </div>
  
  {#if data.notes}
    <div class="notes">{data.notes}</div>
  {/if}
</NodeWrapper>

<style>
  .avatar-section {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }

  .avatar-img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  .contact-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    font-size: 11px;
    color: #888;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .notes {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 11px;
    color: #999;
  }
</style>
