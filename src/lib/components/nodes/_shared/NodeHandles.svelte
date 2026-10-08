<!--
  NodeHandles Component

  The four connection points (a source and a target per side) every node gets.
  xyflow's <Handle> is a full reactive component; with eight per node, big pages spent most of their
  mount time on handles. Until the pointer first enters the node we render plain elements with the
  same classes and data attributes, which is all xyflow needs to place edge ends and accept drops.
  The real handles (needed to start a connection) take over on first hover.
-->
<script lang="ts">
  import { Handle, Position, useStore } from '@xyflow/svelte';

  interface Props {
    /** Node id; enables the lightweight placeholders. Without it the real handles render directly. */
    nodeId?: string;
    showLeft?: boolean;
    showRight?: boolean;
    showTop?: boolean;
    showBottom?: boolean;
    class?: string;
  }

  let {
    nodeId,
    showLeft = true,
    showRight = true,
    showTop = true,
    showBottom = true,
    class: className = '',
  }: Props = $props();

  const store = useStore();

  let sides = $derived(
    [
      showLeft && Position.Left,
      showRight && Position.Right,
      showTop && Position.Top,
      showBottom && Position.Bottom,
    ].filter((p): p is Position => !!p)
  );

  let active = $state(false);
  let anchor = $state<HTMLElement>();

  $effect(() => {
    if (active || !nodeId) return;
    const node = anchor?.closest('.svelte-flow__node');
    if (!node) return;
    const activate = () => (active = true);
    node.addEventListener('pointerenter', activate);
    return () => node.removeEventListener('pointerenter', activate);
  });
</script>

{#if active || !nodeId}
  {#each sides as side (side)}
    <Handle type="target" position={side} id="{side}-target" class={className} />
    <Handle type="source" position={side} id="{side}-source" class={className} />
  {/each}
{:else}
  <span class="handles-anchor" bind:this={anchor} aria-hidden="true"></span>
  {#each sides as side (side)}
    {#each ['target', 'source'] as type (type)}
      <div
        data-handleid="{side}-{type}"
        data-nodeid={nodeId}
        data-handlepos={side}
        data-id="{store.flowId}-{nodeId}-{side}-{type}-{type}"
        class={[
          'svelte-flow__handle',
          `svelte-flow__handle-${side}`,
          store.noDragClass,
          store.noPanClass,
          side,
          type,
          className,
          store.nodesConnectable && 'connectablestart connectableend connectable connectionindicator',
        ]}
        aria-hidden="true"
      ></div>
    {/each}
  {/each}
{/if}

<style>
  .handles-anchor {
    display: none;
  }
</style>
