<!--
  Obsidian-style knowledge graph: every node in the vault, connected by [[links]], canvas edges and
  (optionally) the page it lives on. Force-directed layout drawn on a 2D canvas.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { X, Search, LocateFixed } from 'lucide-svelte';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { openNode } from '$lib/services/navigation';
  import { nodeRegistry } from '$lib/kernel/registries/node-registry';

  type GNode = {
    key: string;
    kind: 'node' | 'page';
    canvasId: string;
    id: string;
    label: string;
    color: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    degree: number;
  };
  type GLink = { a: GNode; b: GNode; kind: 'link' | 'edge' | 'page' };

  let scope = $state<'vault' | 'page'>('vault');
  let showHubs = $state(true);
  let showEdges = $state(true);
  let showOrphans = $state(true);
  let query = $state('');
  let stats = $state({ nodes: 0, links: 0 });
  let legend = $state<{ id: string; name: string; color: string }[]>([]);
  let hoverLabel = $state<{ text: string; detail: string; x: number; y: number } | null>(null);

  let wrap: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let nodes: GNode[] = [];
  let links: GLink[] = [];
  let byKey = new Map<string, GNode>();
  let neighbors = new Map<GNode, Set<GNode>>();
  let view = { x: 0, y: 0, k: 1 };
  let alpha = 1;
  let hover: GNode | null = null;
  let dragging: GNode | null = null;
  let pan: { sx: number; sy: number; vx: number; vy: number } | null = null;
  let downAt: { x: number; y: number } | null = null;
  let fitted = false;
  // Set whenever the picture may have changed; idle frames skip drawing.
  let dirty = true;

  function colorFor(canvasId: string): string {
    // Golden-angle hues keep neighbouring pages distinct.
    const i = Math.max(0, vaultStore.canvases.findIndex((c) => c.id === canvasId));
    return `hsl(${(i * 137.508 + 265) % 360}, 65%, 64%)`;
  }

  function radius(n: GNode): number {
    // Grows with connections but capped, so a hub with thousands of links stays a dot, not a blob.
    return (n.kind === 'page' ? 7 : 3.5) + Math.min(Math.sqrt(n.degree) * 1.7, 14);
  }

  function build() {
    const index = knowledge.index;
    const current = vaultStore.currentCanvas?.id;
    const canvases = vaultStore.canvases.filter((c) => scope === 'vault' || c.id === current);
    const inScope = new Set(canvases.map((c) => c.id));
    const old = byKey;
    const next = new Map<string, GNode>();
    const spread = Math.sqrt(index.nodes.length + 1) * 30;

    const make = (key: string, init: Omit<GNode, 'key' | 'x' | 'y' | 'vx' | 'vy' | 'degree'>): GNode => {
      const prev = old.get(key);
      const n: GNode = prev
        ? Object.assign(prev, init, { degree: 0 })
        : { key, ...init, x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread, vx: 0, vy: 0, degree: 0 };
      next.set(key, n);
      return n;
    };

    const hubs = new Map<string, GNode>();
    if (showHubs) {
      for (const c of canvases) {
        hubs.set(c.id, make(`page:${c.id}`, { kind: 'page', canvasId: c.id, id: c.id, label: c.name, color: colorFor(c.id) }));
      }
    }
    for (const n of index.nodes) {
      if (!inScope.has(n.canvasId)) continue;
      const reg = nodeRegistry.get(n.type);
      make(`${n.canvasId}:${n.id}`, {
        kind: 'node', canvasId: n.canvasId, id: n.id,
        label: n.title || reg?.label || n.type,
        color: colorFor(n.canvasId),
      });
    }

    const out: GLink[] = [];
    const seen = new Set<string>();
    const linked = new Set<GNode>();
    const add = (a: GNode | undefined, b: GNode | undefined, kind: GLink['kind']) => {
      if (!a || !b || a === b) return;
      const k = a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ a, b, kind });
      a.degree++;
      b.degree++;
      if (kind !== 'page') { linked.add(a); linked.add(b); }
    };

    for (const n of index.nodes) {
      const src = next.get(`${n.canvasId}:${n.id}`);
      if (!src) continue;
      for (const l of n.links) {
        const t = index.resolve(l, n.canvasId);
        if (t) add(src, next.get(`${t.canvasId}:${t.id}`), 'link');
        else {
          const name = (l.canvas ?? l.target).toLowerCase();
          const page = vaultStore.canvases.find((c) => c.name.toLowerCase() === name);
          if (page) add(src, hubs.get(page.id), 'link');
        }
      }
    }
    if (showEdges) {
      for (const c of canvases) {
        for (const e of knowledge.canvasEdges(c.id)) add(next.get(`${c.id}:${e.source}`), next.get(`${c.id}:${e.target}`), 'edge');
      }
    }
    if (!showOrphans) {
      for (const [key, n] of next) if (n.kind === 'node' && !linked.has(n)) next.delete(key);
    }
    if (showHubs) {
      for (const n of next.values()) if (n.kind === 'node') add(n, hubs.get(n.canvasId), 'page');
    }

    byKey = next;
    nodes = [...next.values()];
    links = out.filter((l) => next.has(l.a.key) && next.has(l.b.key));
    neighbors = new Map(nodes.map((n) => [n, new Set<GNode>()]));
    for (const l of links) {
      neighbors.get(l.a)!.add(l.b);
      neighbors.get(l.b)!.add(l.a);
    }
    stats = { nodes: nodes.filter((n) => n.kind === 'node').length, links: links.filter((l) => l.kind !== 'page').length };
    legend = canvases.map((c) => ({ id: c.id, name: c.name, color: colorFor(c.id) }));
    if (hover && !next.has(hover.key)) hover = null;
    alpha = Math.max(alpha, 0.6);
    dirty = true;
  }

  // Layout tuning (Obsidian-like: compact round clusters, short links, dots packed but not overlapping).
  const REPULSION = 120;
  const LINK_DISTANCE = 40;
  const HUB_DISTANCE = 30;
  const CENTER_PULL = 0.02;
  const COLLIDE_PAD = 3;

  function tick() {
    repel(REPULSION * alpha);
    for (const l of links) {
      const dx = l.b.x - l.a.x;
      const dy = l.b.y - l.a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = l.kind === 'page' ? HUB_DISTANCE : LINK_DISTANCE;
      const k = (l.kind === 'page' ? 0.04 : 0.07) * alpha;
      const f = ((d - target) / d) * k * 2;
      // Like d3-force: the better-connected end moves less, so a page hub with 2000 springs
      // doesn't get yanked back and forth by all of them every frame.
      const bias = l.a.degree / (l.a.degree + l.b.degree || 1);
      l.a.vx += dx * f * (1 - bias); l.a.vy += dy * f * (1 - bias);
      l.b.vx -= dx * f * bias; l.b.vy -= dy * f * bias;
    }
    for (const node of nodes) {
      node.vx -= node.x * CENTER_PULL * alpha;
      node.vy -= node.y * CENTER_PULL * alpha;
      if (node === dragging) { node.vx = node.vy = 0; continue; }
      node.vx *= 0.55;
      node.vy *= 0.55;
      node.x += Math.max(-40, Math.min(40, node.vx));
      node.y += Math.max(-40, Math.min(40, node.vy));
    }
    alpha = dragging ? Math.max(alpha, 0.25) : alpha * 0.992;
    dirty = true;
  }

  // Many-body repulsion via a Barnes-Hut quadtree: near nodes exactly, far clusters as one mass.
  type Cell = { x: number; y: number; s: number; m: number; mx: number; my: number; leaf: GNode | null; extra: GNode[] | null; kids: Cell[] | null };
  // Long range on purpose: with a short one, distant clusters never push each other and the whole
  // graph packs into a uniform disc with a sharp edge. Barnes-Hut keeps the far field cheap.
  const CUTOFF2 = 1000 * 1000;
  const THETA2 = 0.81;
  const cell = (x: number, y: number, s: number): Cell => ({ x, y, s, m: 0, mx: 0, my: 0, leaf: null, extra: null, kids: null });

  function insert(c: Cell, n: GNode, depth: number) {
    c.m++; c.mx += n.x; c.my += n.y;
    if (c.m === 1) { c.leaf = n; return; }
    if (depth > 24) { (c.extra ??= []).push(n); return; } // coincident points
    if (!c.kids) {
      const h = c.s / 2;
      c.kids = [cell(c.x, c.y, h), cell(c.x + h, c.y, h), cell(c.x, c.y + h, h), cell(c.x + h, c.y + h, h)];
      const old = c.leaf!;
      c.leaf = null;
      insert(child(c, old), old, depth + 1);
    }
    insert(child(c, n), n, depth + 1);
  }

  function child(c: Cell, n: GNode): Cell {
    const h = c.s / 2;
    return c.kids![(n.x >= c.x + h ? 1 : 0) + (n.y >= c.y + h ? 2 : 0)];
  }

  function push(c: Cell, a: GNode, strength: number) {
    if (c.m === 0) return;
    if (!c.kids) {
      for (const b of c.extra ? [c.leaf!, ...c.extra] : [c.leaf!]) {
        if (b === a) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy + 0.01;
        if (d2 > CUTOFF2) continue;
        a.vx += (dx * strength) / d2; a.vy += (dy * strength) / d2;
        // Collision: push overlapping dots apart regardless of alpha so they never sit on top of each other.
        const minD = radius(a) + radius(b) + COLLIDE_PAD;
        if (d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const overlap = (minD - d) / d / 2;
          a.vx += dx * overlap; a.vy += dy * overlap;
        }
      }
      return;
    }
    const dx = a.x - c.mx / c.m, dy = a.y - c.my / c.m;
    const d2 = dx * dx + dy * dy + 0.01;
    if ((c.s * c.s) / d2 > THETA2) {
      for (const k of c.kids) push(k, a, strength);
    } else if (d2 <= CUTOFF2) {
      a.vx += (dx * strength * c.m) / d2; a.vy += (dy * strength * c.m) / d2;
    }
  }

  function repel(strength: number) {
    if (nodes.length < 2) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    const root = cell(x0, y0, Math.max(x1 - x0, y1 - y0) + 1);
    for (const n of nodes) insert(root, n, 0);
    for (const n of nodes) push(root, n, strength);
  }

  function size() {
    return { w: wrap?.clientWidth ?? 0, h: wrap?.clientHeight ?? 0 };
  }

  function toWorld(sx: number, sy: number) {
    const { w, h } = size();
    return { x: (sx - w / 2 - view.x) / view.k, y: (sy - h / 2 - view.y) / view.k };
  }

  function pick(sx: number, sy: number): GNode | null {
    const p = toWorld(sx, sy);
    let best: GNode | null = null;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < radius(n) + 5 / view.k && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  function fit() {
    if (!nodes.length) return;
    const { w, h } = size();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    const k = Math.min(2, Math.max(0.1, Math.min((w - 120) / (x1 - x0 || 1), (h - 160) / (y1 - y0 || 1))));
    view = { k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k };
    dirty = true;
  }

  function draw() {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { w, h } = size();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2 + view.x, h / 2 + view.y);
    ctx.scale(view.k, view.k);

    const focus = dragging ?? hover;
    const near = focus ? neighbors.get(focus) : null;
    const q = query.trim().toLowerCase();
    const matches = (n: GNode) => !q || n.label.toLowerCase().includes(q);
    const lit = (n: GNode) => (focus ? n === focus || !!near?.has(n) : matches(n));

    for (const l of links) {
      const on = focus ? l.a === focus || l.b === focus : matches(l.a) && matches(l.b);
      ctx.globalAlpha = on ? (focus ? 0.9 : l.kind === 'page' ? 0.18 : 0.45) : 0.06;
      ctx.strokeStyle = focus && on ? '#a78bfa' : l.kind === 'edge' ? '#5b8def' : '#8a8a96';
      ctx.lineWidth = (l.kind === 'page' ? 0.7 : 1.1) / Math.max(view.k, 0.4);
      if (l.kind === 'page') ctx.setLineDash([3 / view.k, 3 / view.k]);
      ctx.beginPath();
      ctx.moveTo(l.a.x, l.a.y);
      ctx.lineTo(l.b.x, l.b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const n of nodes) {
      const r = radius(n);
      ctx.globalAlpha = lit(n) ? 1 : 0.15;
      ctx.fillStyle = n.color;
      ctx.beginPath();
      if (n.kind === 'page') ctx.roundRect(n.x - r, n.y - r, r * 2, r * 2, r * 0.35);
      else ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (n === focus || (q && matches(n))) {
        ctx.lineWidth = 2 / view.k;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const fontPx = 11 / Math.max(view.k, 0.6);
    // Like Obsidian, note labels fade in as you zoom (from 1x, fully visible at 1.6x); page labels always show.
    const zoomFade = Math.min(1, Math.max(0, (view.k - 1) / 0.6));
    // With many pages their labels pile up; then they follow the same zoom fade as notes.
    const pageCount = legend.length;
    const pageFade = pageCount <= 40 ? 1 : Math.min(1, Math.max(0, (view.k - 0.4) / 0.6));
    for (const n of nodes) {
      const forced = n === focus || near?.has(n) || (q && matches(n));
      const fade = forced ? 1 : n.kind === 'page' ? pageFade : zoomFade;
      if (fade === 0) continue;
      const base = lit(n) ? (n.kind === 'page' ? 0.95 : 0.85) : 0.15;
      ctx.globalAlpha = base * fade;
      ctx.fillStyle = n.kind === 'page' ? '#ffffff' : '#d4d4dc';
      ctx.font = `${n.kind === 'page' ? 600 : 400} ${fontPx}px Inter, system-ui, sans-serif`;
      const label = n.label.length > 40 ? `${n.label.slice(0, 39)}…` : n.label;
      ctx.fillText(label, n.x, n.y + radius(n) + 3 / view.k);
    }
    ctx.globalAlpha = 1;
  }

  function onPointerDown(e: PointerEvent) {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    downAt = { x: e.offsetX, y: e.offsetY };
    const n = pick(e.offsetX, e.offsetY);
    if (n) {
      dragging = n;
      alpha = Math.max(alpha, 0.3);
    } else {
      pan = { sx: e.offsetX, sy: e.offsetY, vx: view.x, vy: view.y };
    }
  }

  function onPointerMove(e: PointerEvent) {
    dirty = true;
    if (dragging) {
      const p = toWorld(e.offsetX, e.offsetY);
      dragging.x = p.x;
      dragging.y = p.y;
    } else if (pan) {
      view = { ...view, x: pan.vx + e.offsetX - pan.sx, y: pan.vy + e.offsetY - pan.sy };
    } else {
      hover = pick(e.offsetX, e.offsetY);
      canvas.style.cursor = hover ? 'pointer' : 'grab';
    }
    const n = dragging ?? hover;
    hoverLabel = n
      ? { text: n.label, detail: n.kind === 'page' ? 'Page' : `${legend.find((c) => c.id === n.canvasId)?.name ?? ''} · ${n.degree} link${n.degree === 1 ? '' : 's'}`, x: e.offsetX, y: e.offsetY }
      : null;
  }

  function onPointerUp(e: PointerEvent) {
    const clicked = downAt && Math.hypot(e.offsetX - downAt.x, e.offsetY - downAt.y) < 4;
    const n = dragging;
    dragging = null;
    pan = null;
    downAt = null;
    if (clicked && n) open(n);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const { w, h } = size();
    const p = toWorld(e.offsetX, e.offsetY);
    const k = Math.min(6, Math.max(0.05, view.k * Math.exp(-e.deltaY * 0.0015)));
    view = { k, x: e.offsetX - w / 2 - p.x * k, y: e.offsetY - h / 2 - p.y * k };
    dirty = true;
  }

  function open(n: GNode) {
    ui.graphOpen = false;
    if (n.kind === 'page') {
      const c = vaultStore.canvases.find((c) => c.id === n.canvasId);
      if (c && vaultStore.currentCanvas?.id !== c.id) vaultStore.openCanvas(c);
    } else {
      openNode(n.canvasId, n.id);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      ui.graphOpen = false;
    }
  }

  $effect(() => {
    void knowledge.revision;
    void scope; void showHubs; void showEdges; void showOrphans;
    void vaultStore.canvases; void vaultStore.currentCanvas;
    untrack(build);
  });

  $effect(() => {
    void query;
    dirty = true;
  });

  onMount(() => {
    knowledge.loadVault();
    let frame = 0;
    let warm = 0;
    let lastSize = '';
    const loop = () => {
      if (alpha > 0.01 || dragging) tick();
      if (!fitted && ++warm > 90) { fit(); fitted = true; }
      const { w, h } = size();
      if (`${w}x${h}` !== lastSize) { lastSize = `${w}x${h}`; dirty = true; }
      if (dirty) { dirty = false; draw(); }
      frame = requestAnimationFrame(loop);
    };
    // Settle most of the layout before the first paint so it doesn't explode on screen (time-boxed for huge vaults).
    const t0 = performance.now();
    for (let i = 0; i < 120 && performance.now() - t0 < 250; i++) tick();
    fit();
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="graph-view" bind:this={wrap} role="dialog" aria-modal="true" aria-label="Graph view">
  <canvas
    bind:this={canvas}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={() => { if (!dragging && !pan) { hover = null; hoverLabel = null; dirty = true; } }}
    onwheel={onWheel}
  ></canvas>

  <div class="gv-top">
    <span class="gv-title">Graph view</span>
    <span class="gv-stats">{stats.nodes} nodes · {stats.links} links</span>
    <div class="gv-spacer"></div>
    <button class="gv-icon" onclick={fit} title="Fit to screen"><LocateFixed size={15} /></button>
    <button class="gv-icon" onclick={() => (ui.graphOpen = false)} title="Close (Esc)"><X size={16} /></button>
  </div>

  <div class="gv-panel">
    <label class="gv-search">
      <Search size={13} />
      <input type="text" placeholder="Search nodes…" bind:value={query} />
    </label>
    <div class="gv-seg">
      <button class:active={scope === 'vault'} onclick={() => (scope = 'vault')}>Whole vault</button>
      <button class:active={scope === 'page'} onclick={() => (scope = 'page')}>This page</button>
    </div>
    <label class="gv-check"><input type="checkbox" bind:checked={showHubs} /> Page hubs</label>
    <label class="gv-check"><input type="checkbox" bind:checked={showEdges} /> Canvas connections</label>
    <label class="gv-check"><input type="checkbox" bind:checked={showOrphans} /> Unlinked nodes</label>
    {#if legend.length > 1}
      <div class="gv-legend">
        {#each legend as page (page.id)}
          <span class="gv-legend-item"><i style="background: {page.color}"></i>{page.name}</span>
        {/each}
      </div>
    {/if}
  </div>

  {#if hoverLabel}
    <div class="gv-tip" style="left: {hoverLabel.x + 14}px; top: {hoverLabel.y + 14}px">
      <strong>{hoverLabel.text}</strong>
      <span>{hoverLabel.detail}</span>
    </div>
  {/if}
</div>

<style>
  .graph-view {
    position: absolute;
    inset: 0;
    z-index: 300;
    background: radial-gradient(ellipse at center, #15161c 0%, var(--mf-bg, #0e0f13) 75%);
    overflow: hidden;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: none;
  }

  .gv-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 36px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px 0 14px;
    border-bottom: 1px solid var(--mf-border, #2a2a30);
    background: color-mix(in srgb, var(--mf-surface, #16171c) 85%, transparent);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
  }

  .gv-title {
    color: var(--mf-text, #eee);
    font-size: 13px;
    font-weight: 600;
  }

  .gv-stats {
    color: var(--mf-text-3, #888);
    font-size: 11.5px;
  }

  .gv-spacer {
    flex: 1;
  }

  .gv-icon {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-2, #bbb);
    cursor: pointer;
  }

  .gv-icon:hover {
    background: var(--mf-hover, rgba(255, 255, 255, 0.06));
    color: var(--mf-text, #fff);
  }

  .gv-panel {
    position: absolute;
    top: 48px;
    right: 12px;
    width: 210px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--mf-border, #2a2a30);
    border-radius: 9px;
    background: color-mix(in srgb, var(--mf-surface-2, #1b1c22) 92%, transparent);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    font-size: 12px;
    color: var(--mf-text-2, #bbb);
  }

  .gv-search {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    height: 28px;
    border: 1px solid var(--mf-border, #2a2a30);
    border-radius: 6px;
    background: var(--mf-bg, #0e0f13);
  }

  .gv-search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--mf-text, #eee);
    font-size: 12px;
  }

  .gv-seg {
    display: flex;
    padding: 2px;
    border-radius: 6px;
    background: var(--mf-bg, #0e0f13);
  }

  .gv-seg button {
    flex: 1;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3, #888);
    font-size: 11.5px;
    cursor: pointer;
  }

  .gv-seg button.active {
    background: var(--mf-active, rgba(255, 255, 255, 0.1));
    color: var(--mf-text, #fff);
  }

  .gv-check {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
  }

  .gv-check input {
    accent-color: #8b5cf6;
  }

  .gv-legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 160px;
    overflow-y: auto;
    padding-top: 6px;
    border-top: 1px solid var(--mf-border, #2a2a30);
  }

  .gv-legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 11.5px;
  }

  .gv-legend-item i {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .gv-tip {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 260px;
    padding: 6px 9px;
    border: 1px solid var(--mf-border-strong, #333);
    border-radius: 6px;
    background: var(--mf-surface-2, #1b1c22);
    pointer-events: none;
    font-size: 12px;
    color: var(--mf-text, #eee);
  }

  .gv-tip span {
    color: var(--mf-text-3, #888);
    font-size: 11px;
  }
</style>
