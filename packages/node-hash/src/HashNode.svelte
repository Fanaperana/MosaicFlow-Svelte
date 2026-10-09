<!--
  HashNode - Data Category
  
  Cryptographic hash display (MD5, SHA, etc).
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { HashNodeData } from './types';
  import { workspace } from '@mosaicflow/node-sdk/store';
  import { Hash, Copy, CheckCircle, XCircle } from 'lucide-svelte';
  import { NodeWrapper } from '@mosaicflow/node-sdk';

  type HashNodeType = Node<HashNodeData, 'hash'>;

  let { data, selected, id }: NodeProps<HashNodeType> = $props();
  
  let copied = $state(false);

  const hashTypes = ['md5', 'sha1', 'sha256', 'sha512', 'other'];

  // Older nodes stored the hash as `value`, the algorithm as `type` and the verdict as `status`.
  const hashValue = $derived(data.hash || data.value || '');
  const algorithm = $derived((data.algorithm || data.type || 'sha256').toLowerCase());
  const threat = $derived(data.threatLevel || (data.status === 'clean' ? 'safe' : data.status));

  function update(patch: Partial<HashNodeData>) {
    workspace.updateNodeData(id, patch);
  }

  function copyHash() {
    if (hashValue) {
      navigator.clipboard.writeText(hashValue);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }

  const hashLength = $derived(hashValue.length);
</script>

<NodeWrapper {data} {selected} {id} nodeType="hash" class="hash-node">
  {#snippet header()}
    <span class="node-icon"><Hash size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title || algorithm.toUpperCase()}</span>
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
      value={hashTypes.includes(algorithm) ? algorithm : 'other'}
      onchange={(e) => update({ algorithm: (e.target as HTMLSelectElement).value as HashNodeData['algorithm'], type: undefined })}
    >
      {#each hashTypes as type (type)}
        <option value={type}>{type.toUpperCase()}</option>
      {/each}
    </select>
  </div>
  
  <div class="hash-value-wrapper">
    <textarea
      class="hash-value nodrag nowheel"
      value={hashValue}
      placeholder="Enter hash value..."
      oninput={(e) => update({ hash: (e.target as HTMLTextAreaElement).value, value: undefined })}
      spellcheck="false"
    ></textarea>
    <span class="char-count">{hashLength} chars</span>
  </div>
  
  {#if threat && threat !== 'unknown'}
    <div class="hash-status" class:malicious={threat === 'malicious'} class:clean={threat === 'safe'}>
      {#if threat === 'malicious'}
        <XCircle size={12} />
      {:else if threat === 'safe'}
        <CheckCircle size={12} />
      {/if}
      <span>{threat}</span>
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
