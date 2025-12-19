<!--
  HashNode - OSINT Category
  
  Cryptographic hash display (MD5, SHA, etc).
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { HashNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Hash, Copy, CheckCircle, XCircle } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type HashNodeType = Node<HashNodeData, 'hash'>;

  let { data, selected, id }: NodeProps<HashNodeType> = $props();
  
  let copied = $state(false);

  const hashTypes = ['MD5', 'SHA1', 'SHA256', 'SHA512', 'SSDEEP', 'TLSH'];

  function updateField(field: keyof HashNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function copyHash() {
    if (data.value) {
      navigator.clipboard.writeText(data.value);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }

  const hashLength = $derived(data.value?.length ?? 0);
</script>

<NodeWrapper {data} {selected} {id} nodeType="hash" class="hash-node">
  {#snippet header()}
    <span class="node-icon"><Hash size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.type || 'Hash'}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <button class="node-action-btn" onclick={copyHash} title="Copy hash">
      {#if copied}
        <CheckCircle size={14} strokeWidth={1.5} />
      {:else}
        <Copy size={14} strokeWidth={1.5} />
      {/if}
    </button>
  {/snippet}
  
  <div class="hash-type-select">
    <select 
      class="type-select nodrag"
      value={data.type || 'SHA256'}
      onchange={(e) => updateField('type', (e.target as HTMLSelectElement).value)}
    >
      {#each hashTypes as type}
        <option value={type}>{type}</option>
      {/each}
    </select>
  </div>
  
  <div class="hash-value-wrapper">
    <textarea
      class="hash-value nodrag nowheel"
      value={data.value || ''}
      placeholder="Enter hash value..."
      oninput={(e) => updateField('value', (e.target as HTMLTextAreaElement).value)}
      spellcheck="false"
    ></textarea>
    <span class="char-count">{hashLength} chars</span>
  </div>
  
  {#if data.status}
    <div class="hash-status" class:malicious={data.status === 'malicious'} class:clean={data.status === 'clean'}>
      {#if data.status === 'malicious'}
        <XCircle size={12} />
      {:else if data.status === 'clean'}
        <CheckCircle size={12} />
      {/if}
      <span>{data.status}</span>
    </div>
  {/if}
  
  {#if data.source}
    <div class="hash-source">Source: {data.source}</div>
  {/if}
</NodeWrapper>

<style>
  .hash-type-select {
    margin-bottom: 8px;
  }

  .type-select {
    width: 100%;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 12px;
    outline: none;
    cursor: pointer;
  }

  .hash-value-wrapper {
    position: relative;
  }

  .hash-value {
    width: 100%;
    min-height: 60px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #333;
    border-radius: 4px;
    color: #f0f0f0;
    font-size: 11px;
    font-family: 'Fira Code', monospace;
    resize: none;
    outline: none;
    word-break: break-all;
  }

  .char-count {
    position: absolute;
    bottom: 4px;
    right: 8px;
    font-size: 9px;
    color: #555;
  }

  .hash-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.05);
    color: #888;
  }

  .hash-status.malicious {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .hash-status.clean {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .hash-source {
    margin-top: 8px;
    font-size: 10px;
    color: #666;
  }
</style>
