// Round-trip + hostile-input checks for the .mosaic package codec.
// Usage: pnpm dlx tsx packages/vault-core/scripts/check-package.ts "<canvas folder>"

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { packCanvas, unpackPackage } from '../src/index';

async function collect(root: string, prefix = '', out: Record<string, Uint8Array> = {}) {
  for (const e of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) await collect(root, rel, out);
    else out[rel] = new Uint8Array(await fs.readFile(path.join(root, rel)));
  }
  return out;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

async function rejects(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn();
  } catch (error) {
    console.log(`ok - ${msg} (${(error as Error).message})`);
    return;
  }
  throw new Error(`FAIL: ${msg} (did not throw)`);
}

async function main() {
  const canvasDir = process.argv[2];
  if (!canvasDir) throw new Error('Pass a canvas folder');
  const files = await collect(canvasDir);
  const name = path.basename(canvasDir);

  const zip = await packCanvas({ name, files });
  assert(new TextDecoder().decode(zip.slice(30, 38)) === 'mimetype', 'mimetype is the first entry');
  const out = await unpackPackage(zip);
  assert(out.manifest?.canvases[0].name === name, 'manifest names the canvas');
  assert(out.canvases.length === 1, 'one canvas found');
  assert(out.warnings.length === 0, 'no integrity warnings');
  const c = out.canvases[0];
  assert(c.files.size === Object.keys(files).length, `all ${c.files.size} files round-trip`);
  assert(Object.entries(files).every(([p, d]) => Buffer.from(c.files.get(p)!).equals(Buffer.from(d))), 'bytes identical');

  // Hand-made zip of the folder itself (no manifest, files under a top folder).
  const handmade = zipSync(Object.fromEntries(Object.entries(files).map(([p, d]) => [`My Export/${p}`, d])));
  const hm = await unpackPackage(handmade);
  assert(hm.manifest === null && hm.canvases.length === 1 && hm.canvases[0].files.size === c.files.size, 'plain zip of a canvas folder imports');

  // Tampered file -> warning, not failure.
  const tampered = zipSync({ mimetype: strToU8('x'), 'manifest.json': strToU8(JSON.stringify({ format: 'mosaicflow-package', formatVersion: 1, kind: 'canvas', app: 't', createdAt: '', canvases: [{ name: 'T', folder: 'T' }], files: { 'T/nodes/a.md': '00' } })), 'T/nodes/a.md': strToU8('---\nid: a\n---\n') });
  assert((await unpackPackage(tampered)).warnings.some((w) => w.includes('changed')), 'hash mismatch is reported');

  await rejects(() => unpackPackage(zipSync({ '../evil/nodes/a.md': strToU8('x') })), 'rejects ../ paths');
  await rejects(() => unpackPackage(zipSync({ 'C:/Windows/nodes/a.md': strToU8('x') })), 'rejects drive paths');
  await rejects(() => unpackPackage(zipSync({ 'a/../../nodes/x.md': strToU8('x') })), 'rejects nested ..');
  await rejects(() => unpackPackage(zipSync({ 'big/nodes/a.md': new Uint8Array(50 * 1024 * 1024) })), 'rejects zip bombs (ratio)');
  await rejects(() => unpackPackage(strToU8('{"nodes":{}}')), 'rejects non-zip input');
  await rejects(
    () => unpackPackage(zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'mosaicflow-package', formatVersion: 99 })) })),
    'rejects packages from a newer format'
  );
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`c/nodes/${i}.md`, strToU8('x')]));
  await rejects(() => unpackPackage(zipSync(many), { maxEntries: 10, maxTotalBytes: 1e9, maxRatio: 200 }), 'enforces entry limit');

  console.log(`\nPackage size: ${(zip.length / 1024).toFixed(1)} KB for ${c.files.size} files`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
