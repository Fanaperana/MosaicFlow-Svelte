<!--
  CodeNode - Content Category
  
  Syntax-highlighted code blocks using CodeMirror.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { CodeNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Code, Copy, Check } from 'lucide-svelte';
  import { NodeWrapper } from '../_shared';
  import { CodeEditor } from '$lib/components/editor';

  type CodeNodeType = Node<CodeNodeData, 'code'>;

  let { data, selected, id }: NodeProps<CodeNodeType> = $props();
  
  let code = $state('');
  let language = $state('javascript');
  let copied = $state(false);
  
  $effect(() => {
    code = data.code || '';
    language = data.language || 'javascript';
  });

  const languages = [
    'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'c', 'cpp',
    'csharp', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'sql', 'html',
    'css', 'json', 'yaml', 'xml', 'markdown', 'bash', 'shell', 'dockerfile'
  ];

  function handleCodeChange(newCode: string) {
    code = newCode;
    workspace.updateNodeData(id, { code: newCode });
  }

  function handleLanguageChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    language = target.value;
    workspace.updateNodeData(id, { language });
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
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
    <button class="node-action-btn" class:copied onclick={copyCode} title="Copy code">
      {#if copied}
        <Check size={14} strokeWidth={1.5} />
      {:else}
        <Copy size={14} strokeWidth={1.5} />
      {/if}
    </button>
  {/snippet}
  
  <div class="code-editor-wrapper nodrag nowheel">
    <CodeEditor 
      value={code}
      {language}
      onChange={handleCodeChange}
      placeholder="// Enter your code here..."
    />
  </div>
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

  .code-editor-wrapper {
    width: 100%;
    height: 100%;
    min-height: 120px;
  }

  .code-editor-wrapper :global(.code-editor-container) {
    min-height: 120px;
  }

  .code-editor-wrapper :global(.cm-editor) {
    min-height: 120px;
    background: transparent;
  }

  .node-action-btn.copied {
    color: #22c55e;
  }
</style>
