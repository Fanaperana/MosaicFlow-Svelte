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
	let tooltipElement = $state<HTMLDivElement | null>(null);
	let adjustedPosition = $state<'top' | 'bottom' | 'left' | 'right'>('bottom');
	let tooltipStyle = $state('');

	$effect(() => {
		adjustedPosition = position;
	});

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
	class="relative inline-flex"
	bind:this={wrapperElement}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	{@render children()}
	
	{#if showTooltip}
		<div 
			bind:this={tooltipElement}
			class="fixed z-99999 px-2 py-1 text-xs font-medium leading-snug text-[#fafafa] bg-[#1a1a24] border border-[#2a2a3a] rounded-md whitespace-nowrap pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.4)] opacity-0 scale-95 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] {visible ? 'opacity-100 scale-100' : ''}"
			style={tooltipStyle}
			role="tooltip"
		>
			{text}
		</div>
	{/if}
</div>
