<script lang="ts">
	import { NodeResizer, Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
	import type { TimestampNodeData } from '$lib/types';
	import { Clock } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';

	type TimestampNode = Node<TimestampNodeData, 'timestamp'>;

	let { id, data, selected }: NodeProps<TimestampNode> = $props();

	let currentTime = $state(new Date());
	let interval: ReturnType<typeof setInterval>;

	// Custom timestamp support - if set, use it instead of live time
	const customTimestamp = $derived(data.customTimestamp);
	const displayTime = $derived(customTimestamp ? new Date(customTimestamp) : currentTime);

	// Display options - defaults to compact view
	const showTitle = $derived(data.showHeader ?? false);
	const multiLine = $derived((data as any).multiLine ?? false);
	
	// Date/time component toggles
	const showMonth = $derived(data.showMonth ?? true);
	const showYear = $derived(data.showYear ?? false);
	const showDayOfWeek = $derived(data.showDayOfWeek ?? false);
	const showDay = $derived(data.showDay ?? true);
	const showHour = $derived(data.showHour ?? true);
	const showMinute = $derived(data.showMinute ?? true);
	const showSecond = $derived(data.showSecond ?? false);
	const showMillisecond = $derived(data.showMillisecond ?? false);

	// Colors
	const textColor = $derived(data.textColor ?? '#e0e0e0');
	const bgColor = $derived(data.color ?? '#1a1d21');
	const borderColor = $derived(data.borderColor ?? '#333');
	
	// Border styling
	const borderWidth = $derived((data.borderWidth as number) ?? 1);
	const borderStyle = $derived((data.borderStyle as string) ?? 'solid');
	const borderRadius = $derived((data.borderRadius as number) ?? 4);
	const bgOpacity = $derived((data.bgOpacity as number) ?? 1);

	// Compute background with opacity
	function hexToRgba(hex: string, opacity: number): string {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (result) {
			const r = parseInt(result[1], 16);
			const g = parseInt(result[2], 16);
			const b = parseInt(result[3], 16);
			return `rgba(${r}, ${g}, ${b}, ${opacity})`;
		}
		return hex;
	}

	const backgroundColor = $derived(hexToRgba(bgColor, bgOpacity));

	onMount(() => {
		// Only update live time if not using custom timestamp
		if (!customTimestamp) {
			const updateInterval = showMillisecond ? 100 : 1000;
			interval = setInterval(() => {
				currentTime = new Date();
			}, updateInterval);
		}
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	// Format date parts
	const dateParts = $derived.by(() => {
		const parts: string[] = [];
		if (showDayOfWeek) parts.push(displayTime.toLocaleDateString('en-US', { weekday: 'short' }));
		if (showMonth) parts.push(displayTime.toLocaleDateString('en-US', { month: 'short' }));
		if (showDay) parts.push(displayTime.getDate().toString());
		if (showYear) parts.push(displayTime.getFullYear().toString());
		return parts.join(' ');
	});

	// Format time parts
	const timeParts = $derived.by(() => {
		const parts: string[] = [];
		if (showHour) parts.push(displayTime.getHours().toString().padStart(2, '0'));
		if (showMinute) parts.push(displayTime.getMinutes().toString().padStart(2, '0'));
		if (showSecond) parts.push(displayTime.getSeconds().toString().padStart(2, '0'));
		let timeStr = parts.join(':');
		if (showMillisecond) timeStr += '.' + displayTime.getMilliseconds().toString().padStart(3, '0');
		return timeStr;
	});

	// Single line format (default)
	const singleLineDisplay = $derived.by(() => {
		const parts: string[] = [];
		if (dateParts) parts.push(dateParts);
		if (timeParts) parts.push(timeParts);
		return parts.join(' • ');
	});

	const hasContent = $derived(dateParts || timeParts);
</script>

<NodeResizer
	minWidth={80}
	minHeight={28}
	isVisible={selected}
	lineStyle="border-color: #3b82f6"
	handleStyle="background: #3b82f6; width: 8px; height: 8px; border-radius: 2px;"
/>

<div
	class="timestamp-node"
	class:selected
	class:multi-line={multiLine}
	style="
		background: {backgroundColor}; 
		border-color: {borderColor}; 
		border-width: {borderWidth}px;
		border-style: {borderStyle};
		border-radius: {borderRadius}px;
		color: {textColor};
	"
>
	<Handle type="target" position={Position.Top} id="top" />
	<Handle type="target" position={Position.Left} id="left" />

	{#if showTitle && data.title}
		<div class="node-title">
			<Clock size={12} />
			<span>{data.title}</span>
		</div>
	{/if}

	<div class="timestamp-display">
		{#if hasContent}
			{#if multiLine}
				{#if dateParts}
					<span class="date-part">{dateParts}</span>
				{/if}
				{#if timeParts}
					<span class="time-part">{timeParts}</span>
				{/if}
			{:else}
				<Clock size={14} class="icon" />
				<span class="single-line">{singleLineDisplay}</span>
			{/if}
		{:else}
			<span class="empty">No display</span>
		{/if}
	</div>

	<Handle type="source" position={Position.Bottom} id="bottom" />
	<Handle type="source" position={Position.Right} id="right" />
</div>

<style>
	.timestamp-node {
		/* Border and background set via inline styles for customization */
		padding: 6px 10px;
		min-width: 80px;
		min-height: 28px;
		width: 100%;
		height: 100%;
		font-family: 'Space Mono', monospace;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
	}

	.timestamp-node.selected:not(.customizing) {
		box-shadow: 0 0 0 1px #3b82f6;
	}

	.timestamp-node.multi-line {
		padding: 8px 12px;
	}

	.node-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		color: #8b949e;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding-bottom: 4px;
		border-bottom: 1px solid rgba(255,255,255,0.1);
		margin-bottom: 2px;
	}

	.timestamp-display {
		display: flex;
		align-items: center;
		gap: 6px;
		font-variant-numeric: tabular-nums;
	}

	.timestamp-node.multi-line .timestamp-display {
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}

	.timestamp-display :global(.icon) {
		color: #8b949e;
		flex-shrink: 0;
	}

	.single-line {
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}

	.date-part {
		font-size: 11px;
		opacity: 0.8;
	}

	.time-part {
		font-size: 16px;
		font-weight: 600;
	}

	.empty {
		color: #8b949e;
		font-size: 11px;
		font-style: italic;
	}

	.timestamp-node :global(.svelte-flow__handle) {
		width: 8px;
		height: 8px;
		background: #555;
		border: 1px solid #333;
	}

	.timestamp-node :global(.svelte-flow__handle:hover) {
		background: #3b82f6;
		border-color: #3b82f6;
	}
</style>
