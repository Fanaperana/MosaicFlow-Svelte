// Seeds "Mastering Competitive Programming in Rust": a learning mosaic of Rust foundations,
// core algorithms (with runnable snippets), practice sites and a 4-week plan.
// Usage: pnpm dlx tsx packages/vault-core/scripts/seed-rust-cp.ts "<vault path>"

import { applyStory, card, color, edge, groupStyle, node, vaultArg, writeCanvas } from './seed-lib';

const code = (lines: string[]) => lines.join('\n');

const FAST_IO = code([
  'use std::io::{self, BufWriter, Read, Write};',
  '',
  'fn main() {',
  '    let mut s = String::new();',
  '    io::stdin().read_to_string(&mut s).unwrap();',
  '    let mut it = s.split_ascii_whitespace();',
  '    let mut next = || it.next().unwrap();',
  '    let stdout = io::stdout();',
  '    let out = &mut BufWriter::new(stdout.lock());',
  '',
  '    let n: usize = next().parse().unwrap();',
  '    let a: Vec<i64> = (0..n)',
  '        .map(|_| next().parse().unwrap())',
  '        .collect();',
  '    let total: i64 = a.iter().sum();',
  '    writeln!(out, "{total}").unwrap();',
  '}',
]);

const BINARY_SEARCH = code([
  '// first index i with a[i] >= x (a sorted)',
  'let i = a.partition_point(|&v| v < x);',
  '',
  '// smallest k in [0, 2^40] with ok(k) == true',
  'let (mut lo, mut hi) = (0u64, 1u64 << 40);',
  'while lo < hi {',
  '    let mid = lo + (hi - lo) / 2;',
  '    if ok(mid) { hi = mid; } else { lo = mid + 1; }',
  '}',
]);

const PREFIX_SUMS = code([
  'let mut pre = vec![0i64; n + 1];',
  'for i in 0..n {',
  '    pre[i + 1] = pre[i] + a[i];',
  '}',
  '// sum of a[l..r] (r exclusive) in O(1)',
  'let s = pre[r] - pre[l];',
]);

const FENWICK = code([
  'struct Fenwick { t: Vec<i64> }',
  '',
  'impl Fenwick {',
  '    fn new(n: usize) -> Self {',
  '        Fenwick { t: vec![0; n + 1] }',
  '    }',
  '    // a[i] += v (i is 0-based)',
  '    fn add(&mut self, i: usize, v: i64) {',
  '        let mut i = i + 1;',
  '        while i < self.t.len() {',
  '            self.t[i] += v;',
  '            i += i & i.wrapping_neg();',
  '        }',
  '    }',
  '    // sum of a[0..i]',
  '    fn sum(&self, mut i: usize) -> i64 {',
  '        let mut s = 0;',
  '        while i > 0 { s += self.t[i]; i &= i - 1; }',
  '        s',
  '    }',
  '}',
]);

const KNAPSACK = code([
  '// 0/1 knapsack: dp[c] = best value, weight <= c',
  'let mut dp = vec![0i64; cap + 1];',
  'for &(w, v) in &items {',
  '    for c in (w..=cap).rev() {',
  '        dp[c] = dp[c].max(dp[c - w] + v);',
  '    }',
  '}',
  'let best = dp[cap];',
]);

const BFS = code([
  'use std::collections::VecDeque;',
  '',
  'fn bfs(adj: &[Vec<usize>], s: usize)',
  '    -> Vec<Option<usize>> {',
  '    let mut dist = vec![None; adj.len()];',
  '    let mut q = VecDeque::new();',
  '    dist[s] = Some(0);',
  '    q.push_back(s);',
  '    while let Some(u) = q.pop_front() {',
  '        let d = dist[u].unwrap();',
  '        for &v in &adj[u] {',
  '            if dist[v].is_none() {',
  '                dist[v] = Some(d + 1);',
  '                q.push_back(v);',
  '            }',
  '        }',
  '    }',
  '    dist',
  '}',
]);

const DIJKSTRA = code([
  'use std::cmp::Reverse;',
  'use std::collections::BinaryHeap;',
  '',
  'fn dijkstra(adj: &[Vec<(usize, u64)>], s: usize)',
  '    -> Vec<u64> {',
  '    let mut dist = vec![u64::MAX; adj.len()];',
  '    let mut pq = BinaryHeap::new();',
  '    dist[s] = 0;',
  '    pq.push(Reverse((0u64, s)));',
  '    while let Some(Reverse((d, u))) = pq.pop() {',
  '        if d > dist[u] { continue; }',
  '        for &(v, w) in &adj[u] {',
  '            let nd = d + w;',
  '            if nd < dist[v] {',
  '                dist[v] = nd;',
  '                pq.push(Reverse((nd, v)));',
  '            }',
  '        }',
  '    }',
  '    dist',
  '}',
]);

const DSU = code([
  'struct Dsu { p: Vec<usize>, sz: Vec<usize> }',
  '',
  'impl Dsu {',
  '    fn new(n: usize) -> Self {',
  '        Dsu { p: (0..n).collect(), sz: vec![1; n] }',
  '    }',
  '    fn find(&mut self, x: usize) -> usize {',
  '        if self.p[x] != x {',
  '            let r = self.find(self.p[x]);',
  '            self.p[x] = r;',
  '        }',
  '        self.p[x]',
  '    }',
  '    fn union(&mut self, a: usize, b: usize) -> bool {',
  '        let mut a = self.find(a);',
  '        let mut b = self.find(b);',
  '        if a == b { return false; }',
  '        if self.sz[a] < self.sz[b] {',
  '            std::mem::swap(&mut a, &mut b);',
  '        }',
  '        self.p[b] = a;',
  '        self.sz[a] += self.sz[b];',
  '        true',
  '    }',
  '}',
]);

const KRUSKAL = code([
  '// Minimum spanning tree: Kruskal + Dsu',
  'let mut es: Vec<(u64, usize, usize)> = edges;',
  'es.sort_unstable();',
  'let mut dsu = Dsu::new(n);',
  'let mut cost = 0;',
  'for (w, u, v) in es {',
  '    if dsu.union(u, v) {',
  '        cost += w;',
  '    }',
  '}',
]);

// Rough height for a code card: header + ~19px per line so nothing is clipped.
const codeHeight = (src: string) => Math.ceil((src.split('\n').length * 19 + 100) / 10) * 10;

function codeNode(id: string, title: string, src: string, x: number, y: number, parent: string, width = 460) {
  return node(id, 'code', [x, y, width, codeHeight(src)], { title, language: 'rust', code: src, ...card('violet') }, parent);
}

function week(id: string, x: number, title: string, action: string, status: string, priority: string) {
  return node(id, 'action', [x, 2170, 340, 190], { title, action, status, priority, ...card('amber', { text: true }) });
}

const nodes = applyStory(
  [
    node('title', 'simpleText', [0, -170, 2980, 80], {
      title: 'Mastering Competitive Programming in Rust',
      content: 'Mastering Competitive Programming in Rust',
      fontSize: 34, bgOpacity: 0, borderWidth: 0, textColor: '#f5f5f5',
    }),
    node('start-here', 'annotation', [-290, 40, 230, 90], {
      title: 'Start here', label: 'Start here, then step through the Story view', arrowPosition: 'right', textColor: '#fb7185',
    }),
    node('overview', 'note', [0, 0, 360, 320], {
      title: 'Roadmap',
      viewMode: 'view',
      content: [
        '# Roadmap',
        '',
        '1. **Foundations** - [[Fast I/O template]] and [[Iterator idioms]]',
        '2. **Core algorithms** - [[Binary search]], [[Prefix sums]], DP, graphs',
        '3. **Practice** - CSES, AtCoder, then Codeforces',
        '4. **4-week plan** along the bottom',
        '',
        'Read the [[Rust pitfalls in contests|pitfalls]] first. Where it all began: [[Example - History of Computing#Alan Turing]].',
        '',
        '#rust #roadmap',
      ].join('\n'),
      ...card('neutral'),
    }),
    node('pitfalls', 'note', [0, 440, 360, 560], {
      title: 'Rust pitfalls in contests',
      viewMode: 'view',
      content: [
        '# Rust pitfalls',
        '',
        '- **Overflow** panics in debug builds: use `i64`/`u64`, or `wrapping_*` / `checked_*`.',
        '- **usize underflow**: `i - 1` with `i == 0` panics; check first or cast to `i64`.',
        '- **Deep recursion**: run `solve` on a thread with a bigger stack.',
        '- **Floats**: sort with `a.sort_by(|x, y| x.total_cmp(y))`.',
        '- **Slow output**: never `println!` in a loop; write to a `BufWriter`.',
        '',
        '#rust #pitfalls',
        '',
        '```rust',
        'std::thread::Builder::new()',
        '    .stack_size(256 << 20)',
        '    .spawn(solve).unwrap()',
        '    .join().unwrap();',
        '```',
      ].join('\n'),
      ...card('rose'),
    }),
    node('reference', 'linkList', [0, 1160, 360, 340], {
      title: 'Reference',
      links: [
        { id: 'r1', label: 'The Rust Book', url: 'https://doc.rust-lang.org/book/' },
        { id: 'r2', label: 'Rust std docs', url: 'https://doc.rust-lang.org/std/' },
        { id: 'r3', label: 'cp-algorithms', url: 'https://cp-algorithms.com/' },
        { id: 'r4', label: 'ac-library-rs', url: 'https://github.com/rust-lang-ja/ac-library-rs' },
      ],
      ...card('blue'),
    }),

    node('foundations', 'group', [540, 0, 1020, 520], { title: 'Rust Foundations', label: '1 · Rust Foundations', ...groupStyle('blue') }),
    node('fast-io', 'code', [30, 60, 460, codeHeight(FAST_IO)], {
      title: 'Fast I/O template', language: 'rust', code: FAST_IO, ...card('blue'),
    }, 'foundations'),
    node('iterators', 'note', [610, 60, 380, 330], {
      title: 'Iterator idioms',
      viewMode: 'view',
      content: [
        '# Iterator idioms',
        '',
        '- `a.iter().max()`, `.min()`, `.sum::<i64>()`',
        '- `a.windows(2).all(|w| w[0] <= w[1])`',
        '- `a.iter().enumerate()` for index + value',
        '- `v.sort_unstable(); v.dedup();`',
        '- `a.chunks(k)` for blocks of k',
        '- Join output with `.join(" ")`',
        '',
        'Pairs with the [[Fast I/O template]]. #rust #idioms',
      ].join('\n'),
      ...card('blue'),
    }, 'foundations'),

    node('practice', 'group', [1720, 0, 1260, 290], { title: 'Practice', label: '3 · Practice', ...groupStyle('emerald') }),
    node('cses', 'link', [30, 60, 320, 200], {
      title: 'CSES Problem Set', url: 'https://cses.fi/problemset/',
      description: '300 classic problems in topic order. Start with Introductory.', ...card('emerald'),
    }, 'practice'),
    node('atcoder', 'link', [470, 60, 320, 200], {
      title: 'AtCoder Beginners Selection', url: 'https://atcoder.jp/contests/abs',
      description: 'Rust is supported; the proconio crate handles input.', ...card('emerald'),
    }, 'practice'),
    node('codeforces', 'link', [910, 60, 320, 200], {
      title: 'Codeforces', url: 'https://codeforces.com/problemset',
      description: 'Filter by rating 800-1400, then climb.', ...card('emerald'),
    }, 'practice'),

    node('algorithms', 'group', [540, 700, 2260, 1310], { title: 'Core Algorithms', label: '2 · Core Algorithms', ...groupStyle('violet') }),
    codeNode('binary-search', 'Binary search', BINARY_SEARCH, 30, 60, 'algorithms'),
    codeNode('prefix-sums', 'Prefix sums', PREFIX_SUMS, 610, 60, 'algorithms'),
    codeNode('fenwick', 'Fenwick tree', FENWICK, 1190, 60, 'algorithms'),
    codeNode('knapsack', 'DP: 0/1 knapsack', KNAPSACK, 1770, 60, 'algorithms'),
    codeNode('bfs', 'Graphs: BFS', BFS, 30, 700, 'algorithms'),
    codeNode('dijkstra', 'Dijkstra', DIJKSTRA, 610, 700, 'algorithms'),
    codeNode('dsu', 'Disjoint set union', DSU, 1190, 700, 'algorithms'),
    codeNode('kruskal', 'MST: Kruskal', KRUSKAL, 1770, 700, 'algorithms'),

    week('week-1', 540, 'Week 1', 'Fast I/O + 15 CSES intro tasks', 'in-progress', 'high'),
    week('week-2', 1000, 'Week 2', 'Sorting, binary search, prefix sums', 'pending', 'medium'),
    week('week-3', 1460, 'Week 3', 'BFS, Dijkstra, DSU and MST', 'pending', 'medium'),
    week('week-4', 1920, 'Week 4', 'DP, Fenwick + a virtual ABC', 'pending', 'medium'),
  ],
  [
    'title', 'overview', 'fast-io', 'iterators', 'pitfalls',
    'binary-search', 'prefix-sums', 'fenwick', 'knapsack',
    'bfs', 'dijkstra', 'dsu', 'kruskal',
    'cses', 'atcoder', 'codeforces',
    'week-1', 'week-2', 'week-3', 'week-4', 'reference',
  ]
);

const BLUE = color('blue');
const VIOLET = color('violet');
const EMERALD = color('emerald');
const AMBER = color('amber');
const ROSE = color('rose');

const edges = [
  edge('e-overview-fastio', 'overview', 'fast-io', 'start here', 'right-source', 'left-target', { color: BLUE, path: 'smoothstep', width: 2.5 }),
  edge('e-fastio-iter', 'fast-io', 'iterators', 'then', 'right-source', 'left-target', { color: BLUE, path: 'straight' }),
  edge('e-fastio-binsearch', 'fast-io', 'binary-search', 'use in every solution', 'bottom-source', 'top-target', { color: BLUE, path: 'step' }),
  edge('e-pitfalls-binsearch', 'pitfalls', 'binary-search', 'watch out', 'right-source', 'left-target', { color: ROSE, path: 'smoothstep', stroke: 'dashed', end: 'arrow' }),
  edge('e-iter-cses', 'iterators', 'cses', 'practice on', 'right-source', 'left-target', { color: EMERALD, path: 'smoothstep', stroke: 'dashed' }),
  edge('e-cses-atcoder', 'cses', 'atcoder', 'then', 'right-source', 'left-target', { color: EMERALD, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),
  edge('e-atcoder-cf', 'atcoder', 'codeforces', 'then', 'right-source', 'left-target', { color: EMERALD, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),

  edge('e-binsearch-prefix', 'binary-search', 'prefix-sums', 'pairs with', 'right-source', 'left-target', { color: VIOLET, path: 'straight', start: 'arrow', end: 'arrow' }),
  edge('e-prefix-fenwick', 'prefix-sums', 'fenwick', '+ updates', 'right-source', 'left-target', { color: VIOLET, path: 'straight' }),
  edge('e-fenwick-knapsack', 'fenwick', 'knapsack', 'next topic', 'right-source', 'left-target', { color: VIOLET, path: 'straight', stroke: 'dotted', end: 'arrow' }),
  edge('e-bfs-dijkstra', 'bfs', 'dijkstra', 'add weights', 'right-source', 'left-target', { color: VIOLET, path: 'straight', width: 2.5 }),
  edge('e-dijkstra-dsu', 'dijkstra', 'dsu', 'next topic', 'right-source', 'left-target', { color: VIOLET, path: 'straight', stroke: 'dotted', end: 'arrow' }),
  edge('e-dsu-kruskal', 'dsu', 'kruskal', 'powers', 'right-source', 'left-target', { color: VIOLET, path: 'straight', width: 2.5 }),

  edge('e-w1-w2', 'week-1', 'week-2', 'then', 'right-source', 'left-target', { color: AMBER, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),
  edge('e-w2-w3', 'week-2', 'week-3', 'then', 'right-source', 'left-target', { color: AMBER, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),
  edge('e-w3-w4', 'week-3', 'week-4', 'then', 'right-source', 'left-target', { color: AMBER, path: 'straight', stroke: 'dotted', animated: true, end: 'arrow' }),
  edge('e-w3-bfs', 'week-3', 'bfs', 'covers', 'top-source', 'bottom-target', { color: AMBER, path: 'smoothstep', stroke: 'dashed', end: 'arrow' }),
];

writeCanvas(
  vaultArg(),
  {
    name: 'Mastering Competitive Programming in Rust',
    description: 'Learning mosaic: Rust foundations, core algorithms with snippets, practice sites and a 4-week plan.',
    tags: ['example', 'rust', 'competitive-programming'],
  },
  nodes,
  edges
).catch((error) => {
  console.error(error);
  process.exit(1);
});
