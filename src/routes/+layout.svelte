<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import { onMount } from 'svelte';
  import { initializePluginSystem } from '$lib/plugins';
  import { settings } from '$lib/stores/settings.svelte';
  import { registerCoreCommands } from '$lib/commands/core';
  import { registerCoreThemes } from '$lib/services/themes';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import GlobalTooltip from '$lib/components/ui/GlobalTooltip.svelte';

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
<Tooltip.Provider delayDuration={300} skipDelayDuration={400}>
  {#if pluginsReady}
    {@render children()}
  {/if}
</Tooltip.Provider>
<GlobalTooltip />
