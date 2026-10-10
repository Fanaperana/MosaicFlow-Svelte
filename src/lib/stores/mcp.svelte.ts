// Built-in MCP server state: starts and stops the local server to match settings, and keeps the activity log.

import { invoke } from '@tauri-apps/api/core';
import { settings } from './settings.svelte';
import { vaultStore } from './vault.svelte';
import { startMcpHost, stopMcpHost } from '$lib/services/mcpHost';

export type McpStatus = 'off' | 'starting' | 'running' | 'error';

const MAX_ACTIVITY = 20;

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `mosaic_${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

class McpStore {
  status = $state<McpStatus>('off');
  error = $state('');
  activity = $state<{ tool: string; at: number }[]>([]);

  private queue = Promise.resolve();

  get url(): string {
    return `http://127.0.0.1:${settings.current.mcp.port}/mcp`;
  }

  regenerateKey() {
    settings.update('mcp', { key: newKey() });
  }

  /** Brings the server in line with the settings; calls run one after another. */
  sync() {
    this.queue = this.queue.then(() => this.apply());
    return this.queue;
  }

  private async apply() {
    const config = settings.current.mcp;
    if (!config.enabled) {
      if (this.status !== 'off') {
        await invoke('mcp_http_stop').catch(() => {});
        await stopMcpHost();
      }
      this.status = 'off';
      this.error = '';
      return;
    }
    // Saving the new key triggers another sync, which starts the server.
    if (!config.key) {
      this.regenerateKey();
      return;
    }
    this.status = 'starting';
    try {
      await startMcpHost({
        vaultRoot: () => vaultStore.currentVault?.path.replace(/\\/g, '/') ?? null,
        onToolCall: (tool) => {
          this.activity = [{ tool, at: Date.now() }, ...this.activity].slice(0, MAX_ACTIVITY);
        },
      });
      await invoke('mcp_http_start', {
        config: { port: config.port, key: config.key, requireKey: config.requireKey, allowKeyInUrl: config.allowKeyInUrl },
      });
      this.status = 'running';
      this.error = '';
    } catch (error) {
      this.status = 'error';
      this.error = error instanceof Error ? error.message : String(error);
    }
  }
}

export const mcp = new McpStore();
