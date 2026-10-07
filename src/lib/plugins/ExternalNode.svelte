<!--
  Host for framework-free plugin nodes: gives them the standard node chrome and
  calls the plugin's render(container, ctx) / update(ctx) / destroy().
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { TriangleAlert } from 'lucide-svelte';
  import NodeWrapper from '$lib/components/nodes/_shared/NodeWrapper.svelte';
  import { nodeRegistry, type ExternalNodeContext } from '$lib/kernel/registries/node-registry';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { openWikilink } from '$lib/services/navigation';
  import { renderMarkdown } from '@mosaicflow/node-sdk';
  import type { BaseNodeData } from '$lib/types';

  interface Props {
    id: string;
    type: string;
    data: BaseNodeData;
    selected?: boolean;
  }

  let { id, type, data, selected = false }: Props = $props();

  type Handle = { update?: (ctx: ExternalNodeContext) => void; destroy?: () => void };

  let container = $state<HTMLDivElement>();
  let error = $state<string | null>(null);
  let handle: Handle | undefined;

  function context(): ExternalNodeContext {
    return {
      id,
      type,
      data: $state.snapshot(data) as Record<string, unknown>,
      selected,
      update: (patch) => workspace.updateNodeData(id, patch),
      renderMarkdown,
      openWikilink: (ref) => void openWikilink(ref),
    };
  }

  function fail(e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`[Plugin node ${type}]`, e);
  }

  $effect(() => {
    const el = container;
    const render = nodeRegistry.get(type)?.render;
    if (!el) return;
    if (!render) {
      error = 'The plugin that provides this node is disabled or missing.';
      return;
    }
    untrack(() => {
      try {
        handle = render(el, context()) ?? undefined;
      } catch (e) {
        fail(e);
      }
    });
    return () => {
      try {
        handle?.destroy?.();
      } catch (e) {
        console.error(`[Plugin node ${type}] destroy failed`, e);
      }
      handle = undefined;
      el.replaceChildren();
    };
  });

  $effect(() => {
    const ctx = context();
    untrack(() => {
      try {
        handle?.update?.(ctx);
      } catch (e) {
        fail(e);
      }
    });
  });
</script>

<NodeWrapper {data} {selected} {id} nodeType={type}>
  {#if error}
    <div class="plugin-error"><TriangleAlert size={14} /><span>{error}</span></div>
  {/if}
  <div class="plugin-root" bind:this={container} class:hidden={!!error}></div>
</NodeWrapper>

<style>
  .plugin-root {
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  .plugin-root.hidden {
    display: none;
  }

  .plugin-error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px;
    color: var(--mf-danger);
    font-size: 12px;
    line-height: 1.4;
  }
</style>
