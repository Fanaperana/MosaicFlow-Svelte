import type { NodeTypeSchema, NodeTypesDocument } from './types';

export const NODE_TYPES_FILE = '.mosaicflow/node-types.json';

export function buildNodeTypesDocument(nodeTypes: NodeTypeSchema[]): NodeTypesDocument {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    format: {
      vault: '<vault>/vault.json holds vault metadata; canvases live in <vault>/canvases/<canvas>/',
      node: '<canvas>/nodes/<id>.md: YAML frontmatter {id, type, title, layout, data} followed by a markdown body holding the data field named by knowledge.bodyField (default "notes")',
      edge: '<canvas>/edges/<id>/joined.json: {source, target, sourceHandle, targetHandle, label, type, animated, data}',
      layout: 'layout.x/y are canvas coordinates, or relative to layout.parent when set; parents must have capabilities.container',
    },
    nodeTypes,
  };
}
