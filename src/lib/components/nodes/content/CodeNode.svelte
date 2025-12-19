<!--
  CodeNode - Content Category
  
  Syntax-highlighted code blocks.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { CodeNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Code, Copy } from 'lucide-svelte';
  import { NodeWrapper } from '../_shared';

  type CodeNodeType = Node<CodeNodeData, 'code'>;

  let { data, selected, id }: NodeProps<CodeNodeType> = $props();
  
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

<NodeWrapper {data} {selected} {id} nodeType="code" class="code-node">
  {#snippet header()}
    <span class="node-icon"><Code size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <select class="language-select nodrag" value={language} onchange={handleLanguageChange}>
      {#each languages as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>
    <button class="node-action-btn" onclick={copyCode} title="Copy code">
      <Copy size={14} strokeWidth={1.5} />
    </button>
  {/snippet}
  
  <textarea
    class="code-editor nodrag nowheel"
    value={code}
    oninput={handleCodeChange}
    placeholder="// Enter your code here..."
    spellcheck="false"
  ></textarea>
</NodeWrapper>

<style>
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

  .code-editor {
    width: 100%;
    height: 100%;
    min-height: 120px;
    background: transparent;
    border: none;
    color: #79c0ff;
    font-size: 12px;
    font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
    resize: none;
    outline: none;
    line-height: 1.5;
    tab-size: 2;
  }

  .code-editor::placeholder {
    color: #555;
  }
</style>
