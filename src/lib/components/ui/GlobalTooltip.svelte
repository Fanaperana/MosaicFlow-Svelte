<!--
  Shows title="" hints in the app tooltip style instead of the OS tooltip, so every hint looks the same.
  The title moves to data-mf-title on hover (no native tooltip); icon-only controls keep it as aria-label.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  const DELAY = 450;
  // Moving straight to the next control shows its hint at once, like a toolbar.
  const WARM_FOR = 400;
  const GAP = 8;

  let text = $state('');
  let anchor = $state<DOMRect | null>(null);
  let width = $state(0);
  let height = $state(0);
  let current: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let warmUntil = 0;

  const placement = $derived.by(() => {
    if (!anchor || !width) return null;
    const below = anchor.bottom + GAP + height <= window.innerHeight - 8 || anchor.top - GAP - height < 8;
    const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 8));
    const top = below ? anchor.bottom + GAP : anchor.top - GAP - height;
    // Arrow follows the anchor even when the tooltip is pushed in from the screen edge.
    const arrow = Math.max(8, Math.min(anchor.left + anchor.width / 2 - left - 4, width - 16));
    return { left, top, side: below ? 'bottom' : 'top', arrow };
  });

  function titled(target: EventTarget | null): Element | null {
    return target instanceof Element ? target.closest('[title], [data-mf-title]') : null;
  }

  function hide() {
    clearTimeout(timer);
    if (anchor) warmUntil = Date.now() + WARM_FOR;
    current = null;
    anchor = null;
  }

  function onOver(e: PointerEvent) {
    const el = titled(e.target);
    if (!el || el === current) return;
    const native = el.getAttribute('title');
    if (native !== null) {
      el.setAttribute('data-mf-title', native);
      el.removeAttribute('title');
      if (!el.hasAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', native);
    }
    const value = el.getAttribute('data-mf-title')?.trim();
    hide();
    if (!value) return;
    current = el;
    timer = setTimeout(() => {
      if (current !== el || !el.isConnected) return;
      text = value;
      anchor = el.getBoundingClientRect();
    }, Date.now() < warmUntil ? 0 : DELAY);
  }

  function onOut(e: PointerEvent) {
    if (current && !(e.relatedTarget instanceof Node && current.contains(e.relatedTarget))) hide();
  }

  onMount(() => {
    const opts = { capture: true, passive: true };
    document.addEventListener('pointerover', onOver, opts);
    document.addEventListener('pointerout', onOut, opts);
    for (const type of ['pointerdown', 'wheel', 'keydown', 'scroll']) document.addEventListener(type, hide, opts);
    return () => {
      document.removeEventListener('pointerover', onOver, opts);
      document.removeEventListener('pointerout', onOut, opts);
      for (const type of ['pointerdown', 'wheel', 'keydown', 'scroll']) document.removeEventListener(type, hide, opts);
      clearTimeout(timer);
    };
  });
</script>

{#if anchor}
  <div
    class="mf-tooltip global"
    role="tooltip"
    data-side={placement?.side ?? 'bottom'}
    style:left="{placement?.left ?? -9999}px"
    style:top="{placement?.top ?? -9999}px"
    bind:clientWidth={width}
    bind:clientHeight={height}
  >
    {text}
    <span class="mf-tooltip-arrow" style:left="{placement?.arrow ?? 0}px" aria-hidden="true"></span>
  </div>
{/if}

<style>
  .global {
    position: fixed;
  }
</style>
