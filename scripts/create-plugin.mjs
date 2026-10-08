#!/usr/bin/env node
// Scaffolds a new MosaicFlow plugin from plugins/plugin-template.
// Usage: pnpm create-plugin "My Plugin" [--id you.my-plugin] [--author "Your Name"] [--out <folder>]

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), '../plugins/plugin-template');
const APP_ID = 'com.mosaicflow.app';

function usage(message) {
  if (message) console.error(`\n  ${message}\n`);
  console.log('  Usage: pnpm create-plugin "Plugin Name" [--id author.plugin-name] [--author "Your Name"] [--out <folder>]');
  console.log('  Default --out is the MosaicFlow plugins folder of this computer.\n');
  process.exit(message ? 1 : 0);
}

function pluginsFolder() {
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), APP_ID, 'plugins');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', APP_ID, 'plugins');
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), APP_ID, 'plugins');
}

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const args = process.argv.slice(2);
const options = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-h' || arg === '--help') usage();
  else if (arg.startsWith('--')) {
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) usage(`Missing value for ${arg}`);
    options[arg.slice(2)] = value;
    i++;
  } else positional.push(arg);
}

const name = positional.join(' ').trim();
if (!name) usage('Give the plugin a name.');
// Names end up inside JS strings and CSS class names, so keep them simple.
if (!/^[\p{L}\p{N} ._-]{1,60}$/u.test(name)) usage('Use letters, numbers, spaces, dots, dashes or underscores in the name (max 60).');

const slug = slugify(name);
if (!slug) usage('The name needs at least one letter or number.');
const author = (options.author ?? 'Your Name').trim();
const authorSlug = slugify(author) || 'me';
const id = options.id ?? `${authorSlug}.${slug}`;
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) || id.startsWith('core.')) {
  usage(`Invalid id "${id}": use letters, numbers, dots, dashes and underscores, and don't start with "core.".`);
}

const parent = resolve(options.out ?? pluginsFolder());
const target = join(parent, slug);
if (existsSync(target)) usage(`${target} already exists.`);

mkdirSync(parent, { recursive: true });
cpSync(TEMPLATE, target, { recursive: true });

const jsonString = (s) => JSON.stringify(s).slice(1, -1);
for (const file of readdirSync(target)) {
  const path = join(target, file);
  const isJson = file.endsWith('.json');
  const text = readFileSync(path, 'utf8')
    .replaceAll('my-name.my-plugin', id)
    .replaceAll('My Plugin', name)
    .replaceAll('my-plugin', slug)
    .replaceAll('my-name', authorSlug)
    .replaceAll('Your Name', isJson ? jsonString(author) : author);
  writeFileSync(path, text);
}

console.log(`
  Created ${name} (${id})
  ${target}

  Next:
    1. Open MosaicFlow → Plugins (puzzle icon) → Rescan, then switch "${name}" on.
    2. Press / on a page and insert "${name} card", or press Ctrl+P and type "${name}".
    3. Edit index.js, then Rescan to reload. Delete the parts you don't need.

  Guide:     docs/PLUGIN_DEVELOPMENT.md
  Reference: docs/PLUGIN_API.md
`);
