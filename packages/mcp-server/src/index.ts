// MosaicFlow MCP server (stdio). Usage: mosaicflow-mcp <vault folder>   (or MOSAICFLOW_VAULT=<folder>)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VaultRepository } from '@mosaicflow/vault-core';
import { nodeFsAdapter, toVaultPath } from './nodeFs';
import { MosaicOps } from './ops';
import { registerTools } from './tools';

async function main() {
  const vaultArg = process.argv[2] ?? process.env.MOSAICFLOW_VAULT;
  if (!vaultArg) {
    console.error('Usage: mosaicflow-mcp <vault folder>  (or set MOSAICFLOW_VAULT)');
    process.exit(2);
  }
  const root = toVaultPath(vaultArg);
  if (!(await nodeFsAdapter.exists(`${root}/vault.json`))) {
    console.error(`Not a MosaicFlow vault (no vault.json): ${root}`);
    process.exit(2);
  }

  const ops = new MosaicOps(new VaultRepository(nodeFsAdapter, root));
  const server = new McpServer({ name: 'mosaicflow', version: '0.1.0' });
  registerTools(server, ops);
  await server.connect(new StdioServerTransport());
  console.error(`[mosaicflow-mcp] serving vault ${root}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
