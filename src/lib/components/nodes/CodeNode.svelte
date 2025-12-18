<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { CodeNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Code, Copy } from 'lucide-svelte';

  type CodeNode = Node<CodeNodeData, 'code'>;

  let { data, selected, id }: NodeProps<CodeNode> = $props();
  
  let code = $state('');
  let language = $state('javascript');
  
  $effect(() => {
    code = data.code || '';
    language = data.language || 'javascript';
  });

  const languages = [
    'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'c', 'cpp',
    'csharp', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'sql', 'html',
    'css', 'json', 'yaml', 'xml', 'markdown', 'bash', 'powershell', 'dockerfile'
  ];

  // Border styling
  const borderWidth = $derived((data.borderWidth as number) ?? 1);
  const borderStyle = $derived((data.borderStyle as string) ?? 'solid');
  const borderRadius = $derived((data.borderRadius as number) ?? 4);
  const bgOpacity = $derived((data.bgOpacity as number) ?? 1);

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
  const backgroundColor = $derived(hexToRgba(data.color || '#0d1117', bgOpacity));

  function handleCodeChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    code = target.value;
    workspace.updateNodeData(id, { code });
  }

  function handleLanguageChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    language = target.value;
    workspace.updateNodeData(id, { language });
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
  }
</script>

<NodeResizer 
  minWidth={300} 
  minHeight={200} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="code-node"
  class:selected
  style="
    background: {backgroundColor};
    border-color: {data.borderColor || '#333'};
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
    color: {data.textColor || '#e0e0e0'};
  "
>
  <div class="node-header">
    <span class="node-icon"><Code size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    <select 
      class="language-select nodrag"
      value={language}
      onchange={handleLanguageChange}
    >
      {#each languages as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>
    <button class="copy-btn" onclick={copyCode} title="Copy code"><Copy size={14} strokeWidth={1.5} /></button>
  </div>
  
  <div class="node-content">
    <textarea
      class="code-editor nodrag nowheel"
      value={code}
      oninput={handleCodeChange}
      placeholder="// Enter your code here..."
      spellcheck="false"
    ></textarea>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .code-node {
    min-width: 300px;
    min-height: 200px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .code-node.selected {
    border-color: #3b82f6;
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
    font-size: 14px;
  }

  .node-title {
    font-weight: 600;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .language-select {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
    cursor: pointer;
  }

  .language-select:focus {
    border-color: #3b82f6;
  }

  .copy-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .node-content {
    flex: 1;
    overflow: hidden;
    display: flex;
  }

  .code-editor {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    color: #79c0ff;
    font-size: 12px;
    font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
    padding: 12px;
    resize: none;
    outline: none;
    line-height: 1.5;
    tab-size: 2;
  }

  .code-editor::placeholder {
    color: #555;
  }
</style>
