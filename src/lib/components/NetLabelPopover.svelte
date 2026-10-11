<script lang="ts">
  import { ArrowRight, Unlink } from 'lucide-svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { nodeRegistry } from '$lib/kernel/registries/node-registry';
  import { netHover, netMembers, nodeNetLabels } from '$lib/stores/net-hover.svelte';

  const WIDTH = 260;

  type Entry = { key: string; nodeId: string; title: string; type: string; detail: string; sameEdge: boolean };

  // Every node on the hovered net except the one the hovered label sits on (no jumping to itself);
  // one entry per node, the other end of the same edge first.
  const all = $derived(netHover.anchor ? netMembers(netHover.name) : []);
  const entries = $derived.by((): Entry[] => {
    const anchor = netHover.anchor;
    if (!anchor) return [];
    const anchorEdge = anchor.key.startsWith('edge:') ? anchor.key.split(':')[1] : undefined;
    const ownNode = all.find((m) => m.key === anchor.key)?.nodeId;
    const isSameEdge = (m: (typeof all)[number]) => !!m.edgeId && m.edgeId === anchorEdge;
    const seen = new Set<string>();
    const out: Entry[] = [];
    for (const m of [...all].sort((a, b) => Number(isSameEdge(b)) - Number(isSameEdge(a)))) {
      if (m.nodeId === ownNode || seen.has(m.nodeId)) continue;
      const node = workspace.getNode(m.nodeId);
      if (!node) continue;
      seen.add(m.nodeId);
      const sameEdge = isSameEdge(m);
      out.push({
        key: m.key,
        nodeId: m.nodeId,
        title: nodeRegistry.getDisplayName(node),
        type: nodeRegistry.getLabel(node.type),
        detail: sameEdge ? 'other end' : m.side ? `${m.side} side` : '',
        sameEdge,
      });
    }
    return out;
  });

  const position = $derived.by(() => {
    const r = netHover.anchor?.rect;
    if (!r) return null;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8));
    const spaceBelow = window.innerHeight - r.bottom - 14;
    const spaceAbove = r.top - 14;
    const needed = 44 + entries.length * 42;
    // Anchored by its bottom edge when above, so it never grows over the tag.
    return spaceBelow >= needed || spaceBelow >= spaceAbove
      ? `left: ${left}px; top: ${r.bottom + 6}px; max-height: ${spaceBelow}px;`
      : `left: ${left}px; bottom: ${window.innerHeight - r.top + 6}px; max-height: ${spaceAbove}px;`;
  });

  function go(nodeId: string) {
    netHover.close();
    window.dispatchEvent(new CustomEvent('mosaicflow:focusNode', { detail: { id: nodeId } }));
  }

  const GLOW = {
    net: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.75))',
    focus: 'drop-shadow(0 0 4px #fbbf24) drop-shadow(0 0 18px #fbbf24)',
    dim: 'drop-shadow(0 0 5px rgba(251, 191, 36, 0.35))',
  };

  // Nodes on the hovered net glow; a stylesheet survives node re-renders, unlike toggled classes.
  $effect(() => {
    if (!netHover.anchor) return;
    const ids = [...new Set(all.map((m) => m.nodeId))];
    if (!ids.length) return;
    const focus = netHover.focusNode;
    const sheet = document.createElement('style');
    sheet.textContent = ids
      .map((id) => `.svelte-flow__node[data-id="${CSS.escape(id)}"] { filter: ${id === focus ? GLOW.focus : focus ? GLOW.dim : GLOW.net}; }`)
      .join('\n');
    document.head.appendChild(sheet);
    return () => sheet.remove();
  });

  // Node labels only: `node:<nodeId>:<labelId>`.
  const ownLabel = $derived.by(() => {
    const [kind, nodeId, labelId] = netHover.anchor?.key.split(':') ?? [];
    const node = kind === 'node' ? workspace.getNode(nodeId) : undefined;
    return node ? { nodeId, labelId, title: nodeRegistry.getDisplayName(node) } : null;
  });

  function detach() {
    if (!ownLabel) return;
    const { nodeId, labelId } = ownLabel;
    netHover.close();
    if (workspace.selectedNetLabel?.labelId === labelId) workspace.selectedNetLabel = null;
    workspace.saveToHistory();
    workspace.setNetLabels(nodeId, nodeNetLabels(workspace.getNode(nodeId)?.data).filter((l) => l.id !== labelId));
  }
</script>

{#if netHover.anchor && position}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="net-popover"
    style="{position} width: {WIDTH}px"
    onmouseenter={() => netHover.hold()}
    onmouseleave={() => netHover.leave()}
  >
    <div class="head"><span class="net">{netHover.name}</span><span class="count">{all.length} label{all.length === 1 ? '' : 's'}</span></div>
    {#if entries.length}
      <ul>
        {#each entries as entry (entry.key)}
          <li>
            <button
              onclick={() => go(entry.nodeId)}
              onmouseenter={() => (netHover.focusNode = entry.nodeId)}
              onmouseleave={() => (netHover.focusNode = null)}
              title="Go to {entry.title}"
            >
              <span class="text">
                <span class="title">{entry.title}</span>
                <span class="meta">{entry.type}{entry.detail ? ` · ${entry.detail}` : ''}</span>
              </span>
              <ArrowRight size={13} />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No other node carries this label yet.</p>
    {/if}
    {#if ownLabel && !workspace.locked}
      <button class="detach" onclick={detach} title="Remove this label from {ownLabel.title}">
        <Unlink size={13} />
        <span class="title">Detach from {ownLabel.title}</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .net-popover {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
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
    min-height: 0;
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

  .detach {
    flex-shrink: 0;
    margin-top: 4px;
    border-top: 1px solid var(--mf-border);
    border-radius: 0 0 5px 5px;
    color: var(--mf-text-2);
  }

  .detach:hover {
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
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
