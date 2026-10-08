<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import { onMount } from 'svelte';
  import { initializePluginSystem } from '$lib/plugins';
  import { settings } from '$lib/stores/settings.svelte';
  import { registerCoreCommands } from '$lib/commands/core';
  import { registerCoreThemes } from '$lib/services/themes';

  let { children }: { children: Snippet } = $props();
  let pluginsReady = $state(false);

  onMount(async () => {
    registerCoreThemes();
    // Settings first: keybinding overrides and plugin options live there.
    await settings.load();
    registerCoreCommands();
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
