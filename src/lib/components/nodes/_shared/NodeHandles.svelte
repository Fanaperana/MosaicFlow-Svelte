<!--
  NodeHandles Component
  
  Standard handle configuration for nodes.
  All nodes get the same 4 handles by default.
-->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  interface Props {
    showLeft?: boolean;
    showRight?: boolean;
    showTop?: boolean;
    showBottom?: boolean;
  }

  let {
    showLeft = true,
    showRight = true,
    showTop = true,
    showBottom = true
  }: Props = $props();
</script>

{#if showLeft}
  <Handle type="target" position={Position.Left} id="left" />
{/if}
{#if showRight}
  <Handle type="source" position={Position.Right} id="right" />
{/if}
{#if showTop}
  <Handle type="target" position={Position.Top} id="top" />
{/if}
{#if showBottom}
  <Handle type="source" position={Position.Bottom} id="bottom" />
{/if}
