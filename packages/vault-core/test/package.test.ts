import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { packCanvas, packVault, safeEntryPath, unpackPackage } from '../src/package';

const files = {
  '.mosaic/meta.json': strToU8(JSON.stringify({ id: 'x', name: 'Demo' })),
  'nodes/a.md': strToU8('---\nid: a\ntype: note\n---\nHello'),
  'edges/e1/joined.json': strToU8('{"source":"a","target":"b"}'),
  'images/pic.png': new Uint8Array([137, 80, 78, 71, 0, 255]),
};

describe('package', () => {
  it('round-trips a canvas byte for byte with mimetype first', async () => {
    const zip = await packCanvas({ name: 'Demo', files });
    expect(new TextDecoder().decode(zip.slice(30, 38))).toBe('mimetype');
    const out = await unpackPackage(zip);
    expect(out.manifest?.kind).toBe('canvas');
    expect(out.warnings).toEqual([]);
    expect(out.canvases).toHaveLength(1);
    for (const [path, data] of Object.entries(files)) expect(out.canvases[0].files.get(path)).toEqual(data);
  });

  it('packs a whole vault and imports every canvas', async () => {
    const zip = await packVault([{ name: 'One', files }, { name: 'Two', files }, { name: 'One', files }]);
    const out = await unpackPackage(zip);
    expect(out.manifest?.kind).toBe('vault');
    expect(out.canvases).toHaveLength(3);
  });

  it('accepts a hand-made zip of a canvas folder', async () => {
    const zip = zipSync(Object.fromEntries(Object.entries(files).map(([p, d]) => [`Folder/${p}`, d])));
    const out = await unpackPackage(zip);
    expect(out.manifest).toBeNull();
    expect(out.canvases[0].name).toBe('Demo');
  });

  it('reports tampered files as warnings', async () => {
    const zip = await packCanvas({ name: 'Demo', files });
    const out = await unpackPackage(zip);
    const raw = Object.fromEntries([...out.canvases[0].files].map(([p, d]) => [`Demo/${p}`, d]));
    raw['Demo/nodes/a.md'] = strToU8('changed');
    raw['manifest.json'] = strToU8(JSON.stringify(out.manifest));
    expect((await unpackPackage(zipSync(raw))).warnings.some((w) => w.includes('changed'))).toBe(true);
  });

  it.each(['../evil/nodes/a.md', 'C:/Windows/nodes/a.md', 'a/../../nodes/x.md', '/etc/nodes/a.md'])('rejects unsafe path %s', async (path) => {
    await expect(unpackPackage(zipSync({ [path]: strToU8('x') }))).rejects.toThrow(/Unsafe path/);
  });

  it('rejects zip bombs, too many entries and newer formats', async () => {
    await expect(unpackPackage(zipSync({ 'c/nodes/a.md': new Uint8Array(50 * 1024 * 1024) }))).rejects.toThrow(/compression ratio/);
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`c/nodes/${i}.md`, strToU8('x')]));
    await expect(unpackPackage(zipSync(many), { maxEntries: 5, maxTotalBytes: 1e9, maxRatio: 200 })).rejects.toThrow(/more than 5/);
    const newer = zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'mosaicflow-package', formatVersion: 99 })) });
    await expect(unpackPackage(newer)).rejects.toThrow(/newer/);
    await expect(unpackPackage(strToU8('not a zip'))).rejects.toThrow(/zip/);
  });

  it('normalises backslashes', () => {
    expect(safeEntryPath('a\\b\\c.md')).toBe('a/b/c.md');
  });
});
