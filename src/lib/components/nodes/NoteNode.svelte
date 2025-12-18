<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { NoteNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { StickyNote, Check, Pencil } from 'lucide-svelte';
  import { RichMarkdownEditor } from '$lib/components/editor';
  import { marked } from 'marked';

  type NoteNode = Node<NoteNodeData, 'note'>;

  let { data, selected, id }: NodeProps<NoteNode> = $props();
  
  let content = $state('');
  
  // Header is hidden by default
  let showHeader = $derived(data.showHeader ?? false);
  
  // View mode: 'edit' shows editor, 'view' shows rendered content
  let viewMode = $derived(data.viewMode ?? 'edit');
  
  // Check if node is locked
  let isLocked = $derived(data.locked ?? false);

  // Border styling
  let borderWidth = $derived((data.borderWidth as number) ?? 1);
  let borderStyle = $derived((data.borderStyle as string) ?? 'solid');
  let borderRadius = $derived((data.borderRadius as number) ?? 4);
  let bgOpacity = $derived((data.bgOpacity as number) ?? 1);
  
  $effect(() => {
    content = data.content || '';
  });

  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Render markdown content
  let renderedHtml = $derived.by(() => {
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && viewMode === 'edit') {
      workspace.updateNodeData(id, { content, viewMode: 'view' });
    }
    e.stopPropagation();
  }

  function handleBlur() {
    // Auto-switch to view mode when editor loses focus
    if (viewMode === 'edit' && content) {
      workspace.updateNodeData(id, { content, viewMode: 'view' });
    }
  }

  function handleDoubleClick() {
    if (viewMode === 'view') {
      workspace.updateNodeData(id, { viewMode: 'edit' });
    }
  }

  // Compute background with opacity
  function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return hex;
  }

  let backgroundColor = $derived(hexToRgba(data.color || '#1a1d21', bgOpacity));
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
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="editor-wrapper" onblur={handleBlur}>
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

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .note-node {
    /* Border properties set via inline styles for customization */
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
    margin: 4px 0;
    padding-left: 20px;
  }

  .markdown-content :global(li) {
    margin: 2px 0;
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

  .placeholder {
    color: #666;
    font-style: italic;
    font-size: 12px;
  }
</style>
