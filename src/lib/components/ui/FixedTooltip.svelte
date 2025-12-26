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
	let wrapperElement: HTMLDivElement | null = null;
	let tooltipElement: HTMLDivElement | null = null;
	let adjustedPosition = $state(position);
	let tooltipStyle = $state('');

	function calculatePosition() {
		if (!wrapperElement || !tooltipElement) return;

		const triggerRect = wrapperElement.getBoundingClientRect();
		const tooltipRect = tooltipElement.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const gap = 12;

		let finalPosition = position;
		let top = 0;
		let left = 0;

		// Calculate position based on preferred direction
		switch (position) {
			case 'top':
				top = triggerRect.top - tooltipRect.height - gap;
				left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				// Check if it fits, otherwise flip to bottom
				if (top < 10) {
					finalPosition = 'bottom';
					top = triggerRect.bottom + gap;
				}
				break;

			case 'bottom':
				top = triggerRect.bottom + gap;
				left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				// Check if it fits, otherwise flip to top
				if (top + tooltipRect.height > viewportHeight - 10) {
					finalPosition = 'top';
					top = triggerRect.top - tooltipRect.height - gap;
				}
				break;

			case 'left':
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				left = triggerRect.left - tooltipRect.width - gap;
				// Check if it fits, otherwise flip to right
				if (left < 10) {
					finalPosition = 'right';
					left = triggerRect.right + gap;
				}
				break;

			case 'right':
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				left = triggerRect.right + gap;
				// Check if it fits, otherwise flip to left
				if (left + tooltipRect.width > viewportWidth - 10) {
					finalPosition = 'left';
					left = triggerRect.left - tooltipRect.width - gap;
				}
				break;
		}

		// Ensure tooltip stays within viewport horizontally
		if (finalPosition === 'top' || finalPosition === 'bottom') {
			if (left < 10) left = 10;
			if (left + tooltipRect.width > viewportWidth - 10) {
				left = viewportWidth - tooltipRect.width - 10;
			}
		}

		// Ensure tooltip stays within viewport vertically
		if (finalPosition === 'left' || finalPosition === 'right') {
			if (top < 10) top = 10;
			if (top + tooltipRect.height > viewportHeight - 10) {
				top = viewportHeight - tooltipRect.height - 10;
			}
		}

		adjustedPosition = finalPosition;
		tooltipStyle = `top: ${top}px; left: ${left}px;`;
	}

	function handleMouseEnter() {
		timeout = setTimeout(() => {
			showTooltip = true;
			// Small delay for the DOM to update before calculating position
			requestAnimationFrame(() => {
				calculatePosition();
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
	class="tooltip-wrapper"
	bind:this={wrapperElement}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	{@render children()}
	
	{#if showTooltip}
		<div 
			bind:this={tooltipElement}
			class="tooltip tooltip-{adjustedPosition}"
			class:visible
			style={tooltipStyle}
			role="tooltip"
		>
			{text}
		</div>
	{/if}
</div>

<style>
	.tooltip-wrapper {
		position: relative;
		display: inline-flex;
	}

	.tooltip {
		position: fixed;
		z-index: 99999;
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 500;
		line-height: 1.4;
		color: #fafafa;
		background: #1a1a24;
		border: 1px solid #2a2a3a;
		border-radius: 6px;
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		
		/* Initial state - hidden */
		opacity: 0;
		transform: scale(0.95);
		transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.tooltip.visible {
		opacity: 1;
		transform: scale(1);
	}
</style>
