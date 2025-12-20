<!--
  NodeHandles Component
  
  Standard handle configuration for nodes.
  All nodes get the same 4 handles by default.
  Each position has both source and target handles for flexible connections.
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
  <Handle type="target" position={Position.Left} id="left-target" />
  <Handle type="source" position={Position.Left} id="left-source" />
{/if}
{#if showRight}
  <Handle type="target" position={Position.Right} id="right-target" />
  <Handle type="source" position={Position.Right} id="right-source" />
{/if}
{#if showTop}
  <Handle type="target" position={Position.Top} id="top-target" />
  <Handle type="source" position={Position.Top} id="top-source" />
{/if}
{#if showBottom}
  <Handle type="target" position={Position.Bottom} id="bottom-target" />
  <Handle type="source" position={Position.Bottom} id="bottom-source" />
{/if}
