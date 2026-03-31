<script lang="ts" module>
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

	export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	export type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};

	const base = "inline-flex shrink-0 items-center justify-center gap-2 rounded text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0";

	const variantStyles: Record<ButtonVariant, string> = {
		default: "bg-[#3d2b1f] text-[#e8d5c4] hover:bg-[#4a3428] border border-[#5a3d2e]",
		destructive: "bg-red-600 text-white hover:bg-red-500",
		outline: "bg-transparent border border-[#2a2a3a] text-[#c9d1d9] hover:bg-white/5",
		secondary: "bg-[#1a1a2e] text-[#c9d1d9] border border-[#2a2a3a] hover:bg-[#252540]",
		ghost: "text-[#c9d1d9] hover:bg-white/5",
		link: "text-blue-400 underline-offset-4 hover:underline",
	};

	const sizeStyles: Record<ButtonSize, string> = {
		default: "h-8 px-4 py-1.5",
		sm: "h-7 px-3 py-1 text-xs",
		lg: "h-9 px-5 py-2",
		icon: "size-8",
		"icon-sm": "size-7",
		"icon-lg": "size-9",
	};

	export function buttonClass(variant: ButtonVariant = "default", size: ButtonSize = "default", className?: unknown) {
		return cn(base, variantStyles[variant], sizeStyles[size], className as string);
	}
</script>

<script lang="ts">
	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();

	const computedClass = $derived(buttonClass(variant, size, className));
</script>

{#if href}
	<a
		bind:this={ref}
		{...restProps}
		data-slot="button"
		class={computedClass}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		{...restProps}
		data-slot="button"
		class={computedClass}
		{type}
		{disabled}
	>
		{@render children?.()}
	</button>
{/if}
