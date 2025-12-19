<!--
  ActionNode - Utility Category
  
  Action item/task with status.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { ActionNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Zap, CheckCircle, Circle, Clock, XCircle } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type ActionNodeType = Node<ActionNodeData, 'action'>;

  let { data, selected, id }: NodeProps<ActionNodeType> = $props();

  const statuses = [
    { value: 'pending', label: 'Pending', icon: Circle, color: '#888' },
    { value: 'in-progress', label: 'In Progress', icon: Clock, color: '#f59e0b' },
    { value: 'completed', label: 'Completed', icon: CheckCircle, color: '#22c55e' },
    { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: '#ef4444' },
  ];

  const priorities = ['low', 'medium', 'high', 'critical'];

  function updateField(field: keyof ActionNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function toggleStatus() {
    const currentIdx = statuses.findIndex(s => s.value === (data.status || 'pending'));
    const nextIdx = (currentIdx + 1) % statuses.length;
    workspace.updateNodeData(id, { status: statuses[nextIdx].value });
  }

  const currentStatus = $derived(statuses.find(s => s.value === (data.status || 'pending')) || statuses[0]);
  
  const priorityColor = $derived(() => {
    const colors: Record<string, string> = {
      low: '#22c55e',
      medium: '#f59e0b',
      high: '#f97316',
      critical: '#ef4444',
    };
    return colors[data.priority || 'medium'] || '#888';
  });
  
  // Current status icon for rendering
  const StatusIcon = $derived(currentStatus.icon);
</script>

<NodeWrapper {data} {selected} {id} nodeType="action" class="action-node">
  {#snippet header()}
    <span class="node-icon"><Zap size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  {#snippet headerActions()}
    <button 
      class="status-toggle nodrag" 
      onclick={toggleStatus}
      style="color: {currentStatus.color}"
      title="Toggle status"
    >
      <StatusIcon size={14} strokeWidth={1.5} />
    </button>
  {/snippet}
  
  <div class="status-badge" style="--status-color: {currentStatus.color}">
    <StatusIcon size={12} />
    <span>{currentStatus.label}</span>
  </div>
  
  <NodeField 
    label="Action"
    value={data.action || ''}
    placeholder="What needs to be done?"
    oninput={(v) => updateField('action', v)}
  />
  
  <div class="priority-section">
    <span class="section-label">Priority</span>
    <div class="priority-options">
      {#each priorities as priority}
        <button
          class="priority-btn nodrag"
          class:selected={data.priority === priority}
          onclick={() => updateField('priority', priority)}
        >
          {priority}
        </button>
      {/each}
    </div>
  </div>
  
  {#if data.assignee}
    <div class="assignee">
      <span class="label">Assignee:</span>
      <span class="value">{data.assignee}</span>
    </div>
  {/if}
  
  {#if data.dueDate}
    <div class="due-date">
      <Clock size={11} />
      <span>Due: {data.dueDate}</span>
    </div>
  {/if}
  
  {#if data.notes}
    <div class="action-notes">{data.notes}</div>
  {/if}
</NodeWrapper>

<style>
  .status-toggle {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    font-size: 11px;
    color: var(--status-color);
    margin-bottom: 10px;
  }

  .priority-section {
    margin-top: 10px;
  }

  .section-label {
    display: block;
    font-size: 10px;
    color: #888;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .priority-options {
    display: flex;
    gap: 4px;
  }

  .priority-btn {
    flex: 1;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #333;
    border-radius: 4px;
    color: #888;
    font-size: 10px;
    text-transform: capitalize;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .priority-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: #444;
  }

  .priority-btn.selected {
    background: rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
    color: #60a5fa;
  }

  .assignee {
    margin-top: 10px;
    font-size: 11px;
    color: #888;
  }

  .assignee .label {
    color: #666;
  }

  .due-date {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 10px;
    color: #f59e0b;
  }

  .action-notes {
    margin-top: 10px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 11px;
    color: #999;
    line-height: 1.4;
  }
</style>
