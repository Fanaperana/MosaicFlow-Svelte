// Per-device cache of parsed canvas files: <vault>/.mosaicflow/cache/canvases/<canvas-id>.json
// Rebuildable from the vault at any time, so it is git-ignored and failures only cost speed.

import { assertSafeId, type CanvasCache } from '@mosaicflow/vault-core';

const GITIGNORE = 'cache/\nstate/\n';

const cacheDir = (vaultPath: string) => `${vaultPath}/.mosaicflow/cache/canvases`;

export async function readCanvasCache(vaultPath: string, canvasId: string): Promise<CanvasCache | null> {
  try {
    assertSafeId(canvasId);
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    const path = `${cacheDir(vaultPath)}/${canvasId}.json`;
    return (await exists(path)) ? (JSON.parse(await readTextFile(path)) as CanvasCache) : null;
  } catch {
    return null;
  }
}

export async function writeCanvasCache(vaultPath: string, canvasId: string, cache: CanvasCache): Promise<void> {
  try {
    assertSafeId(canvasId);
    const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
    const dir = cacheDir(vaultPath);
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
      const ignore = `${vaultPath}/.mosaicflow/.gitignore`;
      if (!(await exists(ignore))) await writeTextFile(ignore, GITIGNORE);
    }
    await writeTextFile(`${dir}/${canvasId}.json`, JSON.stringify(cache));
  } catch (error) {
    console.warn(`[cache] Could not write cache for ${canvasId}:`, error);
  }
}
