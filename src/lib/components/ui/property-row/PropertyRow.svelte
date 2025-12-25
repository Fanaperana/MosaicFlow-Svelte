<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    children: Snippet;
    inline?: boolean;
    muted?: boolean;
  }

  let { 
    label,
    children,
    inline = false,
    muted = false
  }: Props = $props();
</script>

<div class="property-row" class:inline>
  {#if label}
    <label class="row-label" class:muted>{label}</label>
  {/if}
  <div class="row-content">
    {@render children()}
  </div>
</div>

<style>
  .property-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .property-row.inline {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .row-label {
    font-size: 11px;
    color: #8b949e;
    min-width: 70px;
  }

  .row-label.muted {
    color: #6e7681;
  }

  .row-content {
    flex: 1;
    display: flex;
    gap: 6px;
  }

  .property-row.inline .row-content {
    justify-content: flex-end;
  }
</style>
