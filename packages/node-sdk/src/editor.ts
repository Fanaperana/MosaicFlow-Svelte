/**
 * Re-export editor components for node packages.
 * Nodes should import from '@mosaicflow/node-sdk/editor' instead of '$lib/components/editor'.
 */
export { CodeEditor, RichMarkdownEditor, richContent, hydrateRichContent } from '@mosaicflow/editor';
