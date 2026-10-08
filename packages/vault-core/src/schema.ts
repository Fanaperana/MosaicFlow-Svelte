import type { DesignGuide, NodeTypeSchema, NodeTypesDocument } from './types';

export const NODE_TYPES_FILE = '.mosaicflow/node-types.json';

export const DESIGN_GUIDE: DesignGuide = {
  goal: 'Build a readable "mosaic": related nodes clustered in groups, colour-coded by category, connected by short labelled edges, with no clipped content.',
  nodeStyleFields: {
    color: 'Card fill (hex or rgba). Use a dark tint of the category colour, e.g. #1d1a2e for violet.',
    borderColor: 'Card border; the saturated category colour, e.g. #8b5cf6.',
    borderWidth: 'Border width in px (1 for cards, 0 to hide).',
    borderRadius: 'Corner radius in px (8-12 looks modern).',
    borderStyle: 'solid | dashed | dotted | none',
    textColor: 'Text colour; a light tint of the category colour for emphasis.',
    bgOpacity: 'simpleText only: 0 for a transparent heading.',
    fontSize: 'simpleText / annotation font size in px (headings 28-36).',
    labelColor: 'group only: colour of the group heading.',
  },
  edgeStyleFields: {
    type: 'Edge file top-level: default (bezier) | straight | step | smoothstep. Also set data.pathType to the same value (bezier for default).',
    animated: 'Edge file top-level boolean; also mirror it in data.animated. Animated dashes suggest flow or sequence.',
    color: 'Stroke colour; usually the colour of the category the edge points to.',
    strokeWidth: 'px, 2 by default (2.5-3 to emphasise a key relation).',
    strokeStyle: 'solid | dashed | dotted (dashed for references/sources, dotted for weak or sequential links).',
    markerStart: 'none | arrow | arrowclosed (set both ends for mutual relations such as "collaborated").',
    markerEnd: 'none | arrow | arrowclosed (arrowclosed for strong directed relations, arrow for light ones).',
    labelColor: 'Label text colour (match the stroke).',
    labelBgColor: 'Label background; use the canvas colour #0d1117 so the label stays readable over lines.',
  },
  palette: {
    violet: { fill: '#1d1a2e', border: '#8b5cf6', text: '#c4b5fd' },
    teal: { fill: '#11251f', border: '#14b8a6', text: '#5eead4' },
    amber: { fill: '#2a2212', border: '#f59e0b', text: '#fcd34d' },
    blue: { fill: '#121c30', border: '#3b82f6', text: '#93c5fd' },
    rose: { fill: '#2a1319', border: '#f43f5e', text: '#fda4af' },
    emerald: { fill: '#0f2219', border: '#10b981', text: '#6ee7b7' },
    neutral: { fill: '#18181d', border: '#e5e7eb', text: '#f5f5f5' },
  },
  rules: [
    'Never clip content: start from defaultSize and add ~20px height per extra line of text (~40 characters per line at 280px width).',
    'Give each category one palette entry and use it for every node of that category; groups use a 6% opacity fill of the same colour and labelColor = the text colour.',
    'Lay out on a 10px grid with 40px gaps between top-level nodes and 30px gaps inside groups.',
    'Group children use coordinates relative to the group: 30px side padding and 60px top padding for the heading; size the group to its children plus padding.',
    'Flow left-to-right: connect right-source -> left-target between columns and bottom-source -> top-target into a row below, so edges do not cross cards.',
    'Put timelines on one horizontal row, oldest on the left; store dates at 12:00 UTC so they do not shift a day in other time zones.',
    'Keep edge labels to 1-3 words; colour edges by the target category.',
    'Edges are drawn underneath nodes: never route an edge through a card. Leave 120-180px between columns and rows so lines and labels have a visible lane.',
    'Pick the path type by geometry: straight for neighbours on the same row or column, step for vertical drops into a row below (person -> their year), smoothstep for cross-column links that must turn a corner, bezier for short diagonal hops.',
    'Encode meaning in the stroke: solid = factual relation, dashed = reference/source, dotted + animated = sequence or flow (timeline "then" links), both-end arrows = mutual relation.',
    'When several edges leave one node toward different targets, use different handles (e.g. top for one, bottom for another) so their lanes and labels do not stack.',
    'Order nodes so the main flow does not cross itself (e.g. people left-to-right in the same order as their dates on the timeline below).',
    'Add a large transparent simpleText heading above the board and an annotation pointing at the entry node.',
    'Define the learning path with data.order = 1..N on every connectable node (heading first, then the story beat by beat); the Nodes sidebar "Story" view and its next/previous buttons follow it. Nodes without order come after, in reading order.',
    'Use findFreePosition (vault-core) or the gaps above to avoid overlapping existing nodes.',
  ],
};

export function buildNodeTypesDocument(nodeTypes: NodeTypeSchema[]): NodeTypesDocument {
  return {
    schemaVersion: 1,
    format: {
      vault: '<vault>/vault.json holds vault metadata; canvases live in <vault>/canvases/<canvas>/ with metadata and settings in <canvas>/canvas.json',
      node: '<canvas>/nodes/<id>.md: YAML frontmatter {id, type, title, layout, data} followed by a markdown body holding the data field named by knowledge.bodyField (default "notes")',
      edge: '<canvas>/edges/<id>.json: {source, target, sourceHandle, targetHandle, label, type, animated, data}',
      layout: 'layout.x/y are canvas coordinates, or relative to layout.parent when set; parents must have capabilities.container',
      handles: 'Connectable nodes expose {left,right,top,bottom}-{source,target} handles',
    },
    design: DESIGN_GUIDE,
    nodeTypes,
  };
}
