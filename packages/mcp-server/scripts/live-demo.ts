// Drives the bundled server against a real vault (used to watch MCP edits appear live in the app).
// Usage: node --import tsx scripts/live-demo.ts <vault> <canvas> add|remove

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const [vault, canvas, mode] = process.argv.slice(2);

const client = new Client({ name: 'live-demo', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, '..', 'dist', 'mosaicflow-mcp.mjs'), vault], stderr: 'ignore' }));
const call = async (name: string, args: Record<string, unknown>) => {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { text: string }[])[0].text;
  console.log(`${name}: ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
  return res.isError ? null : JSON.parse(text);
};

if (mode === 'add') {
  await call('create_node', { canvas, id: 'mcp-segment-tree', type: 'note', title: 'Segment tree (added by MCP)', palette: 'teal', near: 'fenwick', data: { content: '# Segment tree\n\nRange queries **and** range updates with lazy propagation. Reach for it when a Fenwick tree is not enough.' }, size: { width: 360, height: 200 } });
  await call('connect', { canvas, source: 'fenwick', target: 'mcp-segment-tree', label: 'generalises', style: { palette: 'teal', stroke: 'dashed' } });
} else {
  await call('delete_node', { canvas, id: 'mcp-segment-tree' });
}
await client.close();
