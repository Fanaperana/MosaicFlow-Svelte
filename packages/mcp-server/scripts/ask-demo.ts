// Ad-hoc check: ask a vault a question the way an LLM would (read-only).
// Usage: pnpm --filter @mosaicflow/mcp-server exec tsx scripts/ask-demo.ts "<vault>" "<question>"
import { VaultRepository } from '@mosaicflow/vault-core';
import { nodeFsAdapter, toVaultPath } from '../src/nodeFs';
import { MosaicOps } from '../src/ops';

const [vault, question] = process.argv.slice(2);
const ops = new MosaicOps(new VaultRepository(nodeFsAdapter, toVaultPath(vault)));
const hits = await ops.search(question, { match: 'any', limit: 3 });
console.log(hits.map((h) => `${h.canvas} › ${h.title}  (${h.score.toFixed(1)})`).join('\n'));
const [top] = await ops.readNodes(hits.slice(0, 1).map((h) => ({ canvas: h.canvas, nodeId: h.nodeId })));
if (top && !('error' in top)) console.log(`\n${top.text.slice(0, 300)}\nlinks: ${top.links.map((l) => l.title).join(', ')}`);
