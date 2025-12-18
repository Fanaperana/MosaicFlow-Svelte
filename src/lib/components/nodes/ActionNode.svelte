<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/svelte';
  import type { ActionNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { CheckSquare } from 'lucide-svelte';

  type ActionNode = Node<ActionNodeData, 'action'>;

  let { data, selected, id }: NodeProps<ActionNode> = $props();

  function updateField(field: keyof ActionNodeData, value: unknown) {
    workspace.updateNodeData(id, { [field]: value });
  }

  const statusColors: Record<string, string> = {
    pending: '#888',
    'in-progress': '#f59e0b',
    completed: '#10b981',
    cancelled: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  const priorityColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };

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
  const backgroundColor = $derived(hexToRgba(data.color || '#1a1d21', bgOpacity));
</script>

<NodeResizer 
  minWidth={220} 
  minHeight={140} 
  isVisible={selected ?? false}
  lineStyle="border-color: #3b82f6"
  handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div 
  class="action-node"
  class:selected
  class:completed={data.status === 'completed'}
  class:cancelled={data.status === 'cancelled'}
  style="
    background: {backgroundColor};
    border-color: {data.borderColor || '#333'};
    border-width: {borderWidth}px;
    border-style: {borderStyle};
    border-radius: {borderRadius}px;
    color: {data.textColor || '#e0e0e0'};
  "
>
  <div class="node-header" style="border-left: 3px solid {statusColors[data.status || 'pending']}">
    <span class="node-icon"><CheckSquare size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
    {#if data.priority}
      <span class="priority-badge" style="background: {priorityColors[data.priority]}">
        {data.priority.toUpperCase()}
      </span>
    {/if}
  </div>
  
  <div class="node-content">
    <div class="action-input">
      <textarea 
        class="nodrag nowheel"
        value={data.action || ''}
        oninput={(e) => updateField('action', (e.target as HTMLTextAreaElement).value)}
        placeholder="Describe the action..."
      ></textarea>
    </div>

    <div class="fields">
      <div class="field-row">
        <div class="field">
          <span class="label">Status</span>
          <select 
            class="nodrag"
            value={data.status || 'pending'}
            onchange={(e) => updateField('status', (e.target as HTMLSelectElement).value)}
          >
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="field">
          <span class="label">Priority</span>
          <select 
            class="nodrag"
            value={data.priority || 'medium'}
            onchange={(e) => updateField('priority', (e.target as HTMLSelectElement).value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <span class="label">Due Date</span>
          <input 
            type="date" 
            class="nodrag"
            value={data.dueDate || ''}
            oninput={(e) => updateField('dueDate', (e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="field">
          <span class="label">Assignee</span>
          <input 
            type="text" 
            class="nodrag"
            value={data.assignee || ''}
            oninput={(e) => updateField('assignee', (e.target as HTMLInputElement).value)}
            placeholder="Name"
          />
        </div>
      </div>
    </div>
  </div>
</div>

<Handle type="target" position={Position.Left} id="left" />
<Handle type="source" position={Position.Right} id="right" />
<Handle type="target" position={Position.Top} id="top" />
<Handle type="source" position={Position.Bottom} id="bottom" />

<style>
  .action-node {
    min-width: 220px;
    min-height: 140px;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .action-node.selected {
    border-color: #3b82f6;
  }

  .action-node.completed {
    opacity: 0.7;
  }

  .action-node.completed .action-input textarea {
    text-decoration: line-through;
    color: #666;
  }

  .action-node.cancelled {
    opacity: 0.5;
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

  .priority-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
  }

  .node-content {
    padding: 12px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-input textarea {
    width: 100%;
    min-height: 50px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #333;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 12px;
    line-height: 1.4;
    outline: none;
    resize: none;
    font-family: inherit;
  }

  .action-input textarea:focus {
    border-color: #3b82f6;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-row {
    display: flex;
    gap: 8px;
  }

  .field-row .field {
    flex: 1;
  }

  .label {
    font-size: 10px;
    text-transform: uppercase;
    color: #666;
    letter-spacing: 0.5px;
  }

  .field input,
  .field select {
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    outline: none;
  }

  .field input:focus,
  .field select:focus {
    border-color: #3b82f6;
  }
</style>
