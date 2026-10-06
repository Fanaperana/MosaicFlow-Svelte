import type { FsAdapter } from '@mosaicflow/vault-core';
import { forgetContent, rememberContent } from './diskEcho';

export const tauriFsAdapter: FsAdapter = {
  async readText(path) {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const content = await readTextFile(path);
    rememberContent(path, content);
    return content;
  },
  async writeText(path, content) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    rememberContent(path, content);
    await writeTextFile(path, content);
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
    forgetContent(path);
    await remove(path, { recursive: true });
  },
  async list(path) {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(path);
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory }));
  },
};
