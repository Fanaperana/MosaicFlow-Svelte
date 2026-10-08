// Knowledge layer shared by the app and the MCP server: plain text of a node, [[wikilinks]], #tags,
// and a vault-wide index for search, link resolution and backlinks.

import type { StoredNode } from './types';

export interface Wikilink {
  raw: string;
  /** Node title (or id) being linked. */
  target: string;
  /** Optional canvas name, from [[Canvas Name#Node title]]. */
  canvas?: string;
  alias?: string;
}

const WIKILINK = /\[\[([^[\]\n|]+?)(?:\|([^[\]\n]+?))?\]\]/g;
// A tag starts with a letter so headings ("# Title") and colours ("#3b82f6") are not tags.
const HASHTAG = /(^|[\s(])#([A-Za-z][\w/-]*)/g;

/** Data keys that only affect appearance; ignored for search and previews. */
export const STYLE_KEYS = new Set([
  'color', 'borderColor', 'borderWidth', 'borderRadius', 'borderStyle', 'textColor', 'bgOpacity', 'fontSize',
  'labelColor', 'locked', 'order', 'viewMode', 'labelBgColor', 'strokeWidth', 'strokeStyle', 'showHeader',
]);

function textOf(value: unknown, depth = 0): string {
  if (value == null || depth > 4) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((v) => textOf(v, depth + 1)).join(' ');
  if (typeof value === 'object') {
    return Object.entries(value).filter(([k]) => k !== 'id').map(([, v]) => textOf(v, depth + 1)).join(' ');
  }
  return '';
}

/** All searchable text of a node's data (title first), without styling fields. */
export function nodeText(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([k]) => !STYLE_KEYS.has(k))
    .map(([, v]) => textOf(v))
    .filter(Boolean)
    .join('\n');
}

export function extractWikilinks(text: string): Wikilink[] {
  const links: Wikilink[] = [];
  for (const m of text.matchAll(WIKILINK)) {
    const ref = m[1].trim();
    const hash = ref.indexOf('#');
    links.push({
      raw: m[0],
      target: hash > 0 ? ref.slice(hash + 1).trim() : ref,
      ...(hash > 0 ? { canvas: ref.slice(0, hash).trim() } : {}),
      ...(m[2] ? { alias: m[2].trim() } : {}),
    });
  }
  return links;
}

export function extractTags(data: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  const explicit = data.tags;
  if (Array.isArray(explicit)) explicit.forEach((t) => typeof t === 'string' && t.trim() && tags.add(t.trim().replace(/^#/, '').toLowerCase()));
  else if (typeof explicit === 'string') explicit.split(',').forEach((t) => t.trim() && tags.add(t.trim().replace(/^#/, '').toLowerCase()));
  // Code is not prose: `#include` or `#[derive]` must not become tags.
  const prose = Object.entries(data)
    .filter(([k]) => !STYLE_KEYS.has(k) && k !== 'code' && k !== 'tags')
    .map(([, v]) => textOf(v))
    .join('\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
  for (const m of prose.matchAll(HASHTAG)) tags.add(m[2].toLowerCase());
  return [...tags].sort();
}

export interface IndexedNode {
  canvasId: string;
  canvasName: string;
  id: string;
  type: string;
  title: string;
  text: string;
  tags: string[];
  links: Wikilink[];
  data: Record<string, unknown>;
}

export interface IndexCanvas {
  id: string;
  name: string;
  nodes: Pick<StoredNode, 'id' | 'type' | 'data'>[];
}

export interface SearchHit {
  node: IndexedNode;
  score: number;
  snippet: string;
}

export class KnowledgeIndex {
  readonly nodes: IndexedNode[] = [];
  private readonly byTitle = new Map<string, IndexedNode[]>();

  constructor(canvases: IndexCanvas[]) {
    for (const c of canvases) {
      for (const n of c.nodes) {
        const title = String(n.data.title ?? n.data.name ?? n.data.label ?? '').trim();
        const text = nodeText(n.data);
        // An embed's `ref` is a link to the node it shows.
        const ref = typeof n.data.ref === 'string' && n.data.ref.trim() ? extractWikilinks(`[[${n.data.ref.trim()}]]`) : [];
        const entry: IndexedNode = {
          canvasId: c.id,
          canvasName: c.name,
          id: n.id,
          type: n.type,
          title,
          text,
          tags: extractTags(n.data),
          links: [...ref, ...extractWikilinks(text)],
          data: n.data,
        };
        this.nodes.push(entry);
        for (const key of [title.toLowerCase(), n.id.toLowerCase()]) {
          if (!key) continue;
          const list = this.byTitle.get(key) ?? [];
          list.push(entry);
          this.byTitle.set(key, list);
        }
      }
    }
  }

  /** Resolves a link, preferring a node on the same canvas when titles repeat across canvases. */
  resolve(link: Wikilink, fromCanvasId?: string): IndexedNode | null {
    const candidates = this.byTitle.get(link.target.toLowerCase()) ?? [];
    if (link.canvas) {
      const canvas = link.canvas.toLowerCase();
      return candidates.find((c) => c.canvasName.toLowerCase() === canvas) ?? null;
    }
    return candidates.find((c) => c.canvasId === fromCanvasId) ?? candidates[0] ?? null;
  }

  outgoing(canvasId: string, nodeId: string): { link: Wikilink; node: IndexedNode | null }[] {
    const source = this.nodes.find((n) => n.canvasId === canvasId && n.id === nodeId);
    return source ? source.links.map((link) => ({ link, node: this.resolve(link, canvasId) })) : [];
  }

  backlinks(canvasId: string, nodeId: string): IndexedNode[] {
    return this.nodes.filter(
      (n) => !(n.canvasId === canvasId && n.id === nodeId) &&
        n.links.some((l) => {
          const hit = this.resolve(l, n.canvasId);
          return hit?.canvasId === canvasId && hit.id === nodeId;
        })
    );
  }

  tagCounts(canvasId?: string): { tag: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const n of this.nodes) {
      if (canvasId && n.canvasId !== canvasId) continue;
      for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /**
   * match "all" (default): every word must match. match "any": natural-language questions; common
   * words are ignored and nodes rank by how many query words they contain. Title hits rank higher;
   * `#tag` words match tags exactly.
   */
  search(query: string, opts: { canvasId?: string; limit?: number; match?: 'all' | 'any' } = {}): SearchHit[] {
    const any = opts.match === 'any';
    let words = query.toLowerCase().split(any ? /[\s,.;:!?()"']+/ : /\s+/).filter(Boolean);
    if (any) {
      words = [...new Set(words.filter((w) => w.startsWith('#') || (w.length > 1 && !STOP_WORDS.has(w))))];
    }
    if (words.length === 0) return [];
    const hits: SearchHit[] = [];
    for (const n of this.nodes) {
      if (opts.canvasId && n.canvasId !== opts.canvasId) continue;
      const title = n.title.toLowerCase();
      const text = n.text.toLowerCase();
      let score = 0;
      let matched = 0;
      let ok = true;
      for (const w of words) {
        let s = 0;
        if (w.startsWith('#') && w.length > 1) s = n.tags.includes(w.slice(1)) ? 2 : 0;
        else if (title.includes(w)) s = title === w ? 6 : title.startsWith(w) ? 4 : 3;
        else if (text.includes(w)) s = 1;
        if (s > 0) {
          score += s;
          matched++;
        } else if (!any) {
          ok = false;
          break;
        }
      }
      if (!ok || matched === 0) continue;
      // Nodes covering more of the question rank first.
      if (any) score += (matched / words.length) * 10;
      const first = words.find((w) => !w.startsWith('#') && text.includes(w)) ?? '';
      // Snippet from the body, not the title shown next to it.
      const body = n.text.startsWith(n.title) ? n.text.slice(n.title.length) : n.text;
      const at = first ? Math.max(0, body.toLowerCase().indexOf(first) - 50) : 0;
      hits.push({ node: n, score, snippet: body.slice(at, at + 160).replace(/\s+/g, ' ').trim() });
    }
    return hits.sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title)).slice(0, opts.limit ?? 50);
  }
}

const STOP_WORDS = new Set(
  ('a an as at be by do if in is it me my no of on or so to up us we the and for are but not you all any can had her was one our out has him his how its may new now old see two way who did get let put say she too use what when where which while with why does from have into just like more most much only over some such than that them then they this those very will your about after again also been being both could each even every here other should their there these through under until upon were would yours tell show give know find list explain describe').split(' ')
);
