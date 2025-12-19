<!--
  NodeHeader Component
  
  Reusable header component for nodes.
  Provides consistent header styling with icon, title, and optional actions.
-->
<script lang="ts">
  import type { Snippet, Component } from 'svelte';

  interface Props {
    title: string;
    icon?: Component;
    iconSize?: number;
    actions?: Snippet;
    class?: string;
  }

  let { 
    title, 
    icon: Icon,
    iconSize = 14,
    actions,
    class: className = ''
  }: Props = $props();
</script>

<div class="node-header {className}">
  {#if Icon}
    <span class="node-icon">
      <Icon size={iconSize} strokeWidth={1.5} />
    </span>
  {/if}
  <span class="node-title">{title}</span>
  {#if actions}
    {@render actions()}
  {/if}
</div>
