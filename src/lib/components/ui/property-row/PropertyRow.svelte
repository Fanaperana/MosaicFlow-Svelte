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

<div class="flex {inline ? 'flex-row items-center gap-2' : 'flex-col gap-1'}">
  {#if label}
    <span class="text-[11px] min-w-17.5 {muted ? 'text-[#6e7681]' : 'text-[#8b949e]'}">{label}</span>
  {/if}
  <div class="flex-1 flex gap-1.5 {inline ? 'justify-end' : ''}">
    {@render children()}
  </div>
</div>
