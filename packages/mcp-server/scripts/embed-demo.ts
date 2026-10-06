// Drives the bundled server against a real vault: adds (or removes) an embed of the Turing node on the Rust canvas.
// Usage: node --import tsx scripts/embed-demo.ts <vault> add|remove

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const [vault, mode] = process.argv.slice(2);
const canvas = 'Mastering Competitive Programming in Rust';

const client = new Client({ name: 'embed-demo', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, '..', 'dist', 'mosaicflow-mcp.mjs'), vault], stderr: 'ignore' }));
const call = async (name: string, args: Record<string, unknown>) => {
  const res = await client.callTool({ name, arguments: args });
  console.log(`${name}: ${(res.content as { text: string }[])[0].text.replace(/\s+/g, ' ').slice(0, 160)}`);
};

if (mode === 'add') {
  await call('create_node', {
    canvas, id: 'embed-turing', type: 'embed', title: 'Embed: Alan Turing',
    data: { ref: 'Example - History of Computing#Alan Turing' }, near: 'pitfalls', size: { width: 340, height: 200 },
  });
} else {
  await call('delete_node', { canvas, id: 'embed-turing' });
}
await client.close();
