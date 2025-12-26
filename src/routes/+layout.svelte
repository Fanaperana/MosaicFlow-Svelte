<script lang="ts">
  import '../app.css';
  import * as Tooltip from '$lib/components/ui/tooltip';
</script>

<Tooltip.Provider>
  <slot />
</Tooltip.Provider>
