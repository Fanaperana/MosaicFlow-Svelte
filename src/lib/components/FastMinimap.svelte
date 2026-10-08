<!--
  Minimap for large pages, drawn on a <canvas>.
  xyflow's <MiniMap> renders one SVG element per node and re-renders them on every node change, which made
  dragging on a 2000-node page cost ~45ms per frame. Here a whole redraw is a few fillRects, at most once per frame.
  Click or drag inside it to pan; the wheel zooms.
-->
<script lang="ts">
  import { useStore, useSvelteFlow } from '@xyflow/svelte';

  const WIDTH = 200;
  const HEIGHT = 150;
  const PAD = 6;

  const store = useStore();
  const { setViewport, getViewport } = useSvelteFlow();

  let canvas = $state<HTMLCanvasElement>();
  let frame = 0;
  // Flow -> minimap transform from the last draw, reused by pointer handling.
  let scale = 1;
  let originX = 0;
  let originY = 0;

  function draw() {
    frame = 0;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== WIDTH * dpr) {
      canvas.width = WIDTH * dpr;
      canvas.height = HEIGHT * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const { x: vx, y: vy, zoom } = store.viewport;
    const view = { x: -vx / zoom, y: -vy / zoom, w: store.width / zoom, h: store.height / zoom };

    let minX = view.x, minY = view.y, maxX = view.x + view.w, maxY = view.y + view.h;
    const rects: [number, number, number, number, boolean, boolean][] = [];
    for (const node of store.nodeLookup.values()) {
      if (node.hidden) continue;
      const { x, y } = node.internals.positionAbsolute;
      const w = node.measured.width ?? node.width ?? 0;
      const h = node.measured.height ?? node.height ?? 0;
      rects.push([x, y, w, h, node.type === 'group', !!node.selected]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    scale = Math.min((WIDTH - PAD * 2) / Math.max(1, maxX - minX), (HEIGHT - PAD * 2) / Math.max(1, maxY - minY));
    originX = minX - ((WIDTH - PAD * 2) / scale - (maxX - minX)) / 2 - PAD / scale;
    originY = minY - ((HEIGHT - PAD * 2) / scale - (maxY - minY)) / 2 - PAD / scale;
    const tx = (x: number) => (x - originX) * scale;
    const ty = (y: number) => (y - originY) * scale;

    for (const [x, y, w, h, group, selected] of rects) {
      const rw = Math.max(1, w * scale);
      const rh = Math.max(1, h * scale);
      if (group) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.strokeRect(tx(x), ty(y), rw, rh);
      } else {
        ctx.fillStyle = selected ? '#5b8def' : '#4b5260';
        ctx.fillRect(tx(x), ty(y), rw, rh);
      }
    }

    // Dim everything outside the viewport, then outline it.
    const [rx, ry, rw, rh] = [tx(view.x), ty(view.y), view.w * scale, view.h * scale];
    ctx.fillStyle = 'rgba(13, 17, 23, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    ctx.rect(rx, ry, rw, rh);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(232, 232, 234, 0.6)';
    ctx.strokeRect(rx, ry, rw, rh);
  }

  $effect(() => {
    // Redraw when nodes, sizes or the viewport change; coalesced to one draw per frame.
    void store.nodes;
    void store.viewport;
    void store.width;
    void store.height;
    if (!frame) frame = requestAnimationFrame(draw);
  });

  $effect(() => () => cancelAnimationFrame(frame));

  function centerOn(e: PointerEvent) {
    const r = canvas!.getBoundingClientRect();
    const fx = (e.clientX - r.left) / scale + originX;
    const fy = (e.clientY - r.top) / scale + originY;
    const { zoom } = getViewport();
    setViewport({ x: store.width / 2 - fx * zoom, y: store.height / 2 - fy * zoom, zoom });
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    canvas!.setPointerCapture(e.pointerId);
    centerOn(e);
  }

  function onPointerMove(e: PointerEvent) {
    if (canvas!.hasPointerCapture(e.pointerId)) centerOn(e);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const { x, y, zoom } = getViewport();
    const next = Math.min(8, Math.max(0.01, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    // Keep the screen centre fixed while zooming.
    const cx = (store.width / 2 - x) / zoom;
    const cy = (store.height / 2 - y) / zoom;
    setViewport({ x: store.width / 2 - cx * next, y: store.height / 2 - cy * next, zoom: next });
  }
</script>

<canvas
  bind:this={canvas}
  class="fast-minimap nopan nowheel"
  style="width: {WIDTH}px; height: {HEIGHT}px"
  aria-label="Mini map"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onwheel={onWheel}
></canvas>

<style>
  .fast-minimap {
    position: absolute;
    bottom: 15px;
    left: 15px;
    z-index: 5;
    border: 1px solid #333;
    border-radius: 4px;
    background: #1a1d21;
    cursor: crosshair;
    touch-action: none;
  }
</style>
