<!--
  EmbedNode - Utility Category

  Shows a live, read-only view of a node that lives elsewhere (usually on another canvas),
  referenced like a wikilink: "Node title" or "Canvas name#Node title".
-->
<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import { extractWikilinks } from '@mosaicflow/vault-core';
  import { Link2, ExternalLink, Unlink } from 'lucide-svelte';
  import { workspace, knowledge, openNode } from '@mosaicflow/node-sdk/store';
  import { nodeRegistry } from '@mosaicflow/node-sdk/registry';
  import { renderMarkdown } from '@mosaicflow/node-sdk';
  import type { EmbedNodeData } from './types';

  type EmbedNodeType = Node<EmbedNodeData, 'embed'>;
  let { data, selected, id }: NodeProps<EmbedNodeType> = $props();

  const ref = $derived((data.ref ?? '').trim());
  const link = $derived(ref ? extractWikilinks(`[[${ref}]]`)[0] : undefined);
  const target = $derived(link ? knowledge.index.resolve(link) : null);
  const isSelf = $derived(target?.id === id);

  const body = $derived.by(() => {
    if (!target || isSelf) return { kind: 'none' as const };
    const d = target.data;
    const field = nodeRegistry.getBodyMapping(target.type).field;
    if (target.type === 'code' && typeof d.code === 'string') return { kind: 'code' as const, text: d.code };
    if (typeof d[field] === 'string' && d[field]) return { kind: 'md' as const, html: renderMarkdown(String(d[field])) };
    const rest = target.text.startsWith(target.title) ? target.text.slice(target.title.length) : target.text;
    return { kind: 'md' as const, html: renderMarkdown(rest.trim()) };
  });

  let editing = $state(false);
  let draft = $state('');

  function startEdit() {
    draft = ref;
    editing = true;
  }

  function commit() {
    editing = false;
    const next = draft.trim();
    if (next !== ref) workspace.updateNodeData(id, { ref: next, title: next ? `Embed: ${next}` : 'Embed' });
  }
</script>

<NodeResizer
  minWidth={220}
  minHeight={120}
  isVisible={selected ?? false}
  lineStyle="border-color: #6366f1"
  handleStyle="background: #6366f1; width: 8px; height: 8px; border-radius: 2px;"
/>

<div
  class="embed-node"
  class:selected
  style="border-color: {data.borderColor || '#4f46e5'}; background: {data.color || '#14152b'}; color: {data.textColor || '#e0e0e0'};"
>
  <div class="embed-header">
    <Link2 size={13} />
    {#if editing}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="ref-input nodrag"
        bind:value={draft}
        onblur={commit}
        onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') editing = false; }}
        placeholder="Node title or Canvas#Title"
        autofocus
      />
    {:else if target}
      <button class="source nodrag" ondblclick={startEdit} onclick={() => openNode(target.canvasId, target.id)} title="Open the original (double-click to change)">
        <span class="canvas">{target.canvasName}</span>
        <span class="sep">›</span>
        <span class="title">{target.title || target.id}</span>
        <ExternalLink size={11} />
      </button>
    {:else}
      <button class="source missing nodrag" onclick={startEdit} title="Choose the node to embed">
        {ref ? `Not found: ${ref}` : 'Click to choose a node…'}
      </button>
    {/if}
  </div>

  <div class="embed-body">
    {#if isSelf}
      <p class="hint">An embed cannot show itself.</p>
    {:else if !target}
      <p class="hint"><Unlink size={12} /> Type a node title (or Canvas name#Title) to embed it here.</p>
    {:else if body.kind === 'code'}
      <pre class="code">{body.text}</pre>
    {:else if body.kind === 'md'}
      <div class="markdown-content">{@html body.html}</div>
    {/if}
  </div>
</div>

<Handle type="target" position={Position.Left} id="left-target" />
<Handle type="source" position={Position.Left} id="left-source" />
<Handle type="target" position={Position.Right} id="right-target" />
<Handle type="source" position={Position.Right} id="right-source" />
<Handle type="target" position={Position.Top} id="top-target" />
<Handle type="source" position={Position.Top} id="top-source" />
<Handle type="target" position={Position.Bottom} id="bottom-target" />
<Handle type="source" position={Position.Bottom} id="bottom-source" />

<style>
  .embed-node {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    border: 1px dashed;
    border-radius: 10px;
    overflow: hidden;
    font-family: var(--mf-font-mono);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .embed-node.selected {
    outline: 1px solid #6366f1;
    outline-offset: 1px;
  }

  .embed-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
    font-size: 11px;
    min-height: 30px;
  }

  .source {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .source .canvas {
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .source .title {
    color: #e0e7ff;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    max-width: 70%;
  }

  .source.missing {
    color: #fca5a5;
  }

  .ref-input {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(99, 102, 241, 0.5);
    border-radius: 4px;
    color: #e0e7ff;
    font: inherit;
    padding: 2px 6px;
    outline: none;
  }

  .embed-body {
    flex: 1;
    overflow: auto;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.5;
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #8b8fb8;
    font-size: 11.5px;
  }

  .code {
    margin: 0;
    font-size: 11.5px;
    white-space: pre;
    color: #d4d4f5;
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3) {
    font-size: 1.15em;
    margin: 0 0 0.4em;
  }

  .markdown-content :global(p),
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 0 0 0.5em;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    padding-left: 1.3em;
  }
</style>
