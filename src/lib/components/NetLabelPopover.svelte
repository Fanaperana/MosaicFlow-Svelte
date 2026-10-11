<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { nodeRegistry } from '$lib/kernel/registries/node-registry';
  import { netHover, netNameOf } from '$lib/stores/net-hover.svelte';

  const WIDTH = 260;

  type Entry = { key: string; nodeId: string; title: string; type: string; sameEdge: boolean };

  // Every label of the hovered net except the hovered one itself, nodes of the same edge first.
  const entries = $derived.by((): Entry[] => {
    const anchor = netHover.anchor;
    if (!anchor) return [];
    const out: Entry[] = [];
    for (const e of workspace.edges) {
      if (e.data?.display !== 'label' || netNameOf(e.label) !== netHover.name) continue;
      for (const end of ['source', 'target'] as const) {
        if (e.id === anchor.edgeId && end === anchor.end) continue;
        const nodeId = end === 'source' ? e.source : e.target;
        const node = workspace.getNode(nodeId);
        if (!node) continue;
        out.push({
          key: `${e.id}:${end}`,
          nodeId,
          title: nodeRegistry.getDisplayName(node),
          type: nodeRegistry.getLabel(node.type),
          sameEdge: e.id === anchor.edgeId,
        });
      }
    }
    return out.sort((a, b) => Number(b.sameEdge) - Number(a.sameEdge));
  });

  const position = $derived.by(() => {
    const r = netHover.anchor?.rect;
    if (!r) return null;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8));
    const below = r.bottom + 6;
    const top = below + 220 > window.innerHeight ? Math.max(8, r.top - 6 - Math.min(220, 40 + entries.length * 40)) : below;
    return { left, top };
  });

  function go(nodeId: string) {
    netHover.close();
    window.dispatchEvent(new CustomEvent('mosaicflow:focusNode', { detail: { id: nodeId } }));
  }
</script>

{#if netHover.anchor && position}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="net-popover"
    style="left: {position.left}px; top: {position.top}px; width: {WIDTH}px"
    onmouseenter={() => netHover.hold()}
    onmouseleave={() => netHover.leave()}
  >
    <div class="head"><span class="net">{netHover.name}</span><span class="count">{entries.length + 1} labels</span></div>
    {#if entries.length}
      <ul>
        {#each entries as entry (entry.key)}
          <li>
            <button onclick={() => go(entry.nodeId)} title="Go to {entry.title}">
              <span class="text">
                <span class="title">{entry.title}</span>
                <span class="meta">{entry.type}{entry.sameEdge ? ' · other end' : ''}</span>
              </span>
              <ArrowRight size={13} />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No other label with this name.</p>
    {/if}
  </div>
{/if}

<style>
  .net-popover {
    position: fixed;
    z-index: 1000;
    padding: 6px;
    background: var(--mf-surface-2);
    border: 1px solid var(--mf-border-strong);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    font-size: 12px;
    color: var(--mf-text);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 6px 6px;
  }

  .net {
    font-family: var(--mf-font-mono);
    font-weight: 600;
  }

  .count {
    font-size: 11px;
    color: var(--mf-text-2);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 220px;
    overflow-y: auto;
  }

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--mf-hover);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta,
  .empty {
    font-size: 11px;
    color: var(--mf-text-2);
  }

  .empty {
    margin: 0;
    padding: 4px 6px;
  }
</style>
