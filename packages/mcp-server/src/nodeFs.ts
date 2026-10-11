import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FsAdapter } from '@mosaicflow/vault-core';

// Writes go to a temp file and are renamed into place, so the app's file watcher never sees a half-written node.
async function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, content, 'utf8');
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, file);
        return;
      } catch (error) {
        // Windows refuses to replace a file another process (e.g. the app's watcher) has open for a moment.
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt >= 8 || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) throw error;
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
      }
    }
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

export const nodeFsAdapter: FsAdapter = {
  readText: (p) => fs.readFile(p, 'utf8'),
  writeText: (p, c) => writeAtomic(p, c),
  exists: (p) => fs.access(p).then(() => true, () => false),
  mkdir: async (p) => void (await fs.mkdir(p, { recursive: true })),
  remove: (p) => fs.rm(p, { recursive: true, force: true }),
  list: async (p) =>
    (await fs.readdir(p, { withFileTypes: true }))
      .filter((e) => !e.name.includes('.tmp-'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
  writeBinary: (p, bytes) => fs.writeFile(p, bytes),
  fetchBinary: async (url) => {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') };
  },
};

export function toVaultPath(p: string): string {
  return path.resolve(p).replaceAll('\\', '/');
}
