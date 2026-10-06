// Seeds a sample "History of Computing" knowledge canvas into a vault using only the on-disk
// format (no app running) — the same path an MCP server will take.
// Usage: pnpm dlx tsx packages/vault-core/scripts/seed-example.ts "<vault path>"

import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  CanvasRepository,
  NODE_TYPES_FILE,
  bodyMappingFor,
  type FsAdapter,
  type NodeTypesDocument,
  type StoredEdge,
  type StoredNode,
} from '../src/index';

const nodeFs: FsAdapter = {
  readText: (p) => fs.readFile(p, 'utf8'),
  writeText: (p, c) => fs.writeFile(p, c, 'utf8'),
  exists: (p) => fs.access(p).then(() => true, () => false),
  mkdir: async (p) => void (await fs.mkdir(p, { recursive: true })),
  remove: (p) => fs.rm(p, { recursive: true, force: true }),
  list: async (p) =>
    (await fs.readdir(p, { withFileTypes: true })).map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
};

const CANVAS_NAME = 'Example - History of Computing';

async function main() {
  const vaultPath = process.argv[2];
  if (!vaultPath) throw new Error('Pass the vault folder as the first argument');

  const vault = JSON.parse(await fs.readFile(path.join(vaultPath, 'vault.json'), 'utf8'));
  const types: NodeTypesDocument = JSON.parse(await fs.readFile(path.join(vaultPath, NODE_TYPES_FILE), 'utf8'));
  const knowledge = new Map(types.nodeTypes.map((t) => [t.type, t.knowledge]));

  const canvasPath = path.join(vaultPath, 'canvases', CANVAS_NAME);
  if (await nodeFs.exists(canvasPath)) throw new Error(`Canvas already exists: ${canvasPath}`);

  const now = new Date().toISOString();
  await fs.mkdir(path.join(canvasPath, '.mosaic'), { recursive: true });
  for (const dir of ['nodes', 'edges', 'images', 'attachments']) {
    await fs.mkdir(path.join(canvasPath, dir), { recursive: true });
  }
  await fs.writeFile(
    path.join(canvasPath, '.mosaic', 'meta.json'),
    JSON.stringify({
      id: randomUUID(),
      vault_id: vault.id,
      name: CANVAS_NAME,
      description: 'Sample knowledge map: pioneers, institutions, a timeline and sources.',
      tags: ['example', 'history'],
      created_at: now,
      updated_at: now,
      version: '2.0.0',
    }, null, 2)
  );
  await fs.writeFile(
    path.join(canvasPath, '.mosaic', 'state.json'),
    JSON.stringify({ viewport: { x: 0, y: 0, zoom: 1 }, selected_nodes: [], selected_edges: [], canvas_mode: '', updated_at: '' }, null, 2)
  );
  // Same empty manifest the backend writes for a brand-new canvas; nodes live in nodes/*.md.
  await fs.writeFile(path.join(canvasPath, 'workspace.json'), JSON.stringify({ version: '2.0.0', nodes: [], edges: [], settings: {} }, null, 2));

  const repo = new CanvasRepository(nodeFs, canvasPath.replaceAll('\\', '/'), (type) => bodyMappingFor(knowledge.get(type)));

  for (const node of buildNodes()) await repo.writeNode(node);
  for (const edge of buildEdges()) await repo.writeEdge(edge);

  console.log(`Created "${CANVAS_NAME}" with ${buildNodes().length} nodes and ${buildEdges().length} edges at ${canvasPath}`);
}

const base = { color: '#1e1e1e' };

function node(id: string, type: string, x: number, y: number, width: number, height: number, data: Record<string, unknown>, parentId?: string): StoredNode {
  return { id, type, position: { x, y }, width, height, zIndex: type === 'group' ? -1 : 1, parentId, data: { ...base, ...data } };
}

function timestamp(id: string, x: number, iso: string, label: string): StoredNode {
  return node(id, 'timestamp', x, 640, 200, 70, {
    title: label,
    label,
    customTimestamp: iso,
    datetime: iso,
    useCurrentTime: false,
    format: 'date',
    showYear: true,
    showMonth: true,
    showDay: true,
    showDayOfWeek: false,
    showHour: false,
    showMinute: false,
    showSecond: false,
    showMillisecond: false,
    showHeader: true,
  });
}

function buildNodes(): StoredNode[] {
  return [
    node('title', 'simpleText', 0, -150, 760, 80, {
      title: 'Title',
      content: 'History of Computing',
      fontSize: 28,
      bgOpacity: 0,
      borderWidth: 0,
    }),
    node('start-here', 'annotation', -260, 10, 200, 90, {
      title: 'Start here',
      label: 'Start here: read the overview, then follow the arrows',
      arrowPosition: 'right',
    }),
    node('overview', 'note', 0, 0, 340, 250, {
      title: 'Overview',
      viewMode: 'view',
      content: [
        '# Overview',
        '',
        'How the idea of a **general-purpose computer** moved from',
        "Babbage's mechanical designs to electronic machines.",
        '',
        '- Pioneers are grouped on the right',
        '- The timeline runs along the bottom',
        '- Sources and to-dos are in the far column',
      ].join('\n'),
    }),
    node('note-g', 'code', 0, 300, 340, 280, {
      title: 'Note G - Bernoulli numbers',
      language: 'python',
      code: [
        '# Modern sketch of the algorithm in Ada Lovelace\'s Note G (1843)',
        'from fractions import Fraction as F',
        'from math import comb',
        '',
        'def bernoulli(n):',
        '    B = [F(1)]',
        '    for m in range(1, n + 1):',
        '        B.append(-sum(comb(m + 1, k) * B[k] for k in range(m)) / (m + 1))',
        '    return B[n]',
      ].join('\n'),
    }),
    node('wiki-analytical-engine', 'link', 0, 640, 260, 140, {
      title: 'Analytical Engine',
      url: 'https://en.wikipedia.org/wiki/Analytical_engine',
      description: 'Babbage\'s proposed general-purpose mechanical computer.',
    }),

    node('pioneers', 'group', 420, 0, 620, 540, { title: 'Pioneers', label: 'Pioneers', description: 'People who shaped early computing.' }),
    node('ada-lovelace', 'person', 40, 70, 250, 200, {
      title: 'Ada Lovelace', name: 'Ada Lovelace', aliases: ['Augusta Ada King'], role: 'Mathematician',
      notes: 'Wrote the first published algorithm intended for a machine (Note G).',
    }, 'pioneers'),
    node('charles-babbage', 'person', 330, 70, 250, 200, {
      title: 'Charles Babbage', name: 'Charles Babbage', role: 'Mathematician & engineer',
      notes: 'Designed the Difference Engine and the Analytical Engine.',
    }, 'pioneers'),
    node('alan-turing', 'person', 40, 300, 250, 200, {
      title: 'Alan Turing', name: 'Alan Turing', role: 'Mathematician', organization: 'Bletchley Park',
      notes: 'Formalised computation with the Turing machine.',
    }, 'pioneers'),
    node('grace-hopper', 'person', 330, 300, 250, 200, {
      title: 'Grace Hopper', name: 'Grace Hopper', role: 'Computer scientist', organization: 'Harvard',
      notes: 'Programmed the Harvard Mark I; pioneered compilers.',
    }, 'pioneers'),

    node('institutions', 'group', 1100, 0, 330, 540, { title: 'Institutions', label: 'Institutions' }),
    node('bletchley-park', 'organization', 40, 70, 250, 200, {
      title: 'Bletchley Park', name: 'Bletchley Park', type: 'Codebreaking centre', location: 'Milton Keynes, UK',
    }, 'institutions'),
    node('cambridge', 'organization', 40, 300, 250, 200, {
      title: 'University of Cambridge', name: 'University of Cambridge', type: 'University', location: 'Cambridge, UK',
      website: 'https://www.cam.ac.uk',
    }, 'institutions'),

    timestamp('t-1837', 420, '1837-01-01T12:00:00.000Z', 'Analytical Engine designed'),
    timestamp('t-1843', 660, '1843-09-01T12:00:00.000Z', 'Note G published'),
    timestamp('t-1936', 900, '1936-11-12T12:00:00.000Z', 'On Computable Numbers'),
    timestamp('t-1944', 1140, '1944-08-07T12:00:00.000Z', 'Harvard Mark I operational'),

    node('bletchley-map', 'map', 1500, 0, 340, 280, {
      title: 'Bletchley Park', latitude: 51.9977, longitude: -0.7407, zoom: 14, label: 'Bletchley Park',
      address: 'Sherwood Dr, Bletchley, Milton Keynes MK3 6EB, UK',
    }),
    node('todo-turing', 'action', 1500, 320, 280, 160, {
      title: 'Read Turing 1936', action: "Read Turing's 'On Computable Numbers' and summarise it in a note",
      status: 'pending', priority: 'high',
    }),
    node('further-reading', 'linkList', 1500, 520, 300, 200, {
      title: 'Further reading',
      links: [
        { id: 'l1', label: 'Ada Lovelace (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Ada_Lovelace' },
        { id: 'l2', label: 'Turing machine (Stanford Encyclopedia)', url: 'https://plato.stanford.edu/entries/turing-machine/' },
        { id: 'l3', label: 'Harvard Mark I (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Harvard_Mark_I' },
      ],
    }),
  ];
}

function edge(id: string, source: string, target: string, label: string, sourceHandle: string, targetHandle: string): StoredEdge {
  return {
    id, source, target, sourceHandle, targetHandle, label,
    type: 'default',
    animated: false,
    data: { color: '#6b7280', strokeWidth: 2, markerEnd: 'arrowclosed' },
  };
}

function buildEdges(): StoredEdge[] {
  return [
    edge('e-overview-ada', 'overview', 'ada-lovelace', 'starts with', 'right-source', 'left-target'),
    edge('e-noteg-ada', 'note-g', 'ada-lovelace', 'written by', 'right-source', 'left-target'),
    edge('e-ada-babbage', 'ada-lovelace', 'charles-babbage', 'collaborated with', 'right-source', 'left-target'),
    edge('e-ada-1843', 'ada-lovelace', 't-1843', 'published', 'bottom-source', 'top-target'),
    edge('e-babbage-1837', 'charles-babbage', 't-1837', 'designed', 'bottom-source', 'top-target'),
    edge('e-wiki-1837', 'wiki-analytical-engine', 't-1837', 'source', 'right-source', 'left-target'),
    edge('e-turing-bletchley', 'alan-turing', 'bletchley-park', 'worked at', 'right-source', 'left-target'),
    edge('e-turing-cambridge', 'alan-turing', 'cambridge', 'studied at', 'right-source', 'left-target'),
    edge('e-turing-1936', 'alan-turing', 't-1936', 'published', 'bottom-source', 'top-target'),
    edge('e-hopper-1944', 'grace-hopper', 't-1944', 'programmed', 'bottom-source', 'top-target'),
    edge('e-bletchley-map', 'bletchley-park', 'bletchley-map', 'located at', 'right-source', 'left-target'),
    edge('e-todo-1936', 'todo-turing', 't-1936', 'about', 'left-source', 'right-target'),
  ];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
