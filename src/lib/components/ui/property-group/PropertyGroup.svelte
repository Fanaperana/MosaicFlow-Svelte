<script lang="ts">
  import { ChevronRight } from 'lucide-svelte';
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

<section class="group">
  <button class="group-header" class:collapsible onclick={toggle} type="button" aria-expanded={open}>
    <span class="title">{title}</span>
    {#if collapsible}
      <span class="chevron" class:open><ChevronRight size={12} /></span>
    {/if}
  </button>
  
  {#if open || !collapsible}
    <div class="group-body">
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .group {
    padding: 6px 0;
    border-top: 1px solid var(--mf-border);
  }

  .group:first-of-type {
    border-top: none;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 24px;
    padding: 0 6px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--mf-text-3);
    font-size: 11.5px;
    font-weight: 500;
    text-align: left;
    cursor: default;
  }

  .group-header.collapsible {
    cursor: pointer;
  }

  .group-header.collapsible:hover {
    background: var(--mf-hover);
    color: var(--mf-text-2);
  }

  .title {
    flex: 1;
  }

  .chevron {
    display: flex;
    opacity: 0;
    transition: transform 0.12s, opacity 0.12s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .group-header:hover .chevron,
  .chevron:not(.open) {
    opacity: 1;
  }

  .group-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 2px;
  }
</style>
