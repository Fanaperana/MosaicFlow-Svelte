<!--
  NoteNode - Content Category
  
  Markdown-supported text notes with edit/view mode.
-->
<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { NoteNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { StickyNote, Check, Pencil } from 'lucide-svelte';
  import { RichMarkdownEditor } from '$lib/components/editor';
  import { marked } from 'marked';
  import { hexToRgba } from '../_shared/utils';

  type NoteNodeType = Node<NoteNodeData, 'note'>;

  let { data, selected, id }: NodeProps<NoteNodeType> = $props();
  
  let content = $state('');
  
  // Header is hidden by default
  const showHeader = $derived(data.showHeader ?? false);
  
  // View mode: 'edit' shows editor, 'view' shows rendered content
  // Default to 'view' on load so users see content, not placeholder
  const viewMode = $derived(data.viewMode ?? 'view');
  
  // Check if node is locked
  const isLocked = $derived(data.locked ?? false);

  // Border styling
  const borderWidth = $derived((data.borderWidth as number) ?? 1);
  const borderStyle = $derived((data.borderStyle as string) ?? 'solid');
  const borderRadius = $derived((data.borderRadius as number) ?? 4);
  const bgOpacity = $derived((data.bgOpacity as number) ?? 1);
  
  $effect(() => {
    content = data.content || '';
  });

  // Track previous selected state to detect deselection
  let wasSelected = $state(false);
  
  // Switch to view mode when node is deselected
  $effect(() => {
    if (wasSelected && !selected && viewMode === 'edit') {
      // Node was deselected while in edit mode - switch to view
      workspace.updateNodeData(id, { content, viewMode: 'view' });
    }
    wasSelected = selected ?? false;
  });

  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Render markdown content
  const renderedHtml = $derived.by(() => {
    if (!content) return '';
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  });
  
  function toggleEdit() {
    if (viewMode === 'edit') {
      workspace.updateNodeData(id, { content, viewMode: 'view' });
    } else {
      workspace.updateNodeData(id, { viewMode: 'edit' });
    }
  }

  function handleContentChange(newContent: string) {
    content = newContent;
    workspace.updateNodeData(id, { content: newContent });
  }

  function handleDoubleClick() {
    if (viewMode === 'view') {
      workspace.updateNodeData(id, { viewMode: 'edit' });
    }
  }

  const backgroundColor = $derived(hexToRgba(data.color || '#1a1d21', bgOpacity));
</script>

<NodeResizer 
  minWidth={200} 
  minHeight={120} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="note-node"
  class:selected
  class:no-header={!showHeader}
  class:locked={isLocked}
  style="
    background: {backgroundColor}; 
    border-color: {data.borderColor || '#333'}; 
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
    color: {data.textColor || '#e0e0e0'};
  "
>
  {#if showHeader}
    <div class="node-header">
      <span class="node-icon"><StickyNote size={14} strokeWidth={1.5} /></span>
      <span class="node-title">{data.title}</span>
      <button class="edit-btn" onclick={toggleEdit} title={viewMode === 'edit' ? 'View' : 'Edit'}>
        {#if viewMode === 'edit'}
          <Check size={14} strokeWidth={1.5} />
        {:else}
          <Pencil size={14} strokeWidth={1.5} />
        {/if}
      </button>
    </div>
  {/if}
  
  <div class="node-content">
    {#if viewMode === 'edit'}
      <div class="editor-wrapper">
        <RichMarkdownEditor
          value={content}
          onChange={handleContentChange}
          placeholder="Write markdown here..."
          autoFocus
        />
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="note-preview" ondblclick={handleDoubleClick}>
        {#if content}
          <div class="markdown-content">
            {@html renderedHtml}
          </div>
        {:else}
          <span class="placeholder">Double-click to edit...</span>
        {/if}
      </div>
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
  .note-node {
    min-width: 200px;
    min-height: 120px;
    width: 100%;
    height: 100%;
    font-family: 'Space Mono', monospace;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .note-node.selected:not(.customizing) {
    outline: 1px solid #3b82f6;
    outline-offset: 1px;
  }

  .note-node.locked {
    opacity: 0.9;
  }

  .note-node.no-header .node-content {
    padding-top: 8px;
  }

  .node-header {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .node-icon {
    display: flex;
    align-items: center;
    color: #888;
  }

  .node-title {
    font-weight: 600;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .edit-btn {
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .node-content {
    flex: 1;
    overflow: hidden;
    display: flex;
  }

  .editor-wrapper {
    width: 100%;
    height: 100%;
  }

  .note-preview {
    padding: 12px;
    width: 100%;
    height: 100%;
    overflow: auto;
    cursor: text;
  }

  .markdown-content {
    font-size: 12px;
    line-height: 1.6;
  }

  .markdown-content :global(h1) {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 8px 0;
  }

  .markdown-content :global(h2) {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 6px 0;
  }

  .markdown-content :global(h3) {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px 0;
  }

  .markdown-content :global(strong) {
    font-weight: 700;
  }

  .markdown-content :global(em) {
    font-style: italic;
  }

  .markdown-content :global(code) {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
  }

  .markdown-content :global(a) {
    color: #58a6ff;
    text-decoration: none;
  }

  .markdown-content :global(a:hover) {
    text-decoration: underline;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 8px 0;
    padding-left: 24px;
  }

  .markdown-content :global(ul) {
    list-style-type: disc;
  }

  .markdown-content :global(ul ul) {
    list-style-type: circle;
  }

  .markdown-content :global(ul ul ul) {
    list-style-type: square;
  }

  .markdown-content :global(ol) {
    list-style-type: decimal;
  }

  .markdown-content :global(li) {
    margin: 4px 0;
    display: list-item;
  }

  .markdown-content :global(li::marker) {
    color: #888;
  }

  .markdown-content :global(li > ul),
  .markdown-content :global(li > ol) {
    margin: 4px 0;
  }

  .markdown-content :global(blockquote) {
    margin: 8px 0;
    padding-left: 12px;
    border-left: 3px solid #58a6ff;
    color: #8b949e;
    font-style: italic;
  }

  .markdown-content :global(pre) {
    background: rgba(0, 0, 0, 0.3);
    padding: 8px 12px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .markdown-content :global(pre code) {
    background: none;
    padding: 0;
  }

  .markdown-content :global(hr) {
    border: none;
    border-top: 1px solid #30363d;
    margin: 12px 0;
  }

  .markdown-content :global(p) {
    margin: 0 0 8px 0;
  }

  .markdown-content :global(p:last-child) {
    margin-bottom: 0;
  }

  /* Task list (checkboxes) */
  .markdown-content :global(input[type="checkbox"]) {
    margin-right: 6px;
    accent-color: #3b82f6;
  }

  .markdown-content :global(li:has(input[type="checkbox"])) {
    list-style-type: none;
    margin-left: -20px;
  }

  /* Tables */
  .markdown-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 11px;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    border: 1px solid #30363d;
    padding: 6px 8px;
    text-align: left;
  }

  .markdown-content :global(th) {
    background: rgba(255, 255, 255, 0.05);
    font-weight: 600;
  }

  .markdown-content :global(tr:nth-child(even)) {
    background: rgba(255, 255, 255, 0.02);
  }

  /* Images */
  .markdown-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 8px 0;
  }

  .placeholder {
    color: #666;
    font-style: italic;
    font-size: 12px;
  }
</style>
