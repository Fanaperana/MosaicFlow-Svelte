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

<div class="border-b border-[#21262d] last:border-b-0">
  <button 
    class="flex items-center gap-1.5 w-full px-2.5 py-1.5 bg-transparent border-none text-[#c9d1d9] text-[11px] font-semibold uppercase tracking-wide text-left {collapsible ? 'cursor-pointer hover:bg-[#161b22]' : 'cursor-default'}"
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
    <span class="flex-1">{title}</span>
  </button>
  
  {#if open || !collapsible}
    <div class="flex flex-col gap-1.5 px-2.5 pb-2">
      {@render children()}
    </div>
  {/if}
</div>
