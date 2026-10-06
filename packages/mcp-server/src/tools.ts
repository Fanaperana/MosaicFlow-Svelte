import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MosaicOps } from './ops';

const side = z.enum(['left', 'right', 'top', 'bottom']);
const point = z.object({ x: z.number(), y: z.number() });
const size = z.object({ width: z.number().positive(), height: z.number().positive() });
const canvas = z.string().describe('Canvas name or id (see list_canvases)');
const palette = z.string().describe('Palette name: violet, teal, amber, blue, rose, emerald or neutral');
const edgeStyle = z
  .object({
    color: z.string().optional().describe('Stroke colour (hex). Defaults to the target node border colour.'),
    palette: palette.optional(),
    path: z.enum(['bezier', 'straight', 'step', 'smoothstep']).optional(),
    stroke: z.enum(['solid', 'dashed', 'dotted']).optional(),
    animated: z.boolean().optional(),
    start: z.enum(['none', 'arrow', 'arrowclosed']).optional(),
    end: z.enum(['none', 'arrow', 'arrowclosed']).optional(),
    width: z.number().positive().optional(),
  })
  .optional();

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true };
  }
}

const readOnly = { readOnlyHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const destructive = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

export function registerTools(server: McpServer, ops: MosaicOps) {
  server.registerTool('get_guide', {
    title: 'MosaicFlow guide',
    description: 'Node types (purpose, fields, default sizes), the design guide (palette, layout and edge rules) and the recommended workflow. Call this first.',
    annotations: readOnly,
  }, () => run(() => ops.guide()));

  server.registerTool('list_canvases', {
    title: 'List canvases',
    description: 'All canvases in the vault, most recently updated first.',
    annotations: readOnly,
  }, () => run(() => ops.listCanvases()));

  server.registerTool('create_canvas', {
    title: 'Create canvas',
    description: 'Create an empty canvas.',
    inputSchema: { name: z.string().min(1), description: z.string().optional(), tags: z.array(z.string()).optional() },
    annotations: write,
  }, (args) => run(() => ops.createCanvas(args)));

  server.registerTool('read_canvas', {
    title: 'Read canvas',
    description: 'Nodes (with absolute x/y/width/height, parent, story order) and edges of a canvas. detail "summary" gives a text preview per node; "full" returns every data field.',
    inputSchema: { canvas, detail: z.enum(['summary', 'full']).optional() },
    annotations: readOnly,
  }, ({ canvas: ref, detail }) => run(() => ops.readCanvas(ref, detail)));

  server.registerTool('search', {
    title: 'Search vault',
    description: 'Full-text search over node titles and content in all canvases (or one). Every word must match; "#tag" words match tags.',
    inputSchema: { query: z.string().min(1), canvas: canvas.optional(), limit: z.number().int().positive().max(100).optional() },
    annotations: readOnly,
  }, ({ query, canvas: ref, limit }) => run(() => ops.search(query, { canvas: ref, limit })));

  server.registerTool('get_links', {
    title: 'Links and backlinks',
    description: 'The [[wikilinks]] a node makes (resolved to nodes, possibly on other canvases) and the nodes that link to it.',
    inputSchema: { canvas, nodeId: z.string() },
    annotations: readOnly,
  }, ({ canvas: ref, nodeId }) => run(() => ops.links(ref, nodeId)));

  server.registerTool('list_tags', {
    title: 'List tags',
    description: 'Tags used in the vault (or one canvas) with counts. Tags come from data.tags and #tag words in text.',
    inputSchema: { canvas: canvas.optional() },
    annotations: readOnly,
  }, ({ canvas: ref }) => run(() => ops.tags(ref)));

  server.registerTool('create_node', {
    title: 'Create node',
    description: 'Add a node. Omit position to auto-place it without overlapping (beside "near" if given; it joins near\'s group). With parentId the node goes inside that group (position relative to it) and the group grows to fit.',
    inputSchema: {
      canvas,
      type: z.string().describe('Node type, e.g. note, person, organization, link, code, action, timestamp, group (see get_guide)'),
      title: z.string(),
      data: z.record(z.string(), z.unknown()).optional().describe('Type-specific fields from get_guide (e.g. note.content, person.role, code.code + language)'),
      palette: palette.optional(),
      parentId: z.string().optional(),
      near: z.string().optional().describe('Place next to this node id'),
      position: point.optional(),
      size: size.optional(),
      id: z.string().optional().describe('Custom id (letters, digits, - _ .); generated from the title otherwise'),
    },
    annotations: write,
  }, (args) => run(() => ops.createNode(args)));

  server.registerTool('update_node', {
    title: 'Update node',
    description: 'Change a node: merge data fields (null removes a field), retitle, restyle with a palette, move, resize, or move into/out of a group (parentId; null = top level). Positions are relative to the parent.',
    inputSchema: {
      canvas,
      id: z.string(),
      title: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      palette: palette.optional(),
      position: point.optional(),
      size: size.optional(),
      parentId: z.string().nullable().optional(),
    },
    annotations: write,
  }, (args) => run(() => ops.updateNode(args)));

  server.registerTool('delete_node', {
    title: 'Delete node',
    description: 'Delete a node and its edges. Children of a deleted group stay in place.',
    inputSchema: { canvas, id: z.string() },
    annotations: destructive,
  }, ({ canvas: ref, id }) => run(() => ops.deleteNode(ref, id)));

  server.registerTool('connect', {
    title: 'Connect nodes',
    description: 'Add a labelled edge. Handle sides are chosen from the node positions unless given. Keep labels to 1-3 words.',
    inputSchema: {
      canvas,
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
      sourceSide: side.optional(),
      targetSide: side.optional(),
      style: edgeStyle,
      id: z.string().optional(),
    },
    annotations: write,
  }, (args) => run(() => ops.connect(args)));

  server.registerTool('update_edge', {
    title: 'Update edge',
    description: 'Change an edge label, sides or style.',
    inputSchema: { canvas, id: z.string(), label: z.string().optional(), sourceSide: side.optional(), targetSide: side.optional(), style: edgeStyle },
    annotations: write,
  }, (args) => run(() => ops.updateEdge(args)));

  server.registerTool('delete_edge', {
    title: 'Delete edge',
    description: 'Delete an edge.',
    inputSchema: { canvas, id: z.string() },
    annotations: destructive,
  }, ({ canvas: ref, id }) => run(() => ops.deleteEdge(ref, id)));

  server.registerTool('create_group', {
    title: 'Group nodes',
    description: 'Wrap existing nodes (same parent) in a titled group sized to fit them with padding.',
    inputSchema: { canvas, title: z.string(), nodeIds: z.array(z.string()).min(1), palette: palette.optional(), id: z.string().optional() },
    annotations: write,
  }, (args) => run(() => ops.createGroup(args)));

  server.registerTool('set_story_order', {
    title: 'Set story order',
    description: 'Define the reading path shown by the Story view: nodeIds in order (others lose their order).',
    inputSchema: { canvas, nodeIds: z.array(z.string()).min(1) },
    annotations: write,
  }, ({ canvas: ref, nodeIds }) => run(() => ops.setStoryOrder(ref, nodeIds)));

  server.registerTool('auto_layout', {
    title: 'Auto layout',
    description: 'Tidy nodes with a layered layout that follows the edges (grid when there are none). Lays out the top-level nodes, the children of parentId, or the given nodeIds (same parent). Groups grow to fit.',
    inputSchema: { canvas, parentId: z.string().optional(), nodeIds: z.array(z.string()).optional(), direction: z.enum(['LR', 'TB']).optional() },
    annotations: write,
  }, (args) => run(() => ops.autoLayout(args)));

  server.registerTool('import_mermaid', {
    title: 'Create canvas from Mermaid',
    description: 'Create a new canvas from a Mermaid flowchart (flowchart LR / graph TD): nodes become notes, edge labels and dotted/thick styles are kept, subgraphs become groups. Fastest way to sketch a process.',
    inputSchema: { name: z.string().min(1), mermaid: z.string().min(1), description: z.string().optional() },
    annotations: write,
  }, (args) => run(() => ops.importMermaid(args)));
}
