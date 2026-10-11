<!-- Wraps any content with the app tooltip (bits-ui: portalled, flips and shifts to stay on screen). -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from './tooltip';

	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		delay?: number;
		children: Snippet;
	}

	let { text, position = 'bottom', delay = 200, children }: Props = $props();
</script>

<Tooltip.Root delayDuration={delay} disableHoverableContent>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<!-- The wrapped control takes focus itself; the wrapper only listens for hover. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<span {...props} class="inline-flex" tabindex={-1}>{@render children()}</span>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content side={position}>{text}</Tooltip.Content>
</Tooltip.Root>