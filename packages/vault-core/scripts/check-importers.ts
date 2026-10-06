// Checks for the importers and auto-layout (no IO).
// Usage: pnpm dlx tsx packages/vault-core/scripts/check-importers.ts

import {
  absoluteRects,
  autoLayout,
  exportJsonCanvas,
  importJsonCanvas,
  importMarkdownFiles,
  importMermaid,
  importMosaicJson,
  isJsonCanvas,
  isMosaicJson,
  rectsOverlap,
  type StoredNode,
} from '../src/index';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

function noOverlap(nodes: StoredNode[]) {
  const rects = absoluteRects(nodes);
  const leaves = nodes.filter((n) => n.type !== 'group');
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      if (rectsOverlap(rects.get(leaves[i].id)!, rects.get(leaves[j].id)!)) return `${leaves[i].id} overlaps ${leaves[j].id}`;
    }
  }
  return null;
}

// --- auto layout ---
const chain = autoLayout(
  [{ id: 'a', width: 200, height: 100 }, { id: 'b', width: 200, height: 100 }, { id: 'c', width: 200, height: 100 }, { id: 'lonely', width: 200, height: 100 }],
  [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }, { source: 'c', target: 'a' }]
);
assert(chain.get('a')!.x < chain.get('b')!.x && chain.get('b')!.x < chain.get('c')!.x, 'layered LR layout follows edges (cycle broken)');
assert(chain.get('lonely')!.y > chain.get('a')!.y + 100, 'isolated nodes go below');

// --- JSON Canvas round trip ---
const jc = {
  nodes: [
    { id: 'g1', type: 'group', x: -50, y: -80, width: 700, height: 400, label: 'Ideas', color: '6' },
    { id: 'n1', type: 'text', x: 0, y: 0, width: 250, height: 120, text: '# Hello\nworld', color: '4' },
    { id: 'n2', type: 'link', x: 350, y: 0, width: 250, height: 120, url: 'https://jsoncanvas.org' },
    { id: 'n3', type: 'file', x: 800, y: 0, width: 250, height: 120, file: 'Notes/Daily.md' },
  ],
  edges: [{ id: 'e1', fromNode: 'n1', fromSide: 'right', toNode: 'n2', toSide: 'left', label: 'see', color: '#ff0000' }],
};
assert(isJsonCanvas(jc), 'detects JSON Canvas');
const imported = importJsonCanvas(jc as Parameters<typeof importJsonCanvas>[0]);
const n1 = imported.nodes.find((n) => n.id === 'n1')!;
assert(n1.parentId === 'g1' && n1.position.x === 50 && n1.position.y === 80, 'spatial group membership with relative positions');
assert(n1.data.title === 'Hello' && imported.nodes.find((n) => n.id === 'n2')!.type === 'link', 'text/link/file nodes mapped');
assert(imported.edges[0].sourceHandle === 'right-source' && imported.edges[0].label === 'see', 'edge sides and labels kept');
const back = exportJsonCanvas(imported.nodes, imported.edges, (n) => String(n.data.content ?? n.data.title ?? ''));
const bn1 = back.nodes.find((n) => n.id === 'n1')!;
assert(bn1.x === 0 && bn1.y === 0 && back.nodes.find((n) => n.id === 'g1')!.type === 'group', 'exports back with absolute coordinates');

// --- MosaicFlow JSON ---
const mj = { metadata: { name: 'x' }, nodes: { a: { id: 'a', type: 'note', position: { x: 1, y: 2 }, data: { title: 'A' } }, bad: { id: '../x', type: 'note', position: { x: 0, y: 0 }, data: {} } }, edges: {} };
assert(isMosaicJson(mj), 'detects MosaicFlow JSON export');
const mres = importMosaicJson(mj as unknown as Parameters<typeof importMosaicJson>[0]);
assert(mres.nodes.length === 1 && mres.warnings.length === 1, 'rejects unsafe ids in JSON import');

// --- Markdown folder ---
const md = importMarkdownFiles([
  { path: 'Rust.md', content: '---\ntags: [lang]\n---\n# Rust\nSee [[Ownership]] and [[Cargo]].' },
  { path: 'Ownership.md', content: 'Each value has one owner. Related: [[Borrowing]]' },
  { path: 'Borrowing.md', content: 'References.' },
  { path: 'Cargo.md', content: 'Build tool.' },
  { path: 'Recipes/Pasta.md', content: 'Boil water.' },
  { path: 'Recipes/Soup.md', content: 'Simmer. See [[Pasta]].' },
]);
assert(md.edges.length === 4, `wikilinks become edges (${md.edges.length})`);
assert(md.nodes.find((n) => n.id === 'Rust')!.data.tags?.toString() === 'lang', 'frontmatter tags kept');
const recipes = md.nodes.find((n) => n.type === 'group');
assert(recipes?.data.title === 'Recipes' && md.nodes.filter((n) => n.parentId === recipes.id).length === 2, 'self-contained folders become groups');
assert(noOverlap(md.nodes) === null, `markdown import has no overlaps ${noOverlap(md.nodes) ?? ''}`);

// --- Mermaid ---
const mm = importMermaid(`flowchart LR
  A[Start] --> B{Is it?}
  B -->|Yes| C[OK]
  C --> D[Rethink]
  D --> B
  B -- No ----> E((End))
  subgraph S [Checks]
    C
    D
  end
  F[(DB)] -.-> A
  G & H --> A
  class C,D good
`);
const titles = mm.nodes.filter((n) => n.type === 'note').map((n) => n.data.title);
assert(['Start', 'Is it?', 'OK', 'Rethink', 'End', 'DB'].every((t) => titles.includes(t)), `mermaid labels parsed (${titles.join(', ')})`);
assert(mm.edges.some((e) => e.label === 'Yes') && mm.edges.some((e) => e.label === 'No'), 'mermaid edge labels (pipe and inline)');
assert(mm.edges.find((e) => e.source === 'F')?.data?.strokeStyle === 'dashed', 'dotted links become dashed');
assert(mm.edges.filter((e) => e.target === 'A').length === 3, '"&" fans out');
const group = mm.nodes.find((n) => n.type === 'group');
assert(group?.data.title === 'Checks' && mm.nodes.filter((n) => n.parentId === group.id).length === 2, 'subgraph becomes a group');
assert(noOverlap(mm.nodes) === null, `mermaid import has no overlaps ${noOverlap(mm.nodes) ?? ''}`);
let threw = false;
try { importMermaid('sequenceDiagram\nA->>B: hi'); } catch { threw = true; }
assert(threw, 'non-flowchart diagrams are rejected with a message');

console.log('\nAll importer checks passed');
