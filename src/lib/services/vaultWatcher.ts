// Watches the open vault's canvases/ folder so pages created, renamed, deleted or edited by other
// tools (the MCP server, sync clients, git) show up in the sidebar and search without a reload.

import { normalizePath } from './diskEcho';

const DEBOUNCE = 500;
// canvases/<folder> (page added/removed) or canvases/<folder>/canvas.json (metadata changed)
const PAGE_CHANGE = /^[^/]+(\/canvas\.json)?$/;

export async function watchVaultPages(vaultPath: string, onChange: () => void): Promise<() => void> {
  const root = `${normalizePath(vaultPath).replace(/\/$/, '')}/canvases`;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let unwatch: (() => void) | null = null;

  try {
    const { watch } = await import('@tauri-apps/plugin-fs');
    unwatch = await watch(
      `${vaultPath}/canvases`,
      (event) => {
        const relevant = event.paths.some((raw) => {
          const path = normalizePath(raw);
          return path.startsWith(`${root}/`) && PAGE_CHANGE.test(path.slice(root.length + 1));
        });
        if (!relevant || stopped || timer) return;
        // Throttle rather than debounce, so pages appear while a tool is still writing.
        timer = setTimeout(() => {
          timer = null;
          if (!stopped) onChange();
        }, DEBOUNCE);
      },
      { recursive: true, delayMs: 200 }
    );
  } catch (error) {
    console.warn('[vault-watch] Page list will not refresh automatically:', error);
  }

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unwatch?.();
  };
}
