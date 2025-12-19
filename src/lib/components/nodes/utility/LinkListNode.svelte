<!--
  LinkListNode - Utility Category
  
  Curated collection of links.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { LinkListNodeData, LinkItem } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { List, Plus, Trash2, ExternalLink, GripVertical } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type LinkListNodeType = Node<LinkListNodeData, 'linkList'>;

  let { data, selected, id }: NodeProps<LinkListNodeType> = $props();
  
  let links = $state<LinkItem[]>([]);
  
  $effect(() => {
    links = data.links || [];
  });

  function addLink() {
    const newLinks = [...links, { id: crypto.randomUUID(), url: '', label: '' }];
    workspace.updateNodeData(id, { links: newLinks });
  }

  function updateLink(index: number, field: 'url' | 'label', value: string) {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    workspace.updateNodeData(id, { links: newLinks });
  }

  function removeLink(index: number) {
    const newLinks = links.filter((_, i) => i !== index);
    workspace.updateNodeData(id, { links: newLinks });
  }

  function openLink(url: string) {
    if (url) {
      window.open(url, '_blank');
    }
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="linkList" class="link-list-node">
  {#snippet header()}
    <span class="node-icon"><List size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <button class="node-action-btn" onclick={addLink} title="Add link">
      <Plus size={14} strokeWidth={1.5} />
    </button>
  {/snippet}
  
  <div class="links-container">
    {#if links.length === 0}
      <div class="empty-state">
        No links yet. Click + to add one.
      </div>
    {:else}
      {#each links as link, i (link.id)}
        <div class="link-item">
          <div class="link-grip">
            <GripVertical size={12} />
          </div>
          <div class="link-fields">
            <input
              type="text"
              class="link-label-input nodrag"
              value={link.label}
              placeholder="Label"
              oninput={(e) => updateLink(i, 'label', (e.target as HTMLInputElement).value)}
            />
            <input
              type="url"
              class="link-url-input nodrag"
              value={link.url}
              placeholder="https://..."
              oninput={(e) => updateLink(i, 'url', (e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="link-actions">
            {#if link.url}
              <button class="link-action-btn" onclick={() => openLink(link.url)}>
                <ExternalLink size={12} />
              </button>
            {/if}
            <button class="link-action-btn danger" onclick={() => removeLink(i)}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
  
  {#if links.length > 0}
    <div class="link-count">
      {links.length} link{links.length !== 1 ? 's' : ''}
    </div>
  {/if}
</NodeWrapper>

<style>
  .links-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .empty-state {
    padding: 16px;
    text-align: center;
    color: #666;
    font-size: 11px;
    border: 1px dashed #444;
    border-radius: 4px;
  }

  .link-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
  }

  .link-grip {
    color: #444;
    cursor: grab;
    padding-top: 4px;
  }

  .link-fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .link-label-input,
  .link-url-input {
    width: 100%;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #333;
    border-radius: 3px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
  }

  .link-label-input:focus,
  .link-url-input:focus {
    border-color: #3b82f6;
  }

  .link-url-input {
    font-family: monospace;
    font-size: 10px;
    color: #60a5fa;
  }

  .link-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .link-action-btn {
    padding: 4px;
    background: transparent;
    border: 1px solid #444;
    border-radius: 3px;
    color: #888;
    cursor: pointer;
  }

  .link-action-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #e0e0e0;
  }

  .link-action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .link-count {
    margin-top: 8px;
    font-size: 10px;
    color: #666;
    text-align: right;
  }
</style>
