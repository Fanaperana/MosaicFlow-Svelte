<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { nodeRegistry } from '$lib/kernel/registries/node-registry';
  import { extractTags } from '@mosaicflow/vault-core';

  const WIDTH = 260;
  const MAX_FIELDS = 8;

  let hoverId = $state<string | null>(null);
  let altDown = $state(false);
  let at = $state({ x: 0, y: 0 });

  const node = $derived(
    settings.current.canvas.peekOnAlt && altDown && hoverId ? workspace.getNode(hoverId) : undefined,
  );

  const details = $derived.by(() => {
    if (!node) return null;
    const data = node.data as Record<string, unknown>;
    const schema = nodeRegistry.get(node.type)?.knowledge?.fields ?? {};
    const fields = Object.entries(schema)
      .filter(([, f]) => f.type !== 'object' && f.type !== 'object[]' && f.type !== 'markdown')
      .map(([key]) => [key, format(data[key])] as const)
      .filter(([, value]) => value)
      .slice(0, MAX_FIELDS);
    const canvasId = vaultStore.currentCanvas?.id ?? '';
    return {
      type: nodeRegistry.getLabel(node.type),
      title: nodeRegistry.getDisplayName(node),
      fields,
      tags: extractTags(data),
      backlinks: knowledge.index.backlinks(canvasId, node.id).length,
      size: `${Math.round(node.width ?? 0)} × ${Math.round(node.height ?? 0)}`,
    };
  });

  function format(value: unknown): string {
    if (value == null || value === '') return '';
    if (Array.isArray(value)) return value.map(String).join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    const text = String(value);
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  function onPointerMove(e: PointerEvent) {
    at = { x: e.clientX, y: e.clientY };
    altDown = e.altKey;
    hoverId = (e.target as Element | null)?.closest?.('.svelte-flow__node')?.getAttribute('data-id') ?? null;
  }

  function onKey(e: KeyboardEvent) {
    altDown = e.altKey;
  }

  const left = $derived(Math.min(at.x + 16, window.innerWidth - WIDTH - 8));
  const top = $derived(Math.min(at.y + 16, window.innerHeight - 220));
</script>

<svelte:window onpointermove={onPointerMove} onkeydown={onKey} onkeyup={onKey} onblur={() => (altDown = false)} />

{#if details}
  <div class="node-peek" style="left: {left}px; top: {top}px; width: {WIDTH}px" role="tooltip">
    <div class="kind">{details.type}</div>
    <div class="title">{details.title}</div>
    {#if details.fields.length}
      <dl>
        {#each details.fields as [key, value] (key)}
          <dt>{key}</dt>
          <dd>{value}</dd>
        {/each}
      </dl>
    {/if}
    {#if details.tags.length}
      <div class="tags">{details.tags.map((t) => `#${t}`).join(' ')}</div>
    {/if}
    <div class="meta">{details.size} · {details.backlinks} backlink{details.backlinks === 1 ? '' : 's'}</div>
  </div>
{/if}

<style>
  .node-peek {
    position: fixed;
    z-index: 1000;
    padding: 8px 10px;
    background: var(--mf-surface-2);
    border: 1px solid var(--mf-border-strong);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    font-size: 12px;
    color: var(--mf-text);
    pointer-events: none;
  }

  .kind {
    font-size: 11px;
    color: var(--mf-text-2);
  }

  .title {
    margin: 2px 0 6px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin-bottom: 6px;
  }

  dt {
    color: var(--mf-text-2);
  }

  dd {
    overflow-wrap: anywhere;
  }

  .tags {
    margin-bottom: 6px;
    color: var(--mf-accent);
  }

  .meta {
    font-size: 11px;
    color: var(--mf-text-2);
  }
</style>
