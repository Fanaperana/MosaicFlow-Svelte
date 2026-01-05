<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { Toaster } from 'svelte-sonner';

  let { children }: { children: Snippet } = $props();
</script>

<Toaster 
  richColors 
  position="bottom-right"
  toastOptions={{
    style: 'background: #1a1a1a; border: 1px solid #333; color: #fff;',
  }}
/>
{@render children()}
