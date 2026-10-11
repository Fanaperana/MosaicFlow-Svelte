<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		align = 'start',
		...restProps
	}: PopoverPrimitive.ContentProps = $props();
</script>

<PopoverPrimitive.Portal>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{align}
		collisionPadding={8}
		class={cn(
			'z-[1000] rounded-[9px] border border-(--mf-border-strong) bg-(--mf-surface-2) p-2 text-(--mf-text) shadow-[0_16px_40px_rgba(0,0,0,0.55),0_2px_8px_rgba(0,0,0,0.3)] outline-none',
			'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
			className
		)}
		{...restProps}
	/>
</PopoverPrimitive.Portal>
