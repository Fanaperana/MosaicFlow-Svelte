<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import { onMount } from 'svelte';
  import { initializePluginSystem } from '$lib/plugins';

  let { children }: { children: Snippet } = $props();
  let pluginsReady = $state(false);

  onMount(async () => {
    await initializePluginSystem();
    pluginsReady = true;
  });
</script>

<Toaster 
  richColors 
  position="bottom-right"
  toastOptions={{
    style: 'background: #1a1a1a; border: 1px solid #333; color: #fff;',
  }}
/>
{#if pluginsReady}
  {@render children()}
{/if}
