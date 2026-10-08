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
    description:
      'Search node titles and content in all canvases (or one). match "all" (default): every word must match, "#tag" words match tags. ' +
      'match "any": for natural-language questions; common words are ignored and the best-covering nodes rank first. Use read_nodes on the hits to get their full text.',
    inputSchema: {
      query: z.string().min(1),
      canvas: canvas.optional(),
      limit: z.number().int().positive().max(100).optional(),
      match: z.enum(['all', 'any']).optional(),
    },
    annotations: readOnly,
  }, ({ query, canvas: ref, limit, match }) => run(() => ops.search(query, { canvas: ref, limit, match })));

  server.registerTool('read_nodes', {
    title: 'Read nodes',
    description: 'Full text, tags, resolved [[links]] and backlinks of specific nodes (from search results or links), across canvases. Use this to answer questions from the vault.',
    inputSchema: {
      nodes: z.array(z.object({ canvas, nodeId: z.string() })).min(1).max(30),
    },
    annotations: readOnly,
  }, ({ nodes }) => run(() => ops.readNodes(nodes)));

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
    description: 'Tidy nodes. mode "layered" (default) follows the edges (grid when there are none); mode "wrap" places nodeIds in the given order in rows, ideal for a page of groups. Lays out the top-level nodes, the children of parentId, or the given nodeIds (same parent). Groups grow to fit.',
    inputSchema: { canvas, parentId: z.string().optional(), nodeIds: z.array(z.string()).optional(), direction: z.enum(['LR', 'TB']).optional(), mode: z.enum(['layered', 'wrap']).optional() },
    annotations: write,
  }, (args) => run(() => ops.autoLayout(args)));

  server.registerTool('import_mermaid', {
    title: 'Create canvas from Mermaid',
    description: 'Create a new canvas from a Mermaid flowchart (flowchart LR / graph TD): nodes become notes, edge labels and dotted/thick styles are kept, subgraphs become groups. Fastest way to sketch a process.',
    inputSchema: { name: z.string().min(1), mermaid: z.string().min(1), description: z.string().optional() },
    annotations: write,
  }, (args) => run(() => ops.importMermaid(args)));

  server.registerTool('build_knowledge', {
    title: 'Build knowledge map',
    description:
      'Create a whole knowledge map in ONE call: the canvas (created if it does not exist, otherwise added to), groups, nodes and labelled edges, then auto layout and story order. ' +
      'Give every group and node a short unique "key" and reference those keys in node.group and edges. Prefer this over many create_node/connect calls. Call get_guide first for node types and fields.',
    inputSchema: {
      canvas: z.string().min(1).describe('Canvas name (new or existing) or id'),
      description: z.string().optional().describe('Description when the canvas is created'),
      tags: z.array(z.string()).optional().describe('Canvas tags when the canvas is created'),
      groups: z
        .array(z.object({ key: z.string().min(1), title: z.string().min(1), palette: palette.optional() }))
        .optional()
        .describe('Groups that frame related nodes (one per category)'),
      nodes: z
        .array(
          z.object({
            key: z.string().min(1),
            type: z.string().describe('Node type from get_guide, e.g. note, person, organization, link, timestamp, code'),
            title: z.string().min(1),
            data: z.record(z.string(), z.unknown()).optional().describe('Type fields, e.g. note: { content: "markdown with [[links]] and #tags" }'),
            palette: palette.optional(),
            group: z.string().optional().describe('Key of the group this node belongs to'),
            size: size.optional(),
          })
        )
        .min(1)
        .describe('Nodes in reading order (also used as the story order)'),
      edges: z
        .array(z.object({ from: z.string(), to: z.string(), label: z.string().optional().describe('1-3 words'), style: edgeStyle }))
        .optional(),
      layout: z.enum(['LR', 'TB', 'none']).optional().describe('Auto layout direction (default LR); none keeps auto-placement'),
      story: z.boolean().optional().describe('Set the story order from the node order (default true)'),
    },
    annotations: write,
  }, (args) => run(() => ops.buildKnowledge(args)));

  server.registerPrompt('ask_vault', {
    title: 'Ask my vault',
    description: 'Answer a question from the knowledge stored in this MosaicFlow vault, with sources.',
    argsSchema: { question: z.string().describe('What you want to know') },
  }, ({ question }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          `Answer this question using my MosaicFlow vault as the source: ${question}`,
          '',
          '1. search with match "any" using the key terms of the question (try 2-3 phrasings or synonyms if results are thin; use #tags if relevant).',
          '2. read_nodes on the most relevant hits; follow their links/backlinks with read_nodes when they add context.',
          '3. Answer from what the notes say. Cite each fact as (Canvas › Node title).',
          '4. Say clearly what the vault does not cover; only add outside knowledge if labelled "not in your vault".',
        ].join('\n'),
      },
    }],
  }));

  server.registerPrompt('knowledge_map', {
    title: 'Build a knowledge map',
    description: 'Research a topic and turn it into a connected MosaicFlow canvas.',
    argsSchema: {
      topic: z.string().describe('What the map is about'),
      canvas: z.string().optional().describe('Canvas name (defaults to the topic)'),
      depth: z.string().optional().describe('"overview" (10-20 nodes) or "deep" (30-60 nodes)'),
    },
  }, ({ topic, canvas: name, depth }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          `Build a MosaicFlow knowledge map about: ${topic}.`,
          `Canvas: "${name || topic}". Size: ${depth === 'deep' ? '30-60' : '10-20'} nodes.`,
          '',
          '1. Call get_guide and list_canvases. If related canvases exist, search them and link to their nodes with [[Canvas name#Node title]].',
          '2. Plan 3-6 categories (people, concepts, events, sources, ...); each becomes a group with its own palette.',
          '3. Write each node as a self-contained note: a clear title, 2-6 sentences or bullet points, [[links]] to related node titles and 1-3 #tags. Use specific node types where they fit (person, organization, timestamp, link, code).',
          '4. Connect nodes with short labelled edges that explain the relation ("influenced", "part of", "caused").',
          '5. Create everything with ONE build_knowledge call, nodes listed in the order a reader should follow.',
          '6. Read the canvas back with read_canvas (summary) and fix anything missing with update_node / connect.',
          'Only state facts you are confident about; put sources in link nodes.',
        ].join('\n'),
      },
    }],
  }));
}
