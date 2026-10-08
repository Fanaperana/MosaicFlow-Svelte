// End-to-end check: start the server over stdio against a throwaway vault and drive it with the MCP client.
// Usage: pnpm --filter @mosaicflow/mcp-server test [<vault to copy node-types from>]

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

async function main() {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'mosaic-mcp-'));
  await fs.writeFile(path.join(vault, 'vault.json'), JSON.stringify({ id: 'test-vault', name: 'Test' }));
  const source = process.argv[2];
  if (source) {
    await fs.mkdir(path.join(vault, '.mosaicflow'), { recursive: true });
    await fs.copyFile(path.join(source, '.mosaicflow', 'node-types.json'), path.join(vault, '.mosaicflow', 'node-types.json'));
  }

  const client = new Client({ name: 'smoke', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', path.join(here, '..', 'src', 'index.ts'), vault],
    cwd: path.join(here, '..'),
    stderr: 'ignore',
  }));

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as { text: string }[])[0].text;
    if (res.isError) throw new Error(`${name}: ${text}`);
    return JSON.parse(text);
  };
  const callError = async (name: string, args: Record<string, unknown>) => {
    const res = await client.callTool({ name, arguments: args });
    return res.isError ? (res.content as { text: string }[])[0].text : null;
  };

  try {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    assert(tools.includes('create_node') && tools.includes('search') && tools.length >= 12, `${tools.length} tools listed`);

    const guide = await call('get_guide');
    assert(guide.design.palette.violet && Array.isArray(guide.nodeTypes), 'guide has design + node types');

    await call('create_canvas', { name: 'MCP Test', tags: ['test'] });
    assert((await call('list_canvases')).some((c: { name: string }) => c.name === 'MCP Test'), 'canvas created and listed');

    const a = await call('create_node', { canvas: 'MCP Test', type: 'note', title: 'Ownership', palette: 'violet', data: { content: '# Ownership\nEach value has one owner.' } });
    const b = await call('create_node', { canvas: 'MCP Test', type: 'note', title: 'Borrowing', near: a.id, data: { content: 'References borrow without taking ownership.' } });
    assert(a.id === 'ownership' && b.id === 'borrowing', 'ids derived from titles');
    assert(b.x >= a.x + a.width, 'auto-placed beside "near" without overlap');

    const dup = await call('create_node', { canvas: 'MCP Test', type: 'note', title: 'Ownership' });
    assert(dup.id === 'ownership-2', 'duplicate titles get unique ids');

    const e = await call('connect', { canvas: 'MCP Test', source: a.id, target: b.id, label: 'enables' });
    assert(e.sourceHandle === 'right-source' && e.targetHandle === 'left-target', 'facing handles picked automatically');
    assert(await callError('connect', { canvas: 'MCP Test', source: a.id, target: b.id }), 'duplicate edge rejected');
    assert(await callError('connect', { canvas: 'MCP Test', source: a.id, target: a.id }), 'self-loop rejected');

    const g = await call('create_group', { canvas: 'MCP Test', title: 'Core concepts', nodeIds: [a.id, b.id], palette: 'violet' });
    const afterGroup = await call('read_canvas', { canvas: 'MCP Test' });
    const na = afterGroup.nodes.find((n: { id: string }) => n.id === a.id);
    assert(na.parent === g.id && na.x === a.x && na.y === a.y, 'grouping keeps absolute positions');
    assert(g.x === a.x - 30 && g.y === a.y - 60, 'group padding 30 / 60');

    const inside = await call('create_node', { canvas: 'MCP Test', type: 'note', title: 'Lifetimes', parentId: g.id });
    const grown = (await call('read_canvas', { canvas: 'MCP Test' })).nodes.find((n: { id: string }) => n.id === g.id);
    assert(inside.x + inside.width <= grown.x + grown.width && inside.y + inside.height <= grown.y + grown.height, 'group grows to fit a new child');

    await call('update_node', { canvas: 'MCP Test', id: b.id, parentId: null });
    const out = (await call('read_canvas', { canvas: 'MCP Test' })).nodes.find((n: { id: string }) => n.id === b.id);
    assert(!out.parent && out.x === b.x && out.y === b.y, 'moving out of a group keeps the absolute position');

    await call('update_node', { canvas: 'MCP Test', id: a.id, data: { content: 'Changed body', extra: 'x' } });
    await call('update_node', { canvas: 'MCP Test', id: a.id, data: { extra: null } });
    const full = (await call('read_canvas', { canvas: 'MCP Test', detail: 'full' })).nodes.find((n: { id: string }) => n.id === a.id);
    assert(full.data.content === 'Changed body' && !('extra' in full.data), 'data merge and null removal');

    const hits = await call('search', { query: 'borrow references' });
    assert(hits[0]?.nodeId === 'borrowing', 'search finds content across canvases');
    assert((await call('search', { query: 'what does borrowing mean for references?' })).length === 0, 'strict search needs every word');
    const question = await call('search', { query: 'what does borrowing mean for references?', match: 'any' });
    assert(question[0]?.nodeId === 'borrowing', 'search match "any" answers a question');
    const read = await call('read_nodes', { nodes: [{ canvas: 'MCP Test', nodeId: 'borrowing' }, { canvas: 'MCP Test', nodeId: 'nope' }] });
    assert(read[0].text.includes('References borrow') && read[1].error === 'not found', 'read_nodes returns full text and reports missing nodes');

    await call('create_node', { canvas: 'MCP Test', type: 'note', title: 'Smart pointers', data: { content: 'Builds on [[Borrowing]] and [[Missing note]]. #rust #memory' } });
    const links = await call('get_links', { canvas: 'MCP Test', nodeId: 'smart-pointers' });
    assert(links.outgoing.length === 2 && links.outgoing[0].resolved?.nodeId === 'borrowing' && links.outgoing[1].resolved === null, 'wikilinks resolve (and report unresolved)');
    const back = await call('get_links', { canvas: 'MCP Test', nodeId: 'borrowing' });
    assert(back.backlinks.some((b: { nodeId: string }) => b.nodeId === 'smart-pointers'), 'backlinks found');
    const tags = await call('list_tags', {});
    assert(tags.some((t: { tag: string }) => t.tag === 'memory'), 'tags listed');
    assert((await call('search', { query: '#memory' }))[0]?.nodeId === 'smart-pointers', '#tag search');

    await call('set_story_order', { canvas: 'MCP Test', nodeIds: [a.id, b.id] });
    const ordered = (await call('read_canvas', { canvas: 'MCP Test' })).nodes.filter((n: { order?: number }) => n.order);
    assert(ordered.length === 2, 'story order set');

    const mm = await call('import_mermaid', { name: 'Flow', mermaid: 'flowchart LR\n  a[Plan] --> b[Do]\n  b --> c[Check]\n  c -->|retry| b' });
    assert(mm.nodes === 3 && mm.edges === 3, 'mermaid canvas created');
    await call('update_node', { canvas: 'Flow', id: 'c', position: { x: -500, y: 900 } });
    await call('auto_layout', { canvas: 'Flow' });
    const flow = (await call('read_canvas', { canvas: 'Flow' })).nodes;
    const x = (id: string) => flow.find((n: { id: string }) => n.id === id).x;
    assert(x('a') < x('b') && x('b') < x('c'), 'auto_layout restores left-to-right order');

    const built = await call('build_knowledge', {
      canvas: 'Built Map',
      tags: ['ai'],
      groups: [{ key: 'people', title: 'People', palette: 'violet' }],
      nodes: [
        { key: 'intro', type: 'note', title: 'Overview', data: { content: 'Start with [[Ada]]. #history' } },
        { key: 'ada', type: 'note', title: 'Ada', group: 'people', data: { content: 'Wrote Note G.' } },
        { key: 'charles', type: 'note', title: 'Charles', group: 'people' },
      ],
      edges: [
        { from: 'intro', to: 'ada', label: 'starts with' },
        { from: 'ada', to: 'charles', label: 'worked with' },
        { from: 'ada', to: 'nobody' },
      ],
    }).catch((e: Error) => e.message);
    assert(typeof built === 'string' && built.includes('unknown key'), 'build_knowledge validates keys before writing');
    assert(!(await call('list_canvases')).some((c: { name: string }) => c.name === 'Built Map'), 'nothing written on invalid input');

    const map = await call('build_knowledge', {
      canvas: 'Built Map',
      tags: ['ai'],
      groups: [{ key: 'people', title: 'People', palette: 'violet' }],
      nodes: [
        { key: 'intro', type: 'note', title: 'Overview', data: { content: 'Start with [[Ada]]. #history' } },
        { key: 'ada', type: 'note', title: 'Ada', group: 'people', data: { content: 'Wrote Note G.' } },
        { key: 'charles', type: 'note', title: 'Charles', group: 'people' },
      ],
      edges: [
        { from: 'intro', to: 'ada', label: 'starts with' },
        { from: 'ada', to: 'charles', label: 'worked with' },
      ],
    });
    const builtCanvas = await call('read_canvas', { canvas: 'Built Map' });
    const byId = (id: string) => builtCanvas.nodes.find((n: { id: string }) => n.id === id);
    assert(map.created === 'new canvas' && builtCanvas.nodes.length === 4 && builtCanvas.edges.length === 2, 'build_knowledge creates canvas, group, nodes and edges');
    assert(byId(map.ids.ada).parent === map.ids.people && byId(map.ids.charles).parent === map.ids.people, 'build_knowledge puts nodes in their group');
    assert(byId(map.ids.intro).order === 1 && byId(map.ids.charles).order === 3, 'build_knowledge sets story order');
    const rects = builtCanvas.nodes.filter((n: { parent?: string }) => n.parent);
    const overlap = rects.some((r: { x: number; y: number; width: number; height: number }, i: number) =>
      rects.some((o: typeof r, j: number) => i !== j && r.x < o.x + o.width && o.x < r.x + r.width && r.y < o.y + o.height && o.y < r.y + r.height));
    assert(!overlap, 'build_knowledge lays out without overlaps');
    const again = await call('build_knowledge', { canvas: 'Built Map', nodes: [{ key: 'x', type: 'note', title: 'Extra' }], layout: 'none', story: false });
    assert(again.created === 'added to existing canvas', 'build_knowledge adds to an existing canvas');

    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    assert(prompts.includes('knowledge_map') && prompts.includes('ask_vault'), 'knowledge_map and ask_vault prompts listed');
    const prompt = await client.getPrompt({ name: 'knowledge_map', arguments: { topic: 'Rust ownership' } });
    assert(JSON.stringify(prompt.messages).includes('build_knowledge'), 'prompt points to build_knowledge');

    const del = await call('delete_node', { canvas: 'MCP Test', id: g.id });
    assert(del.detachedChildren.includes(a.id), 'deleting a group detaches children');
    const del2 = await call('delete_node', { canvas: 'MCP Test', id: a.id });
    assert(del2.removedEdges.length === 1, 'deleting a node removes its edges');

    assert(await callError('read_canvas', { canvas: '../../etc' }), 'unknown canvas rejected');
    assert(await callError('create_node', { canvas: 'MCP Test', type: 'note', title: 'x', id: '../evil' }), 'unsafe ids rejected');

    const md = await fs.readFile(path.join(vault, 'canvases', 'MCP Test', 'nodes', 'borrowing.md'), 'utf8');
    assert(md.startsWith('---\nid: borrowing'), 'nodes are written as markdown files');
    const leftovers = (await fs.readdir(path.join(vault, 'canvases', 'MCP Test', 'nodes'))).filter((f) => f.includes('.tmp-'));
    assert(leftovers.length === 0, 'no temp files left behind');
  } finally {
    await client.close();
    await fs.rm(vault, { recursive: true, force: true });
  }
  console.log('\nAll MCP smoke checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
