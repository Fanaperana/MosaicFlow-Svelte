import { describe, expect, it } from 'vitest';
import { KnowledgeIndex, extractTags, extractWikilinks } from '../src/knowledge';
import { markdownToNode, nodeToMarkdown, bodyMappingFor } from '../src/node-codec';
import { absoluteRects, findFreePosition, rectsOverlap } from '../src/layout';
import { autoLayout } from '../src/autolayout';
import type { StoredNode } from '../src/types';

describe('wikilinks and tags', () => {
  it('parses plain, aliased and cross-canvas links', () => {
    expect(extractWikilinks('See [[Fast I/O template]], [[Notes#Alan Turing|Turing]] and [[x]]')).toEqual([
      { raw: '[[Fast I/O template]]', target: 'Fast I/O template' },
      { raw: '[[Notes#Alan Turing|Turing]]', target: 'Alan Turing', canvas: 'Notes', alias: 'Turing' },
      { raw: '[[x]]', target: 'x' },
    ]);
  });

  it('collects #tags from text and data.tags but not from code, headings or colours', () => {
    const tags = extractTags({
      tags: ['Idea', '#todo'],
      content: '# Heading\nText #rust and #cp/graphs, colour #3b82f6, `#not` here\n```\n#include\n```',
      code: '#[derive(Debug)]',
      color: '#121c30',
    });
    expect(tags).toEqual(['cp/graphs', 'idea', 'rust', 'todo']);
  });
});

describe('KnowledgeIndex', () => {
  const index = new KnowledgeIndex([
    { id: 'c1', name: 'Rust', nodes: [
      { id: 'roadmap', type: 'note', data: { title: 'Roadmap', content: 'Start with [[Ownership]] then [[History#Turing]] and [[Missing]] #rust' } },
      { id: 'ownership', type: 'note', data: { title: 'Ownership', content: 'One owner per value. #rust #memory' } },
      { id: 'embed', type: 'embed', data: { title: 'Embed', ref: 'History#Turing' } },
    ] },
    { id: 'c2', name: 'History', nodes: [
      { id: 'turing', type: 'person', data: { title: 'Turing', notes: 'Computability' } },
      { id: 'ownership', type: 'note', data: { title: 'Ownership', content: 'Property law' } },
    ] },
  ]);

  it('resolves links, preferring the same canvas', () => {
    const out = index.outgoing('c1', 'roadmap');
    expect(out.map((o) => o.node && `${o.node.canvasId}/${o.node.id}`)).toEqual(['c1/ownership', 'c2/turing', null]);
  });

  it('finds backlinks across canvases, including embeds', () => {
    expect(index.backlinks('c2', 'turing').map((n) => n.id).sort()).toEqual(['embed', 'roadmap']);
  });

  it('ranks title matches first and supports #tag filters', () => {
    expect(index.search('ownership')[0].node.title).toBe('Ownership');
    expect(index.search('#memory').map((h) => h.node.id)).toEqual(['ownership']);
    expect(index.search('owner #rust', { canvasId: 'c1' }).map((h) => h.node.id)).toEqual(['ownership', 'roadmap']);
    expect(index.search('nothing-like-this')).toEqual([]);
  });

  it('counts tags', () => {
    expect(index.tagCounts('c1')).toEqual([{ tag: 'rust', count: 2 }, { tag: 'memory', count: 1 }]);
  });
});

describe('node codec', () => {
  it('round-trips a node through markdown', () => {
    const node: StoredNode = {
      id: 'n1', type: 'code', position: { x: 10, y: 20 }, width: 300, height: 200, parentId: 'g',
      data: { title: 'Snippet', language: 'rust', code: 'fn main() {}\n', color: '#111' },
    };
    const mapping = bodyMappingFor({ bodyField: 'code', bodyLanguageField: 'language' });
    const md = nodeToMarkdown(node, mapping);
    expect(md).toContain('```rust');
    const back = markdownToNode(md, () => mapping);
    expect(back.position).toEqual(node.position);
    expect(back.parentId).toBe('g');
    expect(back.data.code).toBe('fn main() {}\n');
    expect(back.data.title).toBe('Snippet');
  });
});

describe('layout', () => {
  it('computes absolute rects through nested parents', () => {
    const rects = absoluteRects([
      { id: 'g', position: { x: 100, y: 100 }, width: 500, height: 400 },
      { id: 'inner', parentId: 'g', position: { x: 30, y: 60 }, width: 300, height: 200 },
      { id: 'leaf', parentId: 'inner', position: { x: 10, y: 10 }, width: 50, height: 50 },
    ]);
    expect(rects.get('leaf')).toEqual({ x: 140, y: 170, width: 50, height: 50 });
  });

  it('finds a free spot that respects the minimum corner', () => {
    const occupied = [{ x: 30, y: 60, width: 300, height: 200 }];
    const p = findFreePosition(occupied, { width: 300, height: 200 }, { near: occupied[0], gap: 30, min: { x: 30, y: 60 } });
    expect(p.x).toBeGreaterThanOrEqual(30);
    expect(p.y).toBeGreaterThanOrEqual(60);
    expect(rectsOverlap({ ...p, width: 300, height: 200 }, occupied[0])).toBe(false);
  });

  it('lays out a graph left to right without overlaps', () => {
    const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, width: 200 + (i % 3) * 40, height: 100 + (i % 4) * 30 }));
    const edges = nodes.slice(1).map((n, i) => ({ source: `n${Math.floor(i / 2)}`, target: n.id }));
    const pos = autoLayout(nodes, edges);
    const rects = nodes.map((n) => ({ ...pos.get(n.id)!, width: n.width, height: n.height }));
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j])).toBe(false);
    for (const e of edges) expect(pos.get(e.source)!.x).toBeLessThan(pos.get(e.target)!.x);
  });
});
