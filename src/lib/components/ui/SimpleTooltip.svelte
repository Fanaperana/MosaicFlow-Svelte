<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		delay?: number;
		children: import('svelte').Snippet;
	}

	let {
		text,
		position = 'bottom',
		delay = 200,
		children
	}: Props = $props();

	let showTooltip = $state(false);
	let visible = $state(false);
	let timeout: ReturnType<typeof setTimeout> | null = null;

	function handleMouseEnter() {
		timeout = setTimeout(() => {
			showTooltip = true;
			// Small delay for the DOM to update before triggering animation
			requestAnimationFrame(() => {
				visible = true;
			});
		}, delay);
	}

	function handleMouseLeave() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
		visible = false;
		// Wait for animation to complete before removing from DOM
		setTimeout(() => {
			showTooltip = false;
		}, 150);
	}

	onMount(() => {
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	class="relative inline-flex"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	{@render children()}
	
	{#if showTooltip}
		<div 
			class="absolute z-9999 px-2 py-1 text-xs font-medium leading-snug text-[#fafafa] bg-[#1a1a24] border border-[#2a2a3a] rounded-md whitespace-nowrap pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.4)] opacity-0 scale-95 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] tooltip-{position}"
			class:visible
			role="tooltip"
		>
			<div class="absolute size-2 bg-[#1a1a24] border border-[#2a2a3a] rotate-45 -z-10 tooltip-arrow-{position}"></div>
			{text}
		</div>
	{/if}
</div>

<style>
	.visible {
		opacity: 1;
		transform: scale(1);
	}

	/* Position: Bottom (default) */
	.tooltip-bottom {
		top: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%) scale(0.95);
	}
	.tooltip-bottom.visible {
		transform: translateX(-50%) scale(1);
	}
	.tooltip-arrow-bottom {
		top: -4px;
		left: 50%;
		margin-left: -4px;
		border-bottom: none;
		border-right: none;
	}

	/* Position: Top */
	.tooltip-top {
		bottom: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%) scale(0.95);
	}
	.tooltip-top.visible {
		transform: translateX(-50%) scale(1);
	}
	.tooltip-arrow-top {
		bottom: -4px;
		left: 50%;
		margin-left: -4px;
		border-top: none;
		border-left: none;
	}

	/* Position: Left */
	.tooltip-left {
		right: calc(100% + 12px);
		top: 50%;
		transform: translateY(-50%) scale(0.95);
	}
	.tooltip-left.visible {
		transform: translateY(-50%) scale(1);
	}
	.tooltip-arrow-left {
		right: -4px;
		top: 50%;
		margin-top: -4px;
		border-left: none;
		border-bottom: none;
	}

	/* Position: Right */
	.tooltip-right {
		left: calc(100% + 12px);
		top: 50%;
		transform: translateY(-50%) scale(0.95);
	}
	.tooltip-right.visible {
		transform: translateY(-50%) scale(1);
	}
	.tooltip-arrow-right {
		left: -4px;
		top: 50%;
		margin-top: -4px;
		border-right: none;
		border-top: none;
	}
</style>
