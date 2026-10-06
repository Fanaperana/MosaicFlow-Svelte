// One-off: apply the wikilink/tag text from seed-rust-cp.ts to an existing canvas through the MCP server.
// Usage: node --import tsx scripts/add-links.ts <vault>

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const vault = process.argv[2];
const canvas = 'Mastering Competitive Programming in Rust';

const client = new Client({ name: 'add-links', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, '..', 'dist', 'mosaicflow-mcp.mjs'), vault], stderr: 'ignore' }));

const read = await client.callTool({ name: 'read_canvas', arguments: { canvas, detail: 'full' } });
const nodes = JSON.parse((read.content as { text: string }[])[0].text).nodes as { id: string; data: Record<string, unknown> }[];
const content = (id: string) => String(nodes.find((n) => n.id === id)?.data.content ?? '');

const updates: Record<string, string> = {
  overview: content('overview')
    .replace('a fast I/O template and idiomatic iterators', '[[Fast I/O template]] and [[Iterator idioms]]')
    .replace('searching, prefix sums, DP, graphs', '[[Binary search]], [[Prefix sums]], DP, graphs')
    .replace('Every snippet compiles on stable Rust.', 'Read the [[Rust pitfalls in contests|pitfalls]] first. Where it all began: [[Example - History of Computing#Alan Turing]].\n\n#rust #roadmap'),
  pitfalls: content('pitfalls').replace('write to a `BufWriter`.', 'write to a `BufWriter`.\n\n#rust #pitfalls'),
  iterators: `${content('iterators')}\n\nPairs with the [[Fast I/O template]]. #rust #idioms`,
};
for (const [id, text] of Object.entries(updates)) {
  if (content(id).includes('#rust')) continue;
  const res = await client.callTool({ name: 'update_node', arguments: { canvas, id, data: { content: text } } });
  console.log(id, (res.content as { text: string }[])[0].text.replace(/\s+/g, ' ').slice(0, 80));
}
await client.close();
