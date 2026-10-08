import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { nodeTypesOfPage, packCanvas, packPages, packVault, rewritePackageLinks, safeEntryPath, unpackPackage } from '../src/package';

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
    const zip = await packVault([{ name: 'One', files }, { name: 'Two', files }, { name: 'One', files }], undefined, 'My vault');
    const out = await unpackPackage(zip);
    expect(out.manifest?.kind).toBe('vault');
    expect(out.manifest?.vault?.name).toBe('My vault');
    expect(out.canvases).toHaveLength(3);
  });

  it('packs a selection of pages', async () => {
    const out = await unpackPackage(await packPages([{ name: 'One', files }, { name: 'Two', files }]));
    expect(out.manifest?.kind).toBe('pages');
    expect(out.canvases).toHaveLength(2);
  });

  it('rewrites links to renamed pages and new page ids', () => {
    const note = [
      '---', 'id: n', 'type: note', 'title: N', 'data:', '  summary: "see [[Old Page#X]]"', '---',
      'Links: [[Old Page#Alan Turing]], [[old page|alias]], [[Other#Y]] and [[Old Pages]]',
    ].join('\n');
    const embed = ['---', 'id: e', 'type: embed', 'data:', '  ref: "Old Page#Alan Turing"', '---', ''].join('\n');
    const page = ['---', 'id: p', 'type: page', 'data:', '  canvasId: old-id', '  page: Old Page', '---', ''].join('\n');
    const input = new Map([
      ['nodes/n.md', strToU8(note)],
      ['nodes/e.md', strToU8(embed)],
      ['nodes/p.md', strToU8(page)],
      ['workspace.json', strToU8('[[Old Page]]')],
    ]);
    const out = rewritePackageLinks(input, { names: new Map([['Old Page', 'Old Page (2)']]), ids: new Map([['old-id', 'new-id']]) });
    const text = (p: string) => new TextDecoder().decode(out.get(p));

    expect([...out.keys()].sort()).toEqual(['nodes/e.md', 'nodes/n.md', 'nodes/p.md']);
    expect(text('nodes/n.md')).toContain('[[Old Page (2)#Alan Turing]], [[Old Page (2)|alias]], [[Other#Y]] and [[Old Pages]]');
    expect(text('nodes/n.md')).toContain('see [[Old Page (2)#X]]');
    expect(text('nodes/e.md')).toContain('Old Page (2)#Alan Turing');
    expect(text('nodes/p.md')).toContain('new-id');
    expect(text('nodes/p.md')).toContain('page: Old Page (2)');
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

  it('bundles plugins under .plugins/ and keeps them out of the pages', async () => {
    const plugin = {
      id: 'example.flashcard',
      name: 'Flashcard',
      version: '1.0.0',
      nodeTypes: ['flashcard'],
      files: { 'plugin.json': strToU8(JSON.stringify({ id: 'example.flashcard', name: 'Flashcard', version: '1.0.0' })), 'index.js': strToU8('export function activate() {}') },
    };
    const out = await unpackPackage(await packPages([{ name: 'One', files }], { plugins: [plugin] }));
    expect(out.warnings).toEqual([]);
    expect(out.canvases).toHaveLength(1);
    expect([...out.canvases[0].files.keys()].some((k) => k.includes('plugin'))).toBe(false);
    expect(out.manifest?.plugins).toEqual([{ id: 'example.flashcard', name: 'Flashcard', version: '1.0.0', nodeTypes: ['flashcard'], folder: 'example_flashcard' }]);
    expect(out.plugins).toHaveLength(1);
    expect(out.plugins[0].manifest?.id).toBe('example.flashcard');
    expect(out.plugins[0].info?.nodeTypes).toEqual(['flashcard']);
    expect([...out.plugins[0].files.keys()].sort()).toEqual(['index.js', 'plugin.json']);
  });

  it('ignores .plugins/ when a hand-made zip has the page at its root', async () => {
    const out = await unpackPackage(zipSync({ 'canvas.json': strToU8('{"name":"Root"}'), 'nodes/a.md': strToU8('---\nid: a\ntype: note\n---\n'), '.plugins/x/plugin.json': strToU8('{"id":"x"}') }));
    expect(out.canvases).toHaveLength(1);
    expect([...out.canvases[0].files.keys()].sort()).toEqual(['canvas.json', 'nodes/a.md']);
    expect(out.plugins.map((p) => p.manifest?.id)).toEqual(['x']);
  });

  it('lists the node types a page uses', () => {
    const page = {
      'nodes/a.md': strToU8('---\nid: a\ntype: note\n---\nHi'),
      'nodes/b.md': strToU8('---\nid: b\ntype: "flashcard"\ntitle: B\n---\n'),
      'edges/e.json': strToU8('{}'),
    };
    expect([...nodeTypesOfPage(page)].sort()).toEqual(['flashcard', 'note']);
  });
});
