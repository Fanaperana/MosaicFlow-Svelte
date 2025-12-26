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
    class="icon-btn"
    class:active
    class:danger={variant === 'danger'}
    class:success={variant === 'success'}
    {disabled}
    {onclick}
    type="button"
  >
    <Icon {size} />
  </button>
</SimpleTooltip>

<style>
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #8b949e;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover:not(:disabled) {
    background: #21262d;
    color: #c9d1d9;
    border-color: #8b949e;
  }

  .icon-btn.active {
    background: rgba(56, 139, 253, 0.15);
    border-color: #58a6ff;
    color: #58a6ff;
  }

  .icon-btn.danger:hover:not(:disabled) {
    background: rgba(248, 81, 73, 0.15);
    border-color: #f85149;
    color: #f85149;
  }

  .icon-btn.success:hover:not(:disabled) {
    background: rgba(63, 185, 80, 0.15);
    border-color: #3fb950;
    color: #3fb950;
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
