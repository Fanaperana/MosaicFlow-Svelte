import { describe, expect, it } from 'vitest';
import { CanvasRepository, type CanvasFiles, type FsAdapter } from '../src/repository';
import { bodyMappingFor } from '../src/node-codec';

function memoryFs(files: Record<string, string>): FsAdapter & { reads: number } {
  const fs = {
    reads: 0,
    async readText(path: string) {
      fs.reads++;
      if (!(path in files)) throw new Error(`ENOENT ${path}`);
      return files[path];
    },
    async writeText(path: string, content: string) {
      files[path] = content;
    },
    async exists(path: string) {
      return Object.keys(files).some((p) => p === path || p.startsWith(`${path}/`));
    },
    async mkdir() {},
    async remove() {},
    async list(path: string) {
      const names = new Map<string, boolean>();
      for (const p of Object.keys(files)) {
        if (!p.startsWith(`${path}/`)) continue;
        const [name, ...rest] = p.slice(path.length + 1).split('/');
        names.set(name, rest.length > 0);
      }
      return [...names].map(([name, isDirectory]) => ({ name, isDirectory }));
    },
  };
  return fs;
}

const NODE_A = '---\nid: a\ntype: note\ntitle: A\nlayout:\n  x: 1\n  y: 2\n---\nhello';
const EDGE = JSON.stringify({ source: 'a', target: 'b' });

describe('CanvasRepository.readAll', () => {
  it('reads nodes and edges file by file when the adapter has no bulk read', async () => {
    const fs = memoryFs({ '/c/nodes/a.md': NODE_A, '/c/nodes/readme.txt': 'x', '/c/edges/e1/joined.json': EDGE });
    const repo = new CanvasRepository(fs, '/c', () => bodyMappingFor());
    const { nodes, edges } = await repo.readAll();
    expect(nodes.map((n) => [n.id, n.data.title, n.data.notes])).toEqual([['a', 'A', 'hello']]);
    expect(edges).toEqual([{ id: 'e1', source: 'a', target: 'b' }]);
  });

  it('uses one bulk read when available and drops unsafe ids', async () => {
    const fs = memoryFs({});
    const bulk: CanvasFiles = {
      nodes: [{ id: 'a', content: NODE_A }, { id: '../escape', content: NODE_A }],
      edges: [{ id: 'e1', content: EDGE }, { id: 'bad', content: '{not json' }],
    };
    const repo = new CanvasRepository({ ...fs, readCanvasFiles: async () => bulk }, '/c', () => bodyMappingFor());
    const { nodes, edges } = await repo.readAll();
    expect(fs.reads).toBe(0);
    expect(nodes.map((n) => n.id)).toEqual(['a']);
    expect(edges.map((e) => e.id)).toEqual(['e1']);
  });
});

describe('CanvasRepository.readAllCached', () => {
  // Simulates the Rust command: content is omitted when the caller's stamp matches.
  function stampedFs(disk: Record<string, { stamp: string; content: string }>) {
    const calls: Record<string, string>[] = [];
    const adapter: FsAdapter = {
      ...memoryFs({}),
      async readCanvasFiles(_root, known = {}) {
        calls.push(known);
        const files: CanvasFiles = { nodes: [], edges: [] };
        for (const [key, f] of Object.entries(disk)) {
          const [kind, id] = key.split('/') as ['nodes' | 'edges', string];
          files[kind].push({ id, stamp: f.stamp, content: known[key] === f.stamp ? null : f.content });
        }
        return files;
      },
    };
    return { adapter, calls };
  }

  it('reuses cached entries, re-parses changed files and drops deleted ones', async () => {
    const disk = { 'nodes/a': { stamp: '1-10', content: NODE_A }, 'edges/e1': { stamp: '1-5', content: EDGE } };
    const { adapter, calls } = stampedFs(disk);
    const repo = new CanvasRepository(adapter, '/c', () => bodyMappingFor());

    const first = await repo.readAllCached(null);
    expect(first.changed).toBe(true);
    expect(first.cache?.nodes.a.stamp).toBe('1-10');

    const second = await repo.readAllCached(first.cache);
    expect(calls[1]).toEqual({ 'nodes/a': '1-10', 'edges/e1': '1-5' });
    expect(second.changed).toBe(false);
    expect(second.nodes.map((n) => n.data.title)).toEqual(['A']);

    disk['nodes/a'] = { stamp: '2-11', content: NODE_A.replace('title: A', 'title: B') };
    delete (disk as Record<string, unknown>)['edges/e1'];
    const third = await repo.readAllCached(second.cache);
    expect(third.changed).toBe(true);
    expect(third.nodes.map((n) => n.data.title)).toEqual(['B']);
    expect(third.edges).toEqual([]);
    expect(Object.keys(third.cache!.edges)).toEqual([]);
  });

  it('ignores a cache from another version', async () => {
    const { adapter, calls } = stampedFs({ 'nodes/a': { stamp: '1-10', content: NODE_A } });
    const repo = new CanvasRepository(adapter, '/c', () => bodyMappingFor());
    const stale = { version: -1, nodes: { a: { stamp: '1-10', node: { id: 'a', type: 'x', position: { x: 0, y: 0 }, data: {} } } }, edges: {} };
    const { nodes } = await repo.readAllCached(stale);
    expect(calls[0]).toEqual({});
    expect(nodes[0].type).toBe('note');
  });
});
