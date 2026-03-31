<script lang="ts">
  import type { Component } from 'svelte';
  import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';

  interface Props {
    icon: Component<{ size?: number }>;
    label: string;
    onclick?: () => void;
    active?: boolean;
    disabled?: boolean;
    variant?: 'default' | 'danger' | 'success';
    size?: number;
  }

  let {
    icon: Icon,
    label,
    onclick,
    active = false,
    disabled = false,
    variant = 'default',
    size = 14
  }: Props = $props();
</script>

<SimpleTooltip text={label} position="bottom">
  <button 
    class="flex items-center justify-center size-6 p-0 bg-[#161b22] border border-[#30363d] rounded text-[#8b949e] cursor-pointer transition-all duration-150 ease-in-out hover:not-disabled:bg-[#21262d] hover:not-disabled:text-[#c9d1d9] hover:not-disabled:border-[#8b949e] disabled:opacity-50 disabled:cursor-not-allowed {active ? 'bg-[rgba(56,139,253,0.15)] border-[#58a6ff] text-[#58a6ff]' : ''} {variant === 'danger' ? 'hover:not-disabled:bg-[rgba(248,81,73,0.15)] hover:not-disabled:border-[#f85149] hover:not-disabled:text-[#f85149]' : ''} {variant === 'success' ? 'hover:not-disabled:bg-[rgba(63,185,80,0.15)] hover:not-disabled:border-[#3fb950] hover:not-disabled:text-[#3fb950]' : ''}"
    {disabled}
    {onclick}
    type="button"
  >
    <Icon {size} />
  </button>
</SimpleTooltip>
