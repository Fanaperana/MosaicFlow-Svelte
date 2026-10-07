<!-- Callout: an emoji and a short highlighted markdown block (tip, warning, ...). Double-click to edit. -->
<script lang="ts">
  import { tick } from 'svelte';
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import NodeWrapper from '../_shared/NodeWrapper.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { renderMarkdown } from '@mosaicflow/node-sdk';
  import type { BaseNodeData } from '$lib/types';

  type Tone = 'note' | 'info' | 'tip' | 'warning' | 'danger';
  type CalloutData = BaseNodeData & { icon?: string; content?: string; tone?: Tone };

  const TONES: Record<Tone, { icon: string; accent: string }> = {
    note: { icon: '📝', accent: '#9ca3af' },
    info: { icon: 'ℹ️', accent: '#5b8def' },
    tip: { icon: '💡', accent: '#22c55e' },
    warning: { icon: '⚠️', accent: '#f59e0b' },
    danger: { icon: '🛑', accent: '#ef4444' },
  };

  let { data, selected, id }: NodeProps<Node<CalloutData, 'callout'>> = $props();

  let editing = $state(false);
  let editor = $state<HTMLTextAreaElement>();

  let tone = $derived(TONES[data.tone ?? 'tip'] ?? TONES.tip);
  let html = $derived(renderMarkdown(data.content ?? ''));

  async function startEdit() {
    editing = true;
    await tick();
    editor?.focus();
  }

  function cycleTone() {
    const keys = Object.keys(TONES) as Tone[];
    const next = keys[(keys.indexOf(data.tone ?? 'tip') + 1) % keys.length];
    workspace.updateNodeData(id, { tone: next, icon: TONES[next].icon });
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="callout">
  <div class="callout" style="--accent: {tone.accent}">
    <button class="icon nodrag" onclick={cycleTone} title="Change callout type">{data.icon || tone.icon}</button>
    {#if editing}
      <textarea
        bind:this={editor}
        class="editor nodrag nowheel"
        value={data.content ?? ''}
        placeholder="Write something worth highlighting…"
        oninput={(e) => workspace.updateNodeData(id, { content: (e.target as HTMLTextAreaElement).value })}
        onblur={() => (editing = false)}
        onkeydown={(e) => e.key === 'Escape' && (editing = false)}
      ></textarea>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="body markdown-content" ondblclick={startEdit}>
        {#if html}
          {@html html}
        {:else}
          <p class="placeholder">Double-click to write a callout…</p>
        {/if}
      </div>
    {/if}
  </div>
</NodeWrapper>

<style>
  .callout {
    display: flex;
    gap: 10px;
    height: 100%;
    padding: 10px 12px;
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    font-size: 13px;
    line-height: 1.5;
  }

  .icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    font-size: 16px;
    line-height: 24px;
  }

  .icon:hover {
    background: var(--mf-hover);
  }

  .body {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }

  .body :global(p) {
    margin: 0 0 6px;
  }

  .placeholder {
    color: var(--mf-text-3);
  }

  .editor {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    resize: none;
    outline: none;
  }
</style>
