// Splits canvas read time into raw file I/O vs markdown/YAML parsing.
// Usage: pnpm dlx tsx packages/vault-core/scripts/profile-read.ts "<vault path>"

import { promises as fs } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CanvasRepository, VaultRepository, type CanvasFiles } from '../src/index';
import { nodeFs, vaultArg } from './seed-lib';

async function readCanvasFiles(root: string): Promise<CanvasFiles> {
  const read = async (dir: string, pick: (name: string) => string | null) => {
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    return Promise.all(
      names.flatMap((name) => {
        const target = pick(name);
        return target ? [fs.readFile(`${dir}/${target}`, 'utf8').then((content) => ({ id: name.replace(/\.md$/, ''), content }))] : [];
      })
    );
  };
  const [nodes, edges] = await Promise.all([
    read(`${root}/nodes`, (n) => (n.endsWith('.md') ? n : null)),
    read(`${root}/edges`, (n) => `${n}/joined.json`),
  ]);
  return { nodes, edges };
}

async function main() {
  const vault = new VaultRepository(nodeFs, vaultArg().replaceAll('\\', '/'));
  const entries = await vault.listCanvases();
  const resolver = await vault.bodyMappingResolver();

  let t = performance.now();
  const raw: CanvasFiles[] = [];
  for (const e of entries) raw.push(await readCanvasFiles(e.path));
  const tIo = performance.now() - t;

  t = performance.now();
  let nodes = 0;
  for (const [i, files] of raw.entries()) {
    const repo = new CanvasRepository({ ...nodeFs, readCanvasFiles: async () => files }, entries[i].path, resolver);
    nodes += (await repo.readAll()).nodes.length;
  }
  const tParse = performance.now() - t;

  console.log(`${entries.length} canvases, ${nodes} nodes`);
  console.log(`  raw I/O (parallel) : ${tIo.toFixed(0)} ms`);
  console.log(`  parse              : ${tParse.toFixed(0)} ms (${((tParse / nodes) * 1000).toFixed(0)} µs/node)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
