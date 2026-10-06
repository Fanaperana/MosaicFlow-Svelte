/**
 * Re-export the workspace store for node packages.
 * Nodes should import from '@mosaicflow/node-sdk/store' instead of '$lib/stores/workspace.svelte'.
 */
export { workspace } from '$lib/stores/workspace.svelte';
export { knowledge } from '$lib/stores/knowledge.svelte';
export { openNode, openWikilink } from '$lib/services/navigation';
