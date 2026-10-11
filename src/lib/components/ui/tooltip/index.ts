import { Tooltip as TooltipPrimitive } from 'bits-ui';
import Content from './tooltip-content.svelte';
import Trigger from './tooltip-trigger.svelte';

const Root = TooltipPrimitive.Root;
const Provider = TooltipPrimitive.Provider;

export {
	Root,
	Trigger,
	Content,
	Provider,
	Root as Tooltip,
	Content as TooltipContent,
	Trigger as TooltipTrigger,
	Provider as TooltipProvider,
};
