<script lang="ts">
  import '../app.css';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<Tooltip.Provider>
  {@render children()}
</Tooltip.Provider>
