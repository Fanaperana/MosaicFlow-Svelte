<!-- Checklist: tasks with checkboxes. Enter adds a task, Backspace on an empty task removes it. -->
<script lang="ts">
  import { tick } from 'svelte';
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import { Plus, X } from 'lucide-svelte';
  import NodeWrapper from '../_shared/NodeWrapper.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import type { BaseNodeData } from '$lib/types';

  interface ChecklistItem {
    id: string;
    text: string;
    done: boolean;
  }

  type ChecklistData = BaseNodeData & { items?: ChecklistItem[]; hideDone?: boolean };
  let { data, selected, id }: NodeProps<Node<ChecklistData, 'checklist'>> = $props();

  let list = $state<HTMLDivElement>();

  let items = $derived(data.items ?? []);
  let doneCount = $derived(items.filter((i) => i.done).length);
  let visible = $derived(data.hideDone ? items.filter((i) => !i.done) : items);

  function save(next: ChecklistItem[]) {
    workspace.updateNodeData(id, { items: next });
  }

  async function focusItem(itemId: string, atEnd = true) {
    await tick();
    const input = list?.querySelector<HTMLInputElement>(`input[data-item="${itemId}"]`);
    input?.focus();
    if (input && atEnd) input.setSelectionRange(input.value.length, input.value.length);
  }

  function addAfter(index: number) {
    const item = { id: crypto.randomUUID(), text: '', done: false };
    save([...items.slice(0, index + 1), item, ...items.slice(index + 1)]);
    focusItem(item.id);
  }

  function patch(itemId: string, changes: Partial<ChecklistItem>) {
    save(items.map((i) => (i.id === itemId ? { ...i, ...changes } : i)));
  }

  function remove(itemId: string) {
    const index = items.findIndex((i) => i.id === itemId);
    save(items.filter((i) => i.id !== itemId));
    const previous = items[index - 1];
    if (previous) focusItem(previous.id);
  }

  function handleKey(e: KeyboardEvent, item: ChecklistItem) {
    const index = items.findIndex((i) => i.id === item.id);
    if (e.key === 'Enter') {
      e.preventDefault();
      addAfter(index);
    } else if (e.key === 'Backspace' && item.text === '') {
      e.preventDefault();
      remove(item.id);
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      focusItem(items[index - 1].id);
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      focusItem(items[index + 1].id);
    }
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="checklist">
  <div class="checklist" bind:this={list}>
    {#if items.length > 0}
      <div class="progress" title="{doneCount} of {items.length} done">
        <div class="bar"><div class="fill" style="width: {(doneCount / items.length) * 100}%"></div></div>
        <span>{doneCount}/{items.length}</span>
      </div>
    {/if}

    {#each visible as item (item.id)}
      <div class="item" class:done={item.done}>
        <input
          type="checkbox"
          class="check nodrag"
          checked={item.done}
          onchange={(e) => patch(item.id, { done: (e.target as HTMLInputElement).checked })}
          aria-label="Done"
        />
        <input
          class="text nodrag"
          data-item={item.id}
          value={item.text}
          placeholder="To-do"
          oninput={(e) => patch(item.id, { text: (e.target as HTMLInputElement).value })}
          onkeydown={(e) => handleKey(e, item)}
        />
        <button class="remove nodrag" onclick={() => remove(item.id)} aria-label="Remove task"><X size={12} /></button>
      </div>
    {/each}

    <button class="add nodrag" onclick={() => addAfter(items.length - 1)}>
      <Plus size={13} /><span>{items.length ? 'Add task' : 'Add your first task'}</span>
    </button>
  </div>
</NodeWrapper>

<style>
  .checklist {
    display: flex;
    flex-direction: column;
    gap: 1px;
    height: 100%;
    overflow-y: auto;
    font-size: 13px;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px 6px;
    font-size: 11px;
    color: var(--mf-text-3);
    font-variant-numeric: tabular-nums;
  }

  .bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--mf-active);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: #22c55e;
    transition: width 0.2s;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 0 4px;
    border-radius: 4px;
  }

  .item:hover {
    background: var(--mf-hover);
  }

  .check {
    appearance: none;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    margin: 0;
    padding: 0;
    border: 1.5px solid var(--mf-text-3);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }

  .check:checked {
    border-color: #22c55e;
    background: #22c55e;
  }

  .check:checked::after {
    content: '';
    width: 7px;
    height: 4px;
    border-left: 1.5px solid #fff;
    border-bottom: 1.5px solid #fff;
    transform: translateY(-1px) rotate(-45deg);
  }

  .text {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
  }

  .item.done .text {
    color: var(--mf-text-3);
    text-decoration: line-through;
  }

  .remove {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    opacity: 0;
  }

  .item:hover .remove,
  .item:focus-within .remove {
    opacity: 1;
  }

  .remove:hover {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .add {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 4px;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    font-size: 12.5px;
    text-align: left;
  }

  .add:hover {
    background: var(--mf-hover);
    color: var(--mf-text-2);
  }
</style>
