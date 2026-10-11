<!-- The app's one tooltip look (.mf-tooltip in app.css), shared with SimpleTooltip, FixedTooltip and title="" tooltips. -->
<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 8,
		side = 'top',
		children,
		...restProps
	}: TooltipPrimitive.ContentProps = $props();
</script>

<TooltipPrimitive.Portal>
	<TooltipPrimitive.Content
		bind:ref
		data-slot="tooltip-content"
		{sideOffset}
		{side}
		collisionPadding={8}
		class={cn('mf-tooltip', className)}
		{...restProps}
	>
		{@render children?.()}
		<span class="mf-tooltip-arrow" aria-hidden="true"></span>
	</TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
