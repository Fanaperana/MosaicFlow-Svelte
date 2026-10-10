// Built-in MCP server. Rust serves http://127.0.0.1:<port>/mcp, checks each request and relays its
// JSON-RPC messages here, where the shared MosaicFlow tools run against the open vault.

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { VaultRepository, type FsAdapter } from '@mosaicflow/vault-core';
import { createMosaicServer, RelayTransport } from '@mosaicflow/mcp-server/server';

const MESSAGE_EVENT = 'mosaicflow://mcp-message';
const NO_VAULT = -32002;

type Message = { id?: string | number | null; method?: string; params?: { name?: string } };

// Writes are not recorded in diskEcho, so the open page picks them up as external changes;
// temp-file + rename keeps the watcher from reading half-written files.
const relayFs: FsAdapter = {
  async readText(path) {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return readTextFile(path);
  },
  async writeText(path, content) {
    const { writeTextFile, rename, remove } = await import('@tauri-apps/plugin-fs');
    const tmp = `${path}.tmp-mcp-${Date.now()}`;
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
};

export interface McpHostOptions {
  /** Root of the open vault (forward slashes), or null when none is open. */
  vaultRoot: () => string | null;
  /** Called for every tool call, for the activity log. */
  onToolCall?: (tool: string) => void;
}

let unlisten: UnlistenFn | null = null;
let host: { root: string; transport: RelayTransport; close: () => Promise<void> } | null = null;
let queue = Promise.resolve();

const reply = (message: unknown) => invoke<void>('mcp_http_reply', { message });

async function hostFor(root: string | null) {
  if (host?.root === root) return host;
  await host?.close();
  host = null;
  if (!root) return null;
  const transport = new RelayTransport(reply);
  const server = createMosaicServer(new VaultRepository(relayFs, root));
  await server.connect(transport);
  host = { root, transport, close: () => server.close() };
  return host;
}

async function handle(message: Message, options: McpHostOptions) {
  const current = await hostFor(options.vaultRoot());
  if (!current) {
    if (message.id != null) {
      await reply({ jsonrpc: '2.0', id: message.id, error: { code: NO_VAULT, message: 'No vault is open in MosaicFlow' } });
    }
    return;
  }
  if (message.method === 'tools/call' && message.params?.name) options.onToolCall?.(message.params.name);
  current.transport.receive(message);
}

/** Starts receiving relayed messages; the Rust side is started separately with `mcp_http_start`. */
export async function startMcpHost(options: McpHostOptions) {
  if (unlisten) return;
  unlisten = await listen<Message>(MESSAGE_EVENT, (event) => {
    // Serialised so a vault switch can't create two servers at once.
    queue = queue.then(() => handle(event.payload, options)).catch((error) => console.error('[mcp]', error));
  });
}

export async function stopMcpHost() {
  unlisten?.();
  unlisten = null;
  await host?.close();
  host = null;
}
