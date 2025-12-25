<script lang="ts">
  import { ChevronDown, ChevronRight } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    open?: boolean;
    children: Snippet;
    collapsible?: boolean;
  }

  let { 
    title, 
    open = $bindable(true),
    children,
    collapsible = true
  }: Props = $props();

  function toggle() {
    if (collapsible) {
      open = !open;
    }
  }
</script>

<div class="property-group">
  <button 
    class="group-header"
    class:collapsible
    onclick={toggle}
    type="button"
  >
    {#if collapsible}
      {#if open}
        <ChevronDown size={12} />
      {:else}
        <ChevronRight size={12} />
      {/if}
    {/if}
    <span class="group-title">{title}</span>
  </button>
  
  {#if open || !collapsible}
    <div class="group-content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .property-group {
    border-bottom: 1px solid #21262d;
  }

  .property-group:last-child {
    border-bottom: none;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: #c9d1d9;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: left;
    cursor: default;
  }

  .group-header.collapsible {
    cursor: pointer;
  }

  .group-header.collapsible:hover {
    background: #161b22;
  }

  .group-title {
    flex: 1;
  }

  .group-content {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
