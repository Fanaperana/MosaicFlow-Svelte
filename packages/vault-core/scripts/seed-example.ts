// Seeds a sample "History of Computing" knowledge canvas into a vault using only the on-disk
// format (no app running) — the same path an MCP server will take.
// Usage: pnpm dlx tsx packages/vault-core/scripts/seed-example.ts "<vault path>"

import { DESIGN_GUIDE, type StoredEdge, type StoredNode } from '../src/index';
import { edge, vaultArg, writeCanvas } from './seed-lib';

const CANVAS_NAME = 'Example - History of Computing';

async function main() {
  await writeCanvas(
    vaultArg(),
    {
      name: CANVAS_NAME,
      description: 'Sample knowledge map: pioneers, institutions, a timeline and sources.',
      tags: ['example', 'history'],
    },
    buildNodes().map(applyLayout),
    buildEdges()
  );
}

const base = { color: '#1e1e1e' };

// One tinted fill + matching border per category keeps the mosaic readable at a glance.
const swatch = (name: keyof typeof DESIGN_GUIDE.palette, withText = false) => {
  const p = DESIGN_GUIDE.palette[name];
  return { color: p.fill, borderColor: p.border, ...(withText ? { textColor: p.text } : {}) };
};
const PALETTE = {
  people: swatch('violet'),
  org: swatch('teal'),
  time: swatch('amber', true),
  source: swatch('blue'),
  todo: swatch('rose'),
  place: swatch('emerald'),
  overview: swatch('neutral'),
};
const card = (p: Record<string, string>, radius = 10) => ({ ...p, borderWidth: 1, borderRadius: radius });

// [x, y, width, height, style] — sizes fit their content; gaps of 120-180px leave room for edges and labels.
// Pioneers run left-to-right in chronological order so each one connects straight down to its year.
const LAYOUT: Record<string, [number, number, number, number, Record<string, unknown>]> = {
  title: [0, -170, 2920, 80, { textColor: '#f5f5f5', fontSize: 34 }],
  'start-here': [-280, 40, 220, 90, { textColor: '#fb7185' }],
  overview: [0, 0, 340, 280, card(PALETTE.overview)],
  'wiki-analytical-engine': [0, 400, 340, 190, card(PALETTE.source)],
  'note-g': [0, 720, 340, 320, card(PALETTE.source)],
  pioneers: [480, 0, 1530, 390, { borderColor: '#8b5cf6', color: 'rgba(139, 92, 246, 0.06)', labelColor: '#a78bfa' }],
  'charles-babbage': [30, 60, 270, 300, card(PALETTE.people)],
  'ada-lovelace': [430, 60, 270, 300, card(PALETTE.people)],
  'alan-turing': [830, 60, 270, 300, card(PALETTE.people)],
  'grace-hopper': [1230, 60, 270, 300, card(PALETTE.people)],
  't-1837': [535, 560, 220, 80, card(PALETTE.time, 8)],
  't-1843': [935, 560, 220, 80, card(PALETTE.time, 8)],
  't-1936': [1335, 560, 220, 80, card(PALETTE.time, 8)],
  't-1944': [1735, 560, 220, 80, card(PALETTE.time, 8)],
  'todo-turing': [1275, 800, 340, 180, card(PALETTE.todo)],
  institutions: [2130, 0, 330, 690, { borderColor: '#14b8a6', color: 'rgba(20, 184, 166, 0.06)', labelColor: '#2dd4bf' }],
  'bletchley-park': [30, 60, 270, 260, card(PALETTE.org)],
  cambridge: [30, 400, 270, 260, card(PALETTE.org)],
  'bletchley-map': [2580, 0, 340, 500, card(PALETTE.place)],
  'further-reading': [2130, 800, 340, 290, card(PALETTE.source)],
};

function applyLayout(n: StoredNode): StoredNode {
  const entry = LAYOUT[n.id];
  if (!entry) return n;
  const [x, y, width, height, style] = entry;
  const step = STORY.indexOf(n.id);
  return { ...n, position: { x, y }, width, height, data: { ...n.data, ...style, ...(step >= 0 ? { order: step + 1 } : {}) } };
}

// Learning path shown by the Nodes sidebar "Story" view.
const STORY = [
  'title', 'overview',
  'charles-babbage', 't-1837', 'wiki-analytical-engine',
  'ada-lovelace', 't-1843', 'note-g',
  'alan-turing', 'cambridge', 't-1936', 'bletchley-park', 'bletchley-map',
  'grace-hopper', 't-1944',
  'todo-turing', 'further-reading',
];

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
      title: 'History of Computing',
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
        '- Pioneers run along the top, oldest first',
        '- Each one drops down to their year on the timeline',
        '- Institutions and places are on the right; sources on the left',
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

const VIOLET = DESIGN_GUIDE.palette.violet.border;
const AMBER = DESIGN_GUIDE.palette.amber.border;
const BLUE = DESIGN_GUIDE.palette.blue.border;
const TEAL = DESIGN_GUIDE.palette.teal.border;
const EMERALD = DESIGN_GUIDE.palette.emerald.border;
const ROSE = DESIGN_GUIDE.palette.rose.border;

function buildEdges(): StoredEdge[] {
  return [
    edge('e-overview-babbage', 'overview', 'charles-babbage', 'starts with', 'right-source', 'left-target', { color: VIOLET, path: 'smoothstep' }),
    edge('e-ada-babbage', 'ada-lovelace', 'charles-babbage', 'collaborated', 'left-source', 'right-target', { color: VIOLET, path: 'straight', start: 'arrowclosed', width: 2.5 }),
    edge('e-noteg-1843', 'note-g', 't-1843', 'published in', 'right-source', 'bottom-target', { color: BLUE, path: 'smoothstep', stroke: 'dashed', end: 'arrow' }),
    edge('e-wiki-1837', 'wiki-analytical-engine', 't-1837', 'source', 'right-source', 'left-target', { color: BLUE, stroke: 'dashed', end: 'arrow' }),

    edge('e-babbage-1837', 'charles-babbage', 't-1837', 'designed', 'bottom-source', 'top-target', { color: AMBER, path: 'step' }),
    edge('e-ada-1843', 'ada-lovelace', 't-1843', 'published', 'bottom-source', 'top-target', { color: AMBER, path: 'step' }),
    edge('e-turing-1936', 'alan-turing', 't-1936', 'published', 'bottom-source', 'top-target', { color: AMBER, path: 'step' }),
    edge('e-hopper-1944', 'grace-hopper', 't-1944', 'programmed', 'bottom-source', 'top-target', { color: AMBER, path: 'step' }),
    edge('e-1837-1843', 't-1837', 't-1843', 'then', 'right-source', 'left-target', { color: AMBER, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),
    edge('e-1843-1936', 't-1843', 't-1936', 'then', 'right-source', 'left-target', { color: AMBER, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),
    edge('e-1936-1944', 't-1936', 't-1944', 'then', 'right-source', 'left-target', { color: AMBER, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),

    edge('e-turing-bletchley', 'alan-turing', 'bletchley-park', 'worked at', 'top-source', 'top-target', { color: TEAL, path: 'smoothstep' }),
    edge('e-turing-cambridge', 'alan-turing', 'cambridge', 'studied at', 'bottom-source', 'left-target', { color: TEAL, path: 'smoothstep', stroke: 'dotted' }),
    edge('e-bletchley-map', 'bletchley-park', 'bletchley-map', 'located at', 'right-source', 'left-target', { color: EMERALD, path: 'straight' }),
    edge('e-todo-1936', 'todo-turing', 't-1936', 'read', 'top-source', 'bottom-target', { color: ROSE, path: 'straight', stroke: 'dashed', animated: true }),
  ];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
