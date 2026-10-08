// Builds showcase pages in a vault through the real MCP server over stdio, exactly like an LLM client would.
// Usage: pnpm --filter @mosaicflow/mcp-server exec tsx scripts/showcase.ts "<vault>"   (run `build` first)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const vault = process.argv[2];
if (!vault) throw new Error('Pass the vault folder');

const client = new Client({ name: 'showcase', version: '1.0.0' });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [path.join(here, '..', 'dist', 'mosaicflow-mcp.mjs'), vault],
  stderr: 'ignore',
}));

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { text: string }[])[0].text;
  if (res.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text);
}

// Calendar dates at 12:00 UTC so they do not shift a day in other time zones.
const date = (label: string, iso: string, yearOnly = false) => ({
  label,
  customTimestamp: `${iso}T12:00:00.000Z`,
  datetime: `${iso}T12:00:00.000Z`,
  useCurrentTime: false,
  format: 'date',
  showHeader: true,
  showYear: true,
  showMonth: !yearOnly,
  showDay: !yearOnly,
  showDayOfWeek: false,
  showHour: false,
  showMinute: false,
  showSecond: false,
});
const items = (...texts: [string, boolean?][]) => texts.map(([text, done], i) => ({ id: `i${i + 1}`, text, done: !!done }));

const existing = new Set((await call('list_canvases')).map((c: { name: string }) => c.name.toLowerCase()));
for (const name of ['Space Race', 'Cryptography Essentials', 'Weekly Focus', 'Start Here']) {
  if (existing.has(name.toLowerCase())) throw new Error(`A page named "${name}" already exists; remove it first`);
}

// ---------------------------------------------------------------------------
// 1. Space Race
// ---------------------------------------------------------------------------
const space = await call('build_knowledge', {
  canvas: 'Space Race',
  description: 'The US–Soviet competition for spaceflight firsts, 1957–1975.',
  tags: ['history', 'space'],
  groups: [
    { key: 'people', title: 'Pioneers', palette: 'violet' },
    { key: 'orgs', title: 'Programs', palette: 'teal' },
    { key: 'timeline', title: 'Milestones', palette: 'amber' },
    { key: 'places', title: 'Launch sites', palette: 'emerald' },
    { key: 'sources', title: 'Sources', palette: 'blue' },
  ],
  nodes: [
    { key: 'intro', type: 'note', title: 'The Space Race', palette: 'neutral', size: { width: 340, height: 300 }, data: { content: '## The Space Race\nA Cold War contest between the **Soviet Union** and the **United States** for spaceflight firsts.\n\n- Opened with [[Sputnik 1]] (1957)\n- Peaked with [[Apollo 11]] (1969)\n- Ended in cooperation with [[Apollo–Soyuz]] (1975)\n\n#space #history' } },
    { key: 'why', type: 'callout', title: 'Why it mattered', size: { width: 340, height: 130 }, data: { tone: 'info', icon: '🛰️', content: 'Satellites, weather forecasting, GPS and modern computing all grew out of the race to orbit.' } },
    { key: 'korolev', type: 'person', title: 'Sergei Korolev', group: 'people', palette: 'violet', data: { name: 'Sergei Korolev', role: 'Chief Designer', organization: 'OKB-1', notes: 'Led the Soviet program behind [[Sputnik 1]] and [[Vostok 1]]. His identity was a state secret until his death in 1966.' } },
    { key: 'gagarin', type: 'person', title: 'Yuri Gagarin', group: 'people', palette: 'violet', data: { name: 'Yuri Gagarin', role: 'Cosmonaut', organization: 'Soviet Air Forces', notes: 'First human in space, aboard [[Vostok 1]].' } },
    { key: 'tereshkova', type: 'person', title: 'Valentina Tereshkova', group: 'people', palette: 'violet', data: { name: 'Valentina Tereshkova', role: 'Cosmonaut', notes: 'First woman in space, aboard [[Vostok 6]].' } },
    { key: 'vonbraun', type: 'person', title: 'Wernher von Braun', group: 'people', palette: 'violet', data: { name: 'Wernher von Braun', role: 'Rocket engineer', organization: 'NASA', notes: 'Chief architect of the Saturn V that launched [[Apollo 11]].' } },
    { key: 'armstrong', type: 'person', title: 'Neil Armstrong', group: 'people', palette: 'violet', data: { name: 'Neil Armstrong', role: 'Astronaut, Apollo 11 commander', organization: 'NASA', notes: 'First person to walk on the Moon.' } },
    { key: 'okb1', type: 'organization', title: 'OKB-1', group: 'orgs', palette: 'teal', data: { name: 'OKB-1', type: 'Design bureau', industry: 'Aerospace', location: 'Korolyov, Moscow Oblast', description: 'Soviet design bureau led by [[Sergei Korolev]].' } },
    { key: 'nasa', type: 'organization', title: 'NASA', group: 'orgs', palette: 'teal', data: { name: 'NASA', type: 'Space agency', industry: 'Aerospace', location: 'Washington, D.C.', website: 'https://www.nasa.gov', description: 'US civil space agency, founded in 1958 in response to Sputnik.' } },
    { key: 'sputnik', type: 'timestamp', title: 'Sputnik 1', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('Sputnik 1', '1957-10-04') },
    { key: 'vostok1', type: 'timestamp', title: 'Vostok 1', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('Vostok 1', '1961-04-12') },
    { key: 'vostok6', type: 'timestamp', title: 'Vostok 6', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('Vostok 6', '1963-06-16') },
    { key: 'apollo11', type: 'timestamp', title: 'Apollo 11', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('Apollo 11', '1969-07-20') },
    { key: 'asoyuz', type: 'timestamp', title: 'Apollo–Soyuz', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('Apollo–Soyuz', '1975-07-17') },
    { key: 'baikonur', type: 'map', title: 'Baikonur Cosmodrome', group: 'places', palette: 'emerald', size: { width: 320, height: 300 }, data: { latitude: 45.965, longitude: 63.305, zoom: 6, label: 'Baikonur Cosmodrome', address: 'Baikonur, Kazakhstan' } },
    { key: 'ksc', type: 'map', title: 'Kennedy Space Center', group: 'places', palette: 'emerald', size: { width: 320, height: 300 }, data: { latitude: 28.5729, longitude: -80.649, zoom: 7, label: 'Kennedy Space Center', address: 'Merritt Island, Florida' } },
    { key: 'wiki', type: 'link', title: 'Space Race (Wikipedia)', group: 'sources', palette: 'blue', data: { url: 'https://en.wikipedia.org/wiki/Space_Race', description: 'Overview of the whole period, with timelines and sources.' } },
    { key: 'reading', type: 'linkList', title: 'Further reading', group: 'sources', palette: 'blue', data: { links: [
      { id: 'l1', url: 'https://www.nasa.gov/history/', label: 'NASA History Office' },
      { id: 'l2', url: 'https://www.nasa.gov/mission/apollo-11/', label: 'Apollo 11 mission page' },
      { id: 'l3', url: 'https://en.wikipedia.org/wiki/Sputnik_1', label: 'Sputnik 1' },
    ] } },
    { key: 'next', type: 'checklist', title: 'Explore next', group: 'sources', palette: 'blue', size: { width: 280, height: 220 }, data: { items: items(['Watch the Apollo 11 landing footage', true], ['Read about the Soyuz program'], ['Compare Saturn V and N1 rockets'], ['Visit Kennedy Space Center']) } },
  ],
  edges: [
    { from: 'korolev', to: 'okb1', label: 'led' },
    { from: 'vonbraun', to: 'nasa', label: 'worked at' },
    { from: 'okb1', to: 'sputnik', label: 'built', style: { end: 'arrowclosed' } },
    { from: 'gagarin', to: 'vostok1', label: 'flew', style: { end: 'arrowclosed' } },
    { from: 'tereshkova', to: 'vostok6', label: 'flew', style: { end: 'arrowclosed' } },
    { from: 'armstrong', to: 'apollo11', label: 'commanded', style: { end: 'arrowclosed' } },
    { from: 'nasa', to: 'apollo11', label: 'ran', style: { end: 'arrowclosed' } },
    { from: 'sputnik', to: 'vostok1', label: 'then', style: { stroke: 'dotted', animated: true, end: 'arrow' } },
    { from: 'vostok1', to: 'vostok6', label: 'then', style: { stroke: 'dotted', animated: true, end: 'arrow' } },
    { from: 'vostok6', to: 'apollo11', label: 'then', style: { stroke: 'dotted', animated: true, end: 'arrow' } },
    { from: 'apollo11', to: 'asoyuz', label: 'then', style: { stroke: 'dotted', animated: true, end: 'arrow' } },
    { from: 'sputnik', to: 'baikonur', label: 'launched from', style: { stroke: 'dashed' } },
    { from: 'apollo11', to: 'ksc', label: 'launched from', style: { stroke: 'dashed' } },
    { from: 'intro', to: 'korolev', label: 'start' },
  ],
});
await call('create_node', { canvas: 'Space Race', type: 'annotation', title: 'Start here', near: space.ids.intro, size: { width: 200, height: 90 }, data: { label: 'Start here, then follow the timeline', arrowPosition: 'right', fontSize: 16, textColor: '#fb7185' } });
console.log('Space Race:', Object.keys(space.ids).length, 'nodes,', space.edges, 'edges', space.warnings ?? '');

// ---------------------------------------------------------------------------
// 2. Cryptography Essentials
// ---------------------------------------------------------------------------
const crypto = await call('build_knowledge', {
  canvas: 'Cryptography Essentials',
  description: 'Core ideas of modern cryptography with runnable examples and study cards.',
  tags: ['security', 'crypto'],
  groups: [
    { key: 'concepts', title: 'Concepts', palette: 'violet' },
    { key: 'practice', title: 'In practice', palette: 'blue' },
    { key: 'people', title: 'Inventors', palette: 'teal' },
    { key: 'timeline', title: 'Timeline', palette: 'amber' },
    { key: 'study', title: 'Study cards', palette: 'rose' },
  ],
  nodes: [
    { key: 'intro', type: 'note', title: 'Cryptography Essentials', palette: 'neutral', size: { width: 340, height: 260 }, data: { content: '## Cryptography Essentials\nFour building blocks protect almost everything online:\n\n1. [[Symmetric encryption]]\n2. [[Public-key cryptography]]\n3. [[Hash functions]]\n4. [[Digital signatures]]\n\n#crypto #security' } },
    { key: 'rule', type: 'callout', title: 'Golden rule', size: { width: 340, height: 120 }, data: { tone: 'danger', icon: '⚠️', content: 'Never invent your own cryptography. Use vetted libraries and standard algorithms.' } },
    { key: 'sym', type: 'note', title: 'Symmetric encryption', group: 'concepts', palette: 'violet', size: { width: 300, height: 260 }, data: { content: 'One shared key encrypts and decrypts.\n\n- Fast; used for bulk data\n- Standard: **AES**\n- Problem: sharing the key safely, solved by [[Public-key cryptography]]\n\n#crypto' } },
    { key: 'pk', type: 'note', title: 'Public-key cryptography', group: 'concepts', palette: 'violet', size: { width: 300, height: 260 }, data: { content: 'A key pair: the **public** key encrypts or verifies, the **private** key decrypts or signs.\n\nIntroduced by [[Diffie–Hellman]] key exchange; made practical by [[RSA]].\n\n#crypto' } },
    { key: 'hashc', type: 'note', title: 'Hash functions', group: 'concepts', palette: 'violet', size: { width: 300, height: 280 }, data: { content: 'Map any input to a fixed-size fingerprint.\n\n- One-way: cannot be reversed\n- Collision-resistant\n- Example: **SHA-256**\n\nUsed by [[Digital signatures]] and password storage.\n\n#crypto' } },
    { key: 'sig', type: 'note', title: 'Digital signatures', group: 'concepts', palette: 'violet', size: { width: 300, height: 240 }, data: { content: 'Prove who wrote a message and that it was not changed: sign the **hash** of the message with a private key; anyone verifies with the public key.\n\n#crypto' } },
    { key: 'shacode', type: 'code', title: 'SHA-256 in Python', group: 'practice', palette: 'blue', size: { width: 400, height: 200 }, data: { language: 'python', code: 'import hashlib\n\ndigest = hashlib.sha256(b"hello").hexdigest()\nprint(digest)  # 2cf24dba5fb0a30e...' } },
    { key: 'aescode', type: 'code', title: 'AES-GCM in Python', group: 'practice', palette: 'blue', size: { width: 440, height: 280 }, data: { language: 'python', code: 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM\nimport os\n\nkey = AESGCM.generate_key(bit_length=256)\nnonce = os.urandom(12)  # never reuse with the same key\nct = AESGCM(key).encrypt(nonce, b"secret", None)\nassert AESGCM(key).decrypt(nonce, ct, None) == b"secret"' } },
    { key: 'hello', type: 'hash', title: 'SHA-256("hello")', group: 'practice', palette: 'blue', size: { width: 300, height: 180 }, data: { hash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', algorithm: 'sha256', threatLevel: 'safe', source: 'hashlib example', notes: 'Change one letter and the whole hash changes.' } },
    { key: 'diffie', type: 'person', title: 'Whitfield Diffie', group: 'people', palette: 'teal', data: { name: 'Whitfield Diffie', role: 'Cryptographer', notes: 'Co-inventor of public-key cryptography.' } },
    { key: 'hellman', type: 'person', title: 'Martin Hellman', group: 'people', palette: 'teal', data: { name: 'Martin Hellman', role: 'Cryptographer', organization: 'Stanford University', notes: 'Co-author of "New Directions in Cryptography" (1976).' } },
    { key: 'rivest', type: 'person', title: 'Ron Rivest', group: 'people', palette: 'teal', data: { name: 'Ron Rivest', role: 'Cryptographer', organization: 'MIT', notes: 'The "R" in [[RSA]], with Shamir and Adleman.' } },
    { key: 'dh', type: 'timestamp', title: 'Diffie–Hellman', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('Diffie–Hellman', '1976-11-01', true) },
    { key: 'rsa', type: 'timestamp', title: 'RSA', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('RSA', '1977-06-01', true) },
    { key: 'aes', type: 'timestamp', title: 'AES standard', group: 'timeline', palette: 'amber', size: { width: 220, height: 80 }, data: date('AES standard', '2001-11-26') },
    { key: 'card1', type: 'flashcard', title: 'Hash vs encryption', group: 'study', palette: 'rose', data: { question: 'What is the difference between hashing and encryption?', answer: 'Encryption is reversible with a key; a hash is a one-way fingerprint that cannot be reversed.' } },
    { key: 'card2', type: 'flashcard', title: 'Why public keys?', group: 'study', palette: 'rose', data: { question: 'What problem does public-key cryptography solve?', answer: 'Agreeing on a secret key over an insecure channel, without meeting first.' } },
    { key: 'nist', type: 'link', title: 'FIPS 197 (AES)', palette: 'blue', data: { url: 'https://csrc.nist.gov/pubs/fips/197/final', description: 'The official AES specification from NIST.' } },
  ],
  edges: [
    { from: 'diffie', to: 'dh', label: 'published', style: { end: 'arrowclosed' } },
    { from: 'hellman', to: 'dh', label: 'published', style: { end: 'arrowclosed' } },
    { from: 'rivest', to: 'rsa', label: 'co-invented', style: { end: 'arrowclosed' } },
    { from: 'dh', to: 'rsa', label: 'then', style: { stroke: 'dotted', animated: true, end: 'arrow' } },
    { from: 'rsa', to: 'aes', label: 'then', style: { stroke: 'dotted', animated: true, end: 'arrow' } },
    { from: 'dh', to: 'pk', label: 'introduced', style: { end: 'arrowclosed' } },
    { from: 'pk', to: 'sig', label: 'enables', style: { end: 'arrowclosed' } },
    { from: 'hashc', to: 'sig', label: 'used in', style: { end: 'arrowclosed' } },
    { from: 'shacode', to: 'hashc', label: 'implements', style: { stroke: 'dashed' } },
    { from: 'hello', to: 'hashc', label: 'example of', style: { stroke: 'dashed' } },
    { from: 'aescode', to: 'sym', label: 'implements', style: { stroke: 'dashed' } },
    { from: 'aes', to: 'nist', label: 'spec', style: { stroke: 'dashed' } },
    { from: 'intro', to: 'sym', label: 'start' },
  ],
});
console.log('Cryptography Essentials:', Object.keys(crypto.ids).length, 'nodes,', crypto.edges, 'edges', crypto.warnings ?? '');

// ---------------------------------------------------------------------------
// 3. Weekly Focus
// ---------------------------------------------------------------------------
const focus = await call('build_knowledge', {
  canvas: 'Weekly Focus',
  description: 'A one-page planning board: priorities, schedule and focus tools.',
  tags: ['planning'],
  layout: 'TB',
  groups: [
    { key: 'today', title: 'Today', palette: 'rose' },
    { key: 'week', title: 'This week', palette: 'amber' },
    { key: 'tools', title: 'Focus tools', palette: 'teal' },
  ],
  nodes: [
    { key: 'principles', type: 'note', title: 'Principles', palette: 'neutral', size: { width: 320, height: 230 }, data: { content: '## Principles\n- One **big** task per day\n- Time-box with the [[Pomodoro]] timer\n- Review on Friday\n\nCurrently studying: [[Cryptography Essentials#Public-key cryptography]] and [[Space Race#Apollo 11]].\n\n#planning' } },
    { key: 'a1', type: 'action', title: 'Finish crypto study cards', group: 'today', palette: 'rose', data: { action: 'Review both cards on [[Cryptography Essentials#Hash vs encryption]] and add two more.', status: 'in-progress', priority: 'high', dueDate: '2026-10-08T12:00:00.000Z' } },
    { key: 'a2', type: 'action', title: 'Outline the Space Race essay', group: 'today', palette: 'rose', data: { action: 'Three sections: Sputnik shock, Moon landing, cooperation.', status: 'pending', priority: 'medium', dueDate: '2026-10-09T12:00:00.000Z' } },
    { key: 'a3', type: 'action', title: 'Back up the vault', group: 'today', palette: 'rose', data: { action: 'Commit the vault folder to git.', status: 'completed', priority: 'low' } },
    { key: 'goals', type: 'checklist', title: 'Weekly goals', group: 'week', palette: 'amber', size: { width: 280, height: 230 }, data: { items: items(['Read "New Directions in Cryptography"', true], ['Watch a Saturn V documentary'], ['Write 1,000 words'], ['Exercise 3 times', true], ['Plan next week']) } },
    { key: 'cal', type: 'calendar', title: 'Schedule', group: 'week', palette: 'amber', data: { view: 'agenda', events: [
      { id: 'e1', title: 'Deep work: essay', date: '2026-10-08', time: '09:00', repeat: 'weekdays', remind: 10 },
      { id: 'e2', title: 'Study group', date: '2026-10-09', time: '18:30', remind: 30 },
      { id: 'e3', title: 'Weekly review', date: '2026-10-10', time: '16:00', repeat: 'weekly', remind: 15 },
    ] } },
    { key: 'pomodoro', type: 'timer', title: 'Pomodoro', group: 'tools', palette: 'teal', data: { mode: 'pomodoro', work: 25, short: 5, long: 15, rounds: 4 } },
    { key: 'tip', type: 'callout', title: 'Focus tip', group: 'tools', size: { width: 300, height: 120 }, data: { tone: 'tip', icon: '🎯', content: 'Silence notifications for the first two pomodoros of the day.' } },
  ],
  edges: [
    { from: 'principles', to: 'a1', label: 'drives' },
    { from: 'goals', to: 'a2', label: 'feeds', style: { stroke: 'dashed' } },
    { from: 'cal', to: 'pomodoro', label: 'use during', style: { stroke: 'dashed' } },
  ],
});
console.log('Weekly Focus:', Object.keys(focus.ids).length, 'nodes,', focus.edges, 'edges', focus.warnings ?? '');

// ---------------------------------------------------------------------------
// 4. Start Here (hub)
// ---------------------------------------------------------------------------
const pages = await call('list_canvases');
const idOf = (name: string) => pages.find((p: { name: string }) => p.name === name).id;
const hub = await call('build_knowledge', {
  canvas: 'Start Here',
  description: 'Hub page linking the showcase pages.',
  tags: ['hub'],
  groups: [{ key: 'pages', title: 'Explore the vault', palette: 'blue' }],
  nodes: [
    { key: 'welcome', type: 'note', title: 'Welcome', palette: 'neutral', size: { width: 340, height: 230 }, data: { content: '## Welcome\nThis vault was built by an AI through the **MosaicFlow MCP server**.\n\nOpen a page below, hover any linked title for a preview, or press **Ctrl+Alt+G** for the graph view.\n\n#hub' } },
    { key: 'p1', type: 'page', title: 'Space Race', group: 'pages', palette: 'violet', data: { page: 'Space Race', canvasId: idOf('Space Race') } },
    { key: 'p2', type: 'page', title: 'Cryptography Essentials', group: 'pages', palette: 'violet', data: { page: 'Cryptography Essentials', canvasId: idOf('Cryptography Essentials') } },
    { key: 'p3', type: 'page', title: 'Weekly Focus', group: 'pages', palette: 'violet', data: { page: 'Weekly Focus', canvasId: idOf('Weekly Focus') } },
    { key: 'live', type: 'embed', title: 'Live: Yuri Gagarin', palette: 'violet', size: { width: 320, height: 200 }, data: { ref: 'Space Race#Yuri Gagarin', notes: 'A live copy of a node from another page.' } },
  ],
  edges: [
    { from: 'welcome', to: 'p1', label: 'explore' },
    { from: 'p1', to: 'live', label: 'highlight', style: { stroke: 'dashed' } },
  ],
});
await call('create_node', { canvas: 'Start Here', type: 'annotation', title: 'Tip', near: hub.ids.welcome, size: { width: 200, height: 90 }, data: { label: 'Double-click a page card to open it', arrowPosition: 'left', fontSize: 15, textColor: '#93c5fd' } });
console.log('Start Here:', Object.keys(hub.ids).length, 'nodes,', hub.edges, 'edges', hub.warnings ?? '');

// Prove the vault now answers questions from the new knowledge.
const answer = await call('search', { query: 'who was the first woman in space?', match: 'any', limit: 1 });
console.log('Q: who was the first woman in space? ->', answer[0] ? `${answer[0].canvas} › ${answer[0].title}` : 'no hit');

await client.close();
