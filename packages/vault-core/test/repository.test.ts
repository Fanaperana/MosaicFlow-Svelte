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
