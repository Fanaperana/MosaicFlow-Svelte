<!--
  AnnotationNode - Utility Category
  
  Canvas annotations and callouts.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { AnnotationNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { MessageSquare, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-svelte';
  import { NodeWrapper } from '../_shared';

  type AnnotationNodeType = Node<AnnotationNodeData, 'annotation'>;

  let { data, selected, id }: NodeProps<AnnotationNodeType> = $props();
  
  let content = $state('');
  
  $effect(() => {
    content = data.content || '';
  });

  const annotationTypes = [
    { value: 'note', label: 'Note', icon: MessageSquare, color: '#3b82f6' },
    { value: 'info', label: 'Info', icon: Info, color: '#06b6d4' },
    { value: 'warning', label: 'Warning', icon: AlertTriangle, color: '#f59e0b' },
    { value: 'error', label: 'Error', icon: AlertCircle, color: '#ef4444' },
    { value: 'success', label: 'Success', icon: CheckCircle, color: '#22c55e' },
  ];

  function updateType(type: string) {
    workspace.updateNodeData(id, { annotationType: type });
  }

  function handleContentChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    content = target.value;
    workspace.updateNodeData(id, { content });
  }

  const currentType = $derived(annotationTypes.find(t => t.value === (data.annotationType || 'note')) || annotationTypes[0]);
  const CurrentTypeIcon = $derived(currentType.icon);
</script>

<NodeWrapper {data} {selected} {id} nodeType="annotation" class="annotation-node">
  {#snippet header()}
    <span class="node-icon" style="color: {currentType.color}">
      <CurrentTypeIcon size={14} strokeWidth={1.5} />
    </span>
    <span class="node-title">{currentType.label}</span>
  {/snippet}
  
  <div class="type-selector">
    {#each annotationTypes as type}
      {@const TypeIcon = type.icon}
      <button
        class="type-btn nodrag"
        class:selected={data.annotationType === type.value || (!data.annotationType && type.value === 'note')}
        style="--type-color: {type.color}"
        onclick={() => updateType(type.value)}
        title={type.label}
      >
        <TypeIcon size={14} strokeWidth={1.5} />
      </button>
    {/each}
  </div>
  
  <div class="annotation-content" style="--accent-color: {currentType.color}">
    <div class="accent-bar"></div>
    <textarea
      class="content-input nodrag nowheel"
      value={content}
      placeholder="Add annotation..."
      oninput={handleContentChange}
    ></textarea>
  </div>
  
  {#if data.author}
    <div class="annotation-author">— {data.author}</div>
  {/if}
</NodeWrapper>

<style>
  .type-selector {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }

  .type-btn {
    padding: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #333;
    border-radius: 4px;
    color: #666;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .type-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--type-color);
  }

  .type-btn.selected {
    background: color-mix(in srgb, var(--type-color) 10%, transparent);
    border-color: var(--type-color);
    color: var(--type-color);
  }

  .annotation-content {
    position: relative;
    display: flex;
    padding-left: 12px;
  }

  .accent-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--accent-color);
    border-radius: 2px;
  }

  .content-input {
    flex: 1;
    min-height: 60px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 12px;
    line-height: 1.5;
    resize: none;
    outline: none;
  }

  .content-input::placeholder {
    color: #555;
  }

  .annotation-author {
    margin-top: 8px;
    font-size: 10px;
    color: #666;
    font-style: italic;
    text-align: right;
  }
</style>
