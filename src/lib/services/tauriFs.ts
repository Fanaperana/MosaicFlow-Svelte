// FsAdapter over the Tauri fs plugin, shared by the built-in MCP server and in-app imports (vault paths
// are in the fs scope once the vault is open). Text writes go through a temp file + rename so the file
// watcher never reads a half-written node.

import type { FsAdapter } from '@mosaicflow/vault-core';

export const tauriFs: FsAdapter = {
  async readText(path) {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return readTextFile(path);
  },
  async writeText(path, content) {
    const { writeTextFile, rename, remove } = await import('@tauri-apps/plugin-fs');
    const tmp = `${path}.tmp-mcp-${crypto.randomUUID()}`;
    await writeTextFile(tmp, content);
    try {
      await rename(tmp, path);
    } catch (error) {
      await remove(tmp).catch(() => {});
      throw error;
    }
  },
  async exists(path) {
    const { exists } = await import('@tauri-apps/plugin-fs');
    return exists(path);
  },
  async mkdir(path) {
    const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(path))) await mkdir(path, { recursive: true });
  },
  async remove(path) {
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(path, { recursive: true });
  },
  async list(path) {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    return (await readDir(path))
      .filter((e) => !e.name.includes('.tmp-'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory }));
  },
  async writeBinary(path, bytes) {
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(path, bytes);
  },
  // The webview's fetch is subject to CORS, so some hosts refuse; callers then keep the URL instead.
  async fetchBinary(url) {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') };
  },
};
