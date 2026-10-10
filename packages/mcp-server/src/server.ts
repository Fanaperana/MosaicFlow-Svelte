// Transport-independent MosaicFlow MCP server, shared by the stdio CLI and the app's built-in HTTP server.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { VaultRepository } from '@mosaicflow/vault-core';
import { MosaicOps } from './ops';
import { registerTools } from './tools';

const INSTRUCTIONS =
  'MosaicFlow vault: a personal knowledge base of canvases (pages) made of linked notes. ' +
  'When the user asks a question that their notes may cover, look it up first: search (match "any"), then read_nodes on the hits, and cite (Canvas › Node title). ' +
  'To add knowledge, call get_guide, then build_knowledge for a whole map or create_node/connect for small edits.';

export function createMosaicServer(vault: VaultRepository): McpServer {
  const server = new McpServer({ name: 'mosaicflow', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  registerTools(server, new MosaicOps(vault));
  return server;
}

/** Transport for hosts that move JSON-RPC messages themselves: `receive` feeds the server, `deliver` sends replies. */
export class RelayTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(private readonly deliver: (message: JSONRPCMessage) => Promise<void>) {}

  async start() {}

  async send(message: JSONRPCMessage) {
    await this.deliver(message);
  }

  async close() {
    this.onclose?.();
  }

  receive(message: unknown) {
    this.onmessage?.(message as JSONRPCMessage);
  }
}
