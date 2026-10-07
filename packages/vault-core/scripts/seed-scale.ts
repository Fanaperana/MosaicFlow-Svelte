// Seeds a large synthetic vault and measures how long reading + indexing it takes.
// Usage: pnpm dlx tsx packages/vault-core/scripts/seed-scale.ts "<vault path>" [canvases=200] [nodesPerCanvas=100] [--read-only]

import { performance } from 'node:perf_hooks';
import { CanvasRepository, KnowledgeIndex, VaultRepository, type IndexCanvas, type StoredEdge, type StoredNode } from '../src/index';
import { nodeFs, vaultArg } from './seed-lib';

const TAGS = ['research', 'osint', 'person', 'org', 'todo', 'rust', 'history', 'idea', 'source', 'draft'];
const WORDS = 'alpha beta gamma delta lorem ipsum dolor sit amet graph node canvas vault index search link tag note'.split(' ');

// Deterministic PRNG so runs are comparable.
let prng = 42;
const rand = () => ((prng = (prng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const words = (n: number) => Array.from({ length: n }, () => pick(WORDS)).join(' ');

function buildCanvas(c: number, nodesPerCanvas: number, canvases: number): { nodes: StoredNode[]; edges: StoredEdge[] } {
  const nodes: StoredNode[] = [];
  for (let i = 0; i < nodesPerCanvas; i++) {
    const otherCanvas = `Scale ${String(Math.floor(rand() * canvases)).padStart(4, '0')}`;
    const notes = [
      words(40),
      `See [[c${c}-n${Math.floor(rand() * nodesPerCanvas)}]] and [[${otherCanvas}#c${c}-n0]].`,
      `#${pick(TAGS)} #${pick(TAGS)}`,
    ].join('\n\n');
    nodes.push({
      id: `c${c}-n${i}`,
      type: 'note',
      position: { x: (i % 20) * 320, y: Math.floor(i / 20) * 260 },
      width: 280,
      height: 200,
      zIndex: 1,
      data: { title: `Node ${c}.${i} ${words(2)}`, notes, color: '#1e1e1e' },
    });
  }
  const edges: StoredEdge[] = [];
  for (let i = 0; i < Math.floor(nodesPerCanvas * 0.75); i++) {
    const a = Math.floor(rand() * nodesPerCanvas);
    const b = Math.floor(rand() * nodesPerCanvas);
    if (a === b) continue;
    edges.push({ id: `c${c}-e${i}`, source: `c${c}-n${a}`, target: `c${c}-n${b}`, type: 'default', data: {} } as StoredEdge);
  }
  return { nodes, edges };
}

async function seed(vault: VaultRepository, canvases: number, nodesPerCanvas: number) {
  const t0 = performance.now();
  for (let c = 0; c < canvases; c++) {
    const { repo } = await vault.createCanvas({ name: `Scale ${String(c).padStart(4, '0')}`, tags: ['scale'] });
    const { nodes, edges } = buildCanvas(c, nodesPerCanvas, canvases);
    await Promise.all(nodes.map((n) => repo.writeNode(n)));
    await Promise.all(edges.map((e) => repo.writeEdge(e)));
    if ((c + 1) % 50 === 0) console.log(`  seeded ${c + 1}/${canvases} canvases`);
  }
  console.log(`Seeded ${canvases} canvases x ${nodesPerCanvas} nodes in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

async function measure(vault: VaultRepository) {
  const t0 = performance.now();
  const entries = await vault.listCanvases();
  const tList = performance.now();
  const resolver = await vault.bodyMappingResolver();
  const indexed: IndexCanvas[] = [];
  let nodeCount = 0;
  let edgeCount = 0;
  for (const entry of entries) {
    const repo = new CanvasRepository(nodeFs, entry.path, resolver);
    const { nodes, edges } = await repo.readAll();
    nodeCount += nodes.length;
    edgeCount += edges.length;
    indexed.push({ id: entry.id, name: entry.name, nodes });
  }
  const tRead = performance.now();
  const index = new KnowledgeIndex(indexed);
  const tIndex = performance.now();
  const hits = index.search('#osint graph', { limit: 50 });
  const tSearch = performance.now();

  console.log(`Canvases: ${entries.length}, nodes: ${nodeCount}, edges: ${edgeCount}`);
  console.log(`  list canvases : ${(tList - t0).toFixed(0)} ms`);
  console.log(`  read + parse  : ${(tRead - tList).toFixed(0)} ms`);
  console.log(`  build index   : ${(tIndex - tRead).toFixed(0)} ms`);
  console.log(`  search        : ${(tSearch - tIndex).toFixed(1)} ms (${hits.length} hits)`);
}

async function main() {
  const vaultPath = vaultArg().replaceAll('\\', '/');
  const [canvases = 200, nodesPerCanvas = 100] = process.argv.slice(3).filter((a) => !a.startsWith('--')).map(Number);
  const vault = new VaultRepository(nodeFs, vaultPath);
  if (!process.argv.includes('--read-only')) await seed(vault, canvases, nodesPerCanvas);
  await measure(vault);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
