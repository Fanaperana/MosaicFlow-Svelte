// Canvas operations exposed as MCP tools. Plain async methods so they can be tested without a transport.

import {
  DESIGN_GUIDE,
  KnowledgeIndex,
  absoluteRects,
  autoLayout,
  gridLayout,
  wrapLayout,
  importMermaid,
  boundsOf,
  buildEdge,
  facingSides,
  findFreePosition,
  isPaletteName,
  nodeText,
  paletteCard,
  paletteColor,
  paletteGroup,
  type CanvasRepository,
  type EdgeLook,
  type NodeTypeSchema,
  type Rect,
  type Side,
  type StoredEdge,
  type StoredNode,
  type VaultRepository,
} from '@mosaicflow/vault-core';

const GROUP_PAD = { side: 30, top: 60, bottom: 30 };
const FALLBACK_SIZE = { width: 300, height: 200 };
const SAFE_ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

export interface EdgeStyleInput {
  color?: string;
  palette?: string;
  path?: EdgeLook['path'];
  stroke?: EdgeLook['stroke'];
  animated?: boolean;
  start?: EdgeLook['start'];
  end?: EdgeLook['end'];
  width?: number;
}

export interface CreateNodeInput {
  canvas: string;
  type: string;
  title: string;
  data?: Record<string, unknown>;
  id?: string;
  palette?: string;
  parentId?: string;
  near?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface UpdateNodeInput {
  canvas: string;
  id: string;
  title?: string;
  data?: Record<string, unknown>;
  palette?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  parentId?: string | null;
}

export interface ConnectInput {
  canvas: string;
  source: string;
  target: string;
  label?: string;
  id?: string;
  sourceSide?: Side;
  targetSide?: Side;
  style?: EdgeStyleInput;
}

export interface BuildKnowledgeInput {
  canvas: string;
  description?: string;
  tags?: string[];
  groups?: { key: string; title: string; palette?: string }[];
  nodes: { key: string; type: string; title: string; data?: Record<string, unknown>; palette?: string; group?: string; size?: { width: number; height: number } }[];
  edges?: { from: string; to: string; label?: string; style?: EdgeStyleInput }[];
  layout?: 'LR' | 'TB' | 'none';
  story?: boolean;
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function uniqueId(base: string, taken: Set<string>): string {
  const root = slugify(base) || 'node';
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

function edgeLook(style: EdgeStyleInput = {}, fallbackColor = '#94a3b8'): EdgeLook {
  const color = style.color ?? (style.palette && isPaletteName(style.palette) ? paletteColor(style.palette) : fallbackColor);
  return { color, path: style.path, stroke: style.stroke, animated: style.animated, start: style.start, end: style.end, width: style.width };
}

export class MosaicOps {
  constructor(private readonly vault: VaultRepository) {}

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  async nodeTypes(): Promise<NodeTypeSchema[]> {
    return (await this.vault.readNodeTypes())?.nodeTypes ?? [];
  }

  async guide() {
    const doc = await this.vault.readNodeTypes();
    return {
      workflow: [
        'Call list_canvases, then read_canvas (detail "summary") before editing an existing canvas.',
        'To create a whole map at once, use build_knowledge (groups + nodes + edges + layout in one call). Use the single-node tools below for small edits.',
        'Create nodes with create_node; omit position to auto-place without overlap (use "near" to place beside a related node, "parentId" to put it inside a group).',
        'Size nodes so content is never clipped (see design.rules); start from the type defaultSize.',
        'Group related nodes with create_group and give each category one palette name.',
        'Connect with connect; sides are picked automatically from node positions unless given.',
        'Finish with set_story_order so the Story view walks the canvas in a sensible order, and auto_layout if the canvas got messy.',
        'Link related notes with [[Node title]] in text and tag them with #tag; get_links shows outgoing links and backlinks.',
        'Changes are written to the vault and appear live in the MosaicFlow app.',
      ],
      design: doc?.design ?? DESIGN_GUIDE,
      paletteNames: Object.keys(DESIGN_GUIDE.palette),
      nodeTypes: (doc?.nodeTypes ?? []).map((t) => ({
        type: t.type,
        label: t.label,
        category: t.category,
        purpose: t.knowledge?.purpose ?? t.description,
        bodyField: t.knowledge?.bodyField ?? 'notes',
        fields: t.knowledge?.fields ?? {},
        defaultSize: t.defaultSize,
        capabilities: t.capabilities,
      })),
      ...(doc ? {} : { warning: 'node-types.json not found: open this vault once in MosaicFlow to export node type schemas.' }),
    };
  }

  async listCanvases() {
    return (await this.vault.listCanvases()).map((c) => ({
      id: c.id, name: c.name, description: c.description, tags: c.tags, updatedAt: c.updated_at,
    }));
  }

  async createCanvas(spec: { name: string; description?: string; tags?: string[] }) {
    const { entry } = await this.vault.createCanvas(spec);
    return { id: entry.id, name: entry.name };
  }

  async readCanvas(ref: string, detail: 'summary' | 'full' = 'summary') {
    const { entry, repo } = await this.vault.openCanvas(ref);
    const nodes = await repo.readAllNodes();
    const edges = await repo.readAllEdges();
    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    return {
      canvas: { id: entry.id, name: entry.name, description: entry.description, tags: entry.tags },
      coordinates: 'x/y/width/height are absolute canvas coordinates; "position" is relative to "parent" when set.',
      nodes: nodes.map((n) => {
        const r = rects.get(n.id)!;
        const base = {
          id: n.id,
          type: n.type,
          title: String(n.data.title ?? ''),
          ...(n.parentId ? { parent: n.parentId, position: n.position } : {}),
          x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
          ...(typeof n.data.order === 'number' ? { order: n.data.order } : {}),
        };
        if (detail === 'full') return { ...base, data: n.data };
        const text = nodeText(n.data).replace(String(n.data.title ?? ''), '').replace(/\s+/g, ' ').trim();
        return { ...base, preview: text.length > 160 ? `${text.slice(0, 160)}…` : text };
      }),
      edges: edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        ...(e.label ? { label: e.label } : {}),
        ...(detail === 'full' ? { sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, type: e.type, data: e.data } : {}),
      })),
    };
  }

  async search(query: string, opts: { canvas?: string; limit?: number; match?: 'all' | 'any' } = {}) {
    const index = await this.buildIndex();
    const canvasId = opts.canvas ? (await this.vault.findCanvas(opts.canvas)).id : undefined;
    return index.search(query, { canvasId, limit: opts.limit ?? 20, match: opts.match }).map((h) => ({
      canvas: h.node.canvasName, nodeId: h.node.id, type: h.node.type, title: h.node.title, tags: h.node.tags, snippet: h.snippet, score: h.score,
    }));
  }

  /** Full content of specific nodes (any canvases) with their resolved links and backlinks, for answering questions. */
  async readNodes(refs: { canvas: string; nodeId: string }[]) {
    const index = await this.buildIndex();
    const canvases = await this.vault.listCanvases();
    const ref = (n: { canvasName: string; id: string; title: string }) => ({ canvas: n.canvasName, nodeId: n.id, title: n.title });
    return refs.map(({ canvas, nodeId }) => {
      const lower = canvas.trim().toLowerCase();
      const entry = canvases.find((c) => c.id === canvas || c.name.toLowerCase() === lower || c.folder.toLowerCase() === lower);
      const node = entry && index.nodes.find((n) => n.canvasId === entry.id && n.id === nodeId);
      if (!entry || !node) return { canvas, nodeId, error: 'not found' };
      return {
        canvas: node.canvasName,
        nodeId: node.id,
        type: node.type,
        title: node.title,
        tags: node.tags,
        text: node.text,
        links: index.outgoing(entry.id, node.id).flatMap(({ node: target }) => (target ? [ref(target)] : [])),
        backlinks: index.backlinks(entry.id, node.id).map(ref),
      };
    });
  }

  private async buildIndex(): Promise<KnowledgeIndex> {
    const canvases = [];
    for (const c of await this.vault.listCanvases()) {
      const { repo } = await this.vault.openCanvas(c.id);
      canvases.push({ id: c.id, name: c.name, nodes: await repo.readAllNodes() });
    }
    return new KnowledgeIndex(canvases);
  }

  async links(canvas: string, nodeId: string) {
    const entry = await this.vault.findCanvas(canvas);
    const index = await this.buildIndex();
    if (!index.nodes.some((n) => n.canvasId === entry.id && n.id === nodeId)) throw new Error(`Node "${nodeId}" not found`);
    const ref = (n: { canvasName: string; id: string; title: string }) => ({ canvas: n.canvasName, nodeId: n.id, title: n.title });
    return {
      syntax: 'Link nodes by writing [[Node title]] (or [[Canvas name#Node title]], [[Title|label]]) in any text field; tag with #tag or data.tags.',
      outgoing: index.outgoing(entry.id, nodeId).map(({ link, node }) => ({ text: link.raw, resolved: node ? ref(node) : null })),
      backlinks: index.backlinks(entry.id, nodeId).map(ref),
    };
  }

  async tags(canvas?: string) {
    const index = await this.buildIndex();
    const canvasId = canvas ? (await this.vault.findCanvas(canvas)).id : undefined;
    return index.tagCounts(canvasId);
  }

  // ---------------------------------------------------------------------------
  // Nodes
  // ---------------------------------------------------------------------------

  private async open(ref: string) {
    const { entry, repo } = await this.vault.openCanvas(ref);
    return { entry, repo, nodes: await repo.readAllNodes() };
  }

  private async typeSchema(type: string): Promise<NodeTypeSchema | undefined> {
    const types = await this.nodeTypes();
    if (types.length === 0) return undefined;
    const schema = types.find((t) => t.type === type);
    if (!schema) throw new Error(`Unknown node type "${type}". Available: ${types.map((t) => t.type).join(', ')}`);
    return schema;
  }

  private async isContainer(type: string) {
    return type === 'group' || !!(await this.nodeTypes()).find((t) => t.type === type)?.capabilities?.container;
  }

  /** Enlarges a container so all its children fit with padding (never shrinks). */
  private async growToFit(repo: CanvasRepository, nodes: StoredNode[], parentId: string | undefined) {
    if (!parentId) return;
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return;
    const children = nodes.filter((n) => n.parentId === parentId);
    const bounds = boundsOf(children.map((c) => ({ ...c.position, width: c.width ?? FALLBACK_SIZE.width, height: c.height ?? FALLBACK_SIZE.height })));
    if (!bounds) return;
    const width = Math.max(parent.width ?? 0, bounds.x + bounds.width + GROUP_PAD.side);
    const height = Math.max(parent.height ?? 0, bounds.y + bounds.height + GROUP_PAD.bottom);
    if (width !== parent.width || height !== parent.height) {
      parent.width = width;
      parent.height = height;
      await repo.writeNode(parent);
    }
  }

  async createNode(input: CreateNodeInput) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const schema = await this.typeSchema(input.type);
    const taken = new Set(nodes.map((n) => n.id));
    // Placing beside a node that sits in a group puts the new node in that group too.
    if (input.parentId === undefined && input.near && !input.position) {
      input = { ...input, parentId: nodes.find((n) => n.id === input.near)?.parentId };
    }

    const id = input.id ?? uniqueId(input.title || input.type, taken);
    if (!SAFE_ID.test(id)) throw new Error(`Invalid id "${id}"`);
    if (taken.has(id)) throw new Error(`A node with id "${id}" already exists`);

    if (input.parentId) {
      const parent = nodes.find((n) => n.id === input.parentId);
      if (!parent) throw new Error(`Parent "${input.parentId}" not found`);
      if (!(await this.isContainer(parent.type))) throw new Error(`"${input.parentId}" (${parent.type}) cannot contain nodes`);
    }
    if (input.palette && !isPaletteName(input.palette)) {
      throw new Error(`Unknown palette "${input.palette}". Use one of: ${Object.keys(DESIGN_GUIDE.palette).join(', ')}`);
    }

    const size = input.size ?? schema?.defaultSize ?? FALLBACK_SIZE;
    const container = await this.isContainer(input.type);
    const style = input.palette && isPaletteName(input.palette)
      ? (container ? paletteGroup(input.palette) : paletteCard(input.palette, { text: input.palette === 'amber' }))
      : {};
    const data: Record<string, unknown> = {
      ...(schema?.defaultData ?? {}),
      ...style,
      ...(input.data ?? {}),
      title: input.title,
      ...(container ? { label: input.data?.label ?? input.title } : {}),
    };

    let position = input.position;
    if (!position) {
      const siblings = nodes.filter((n) => n.parentId === input.parentId);
      const occupied: Rect[] = siblings.map((n) => ({ ...n.position, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height }));
      let near: Rect | undefined;
      if (input.near) {
        const rects = absoluteRects(nodes, FALLBACK_SIZE);
        const nearRect = rects.get(input.near);
        if (!nearRect) throw new Error(`"near" node "${input.near}" not found`);
        const origin = input.parentId ? rects.get(input.parentId)! : { x: 0, y: 0 };
        near = { ...nearRect, x: nearRect.x - origin.x, y: nearRect.y - origin.y };
      }
      position = input.parentId && occupied.length === 0
        ? { x: GROUP_PAD.side, y: GROUP_PAD.top }
        : findFreePosition(occupied, size, {
            near,
            gap: input.parentId ? 30 : 60,
            ...(input.parentId ? { min: { x: GROUP_PAD.side, y: GROUP_PAD.top } } : {}),
          });
    }

    const node: StoredNode = {
      id,
      type: input.type,
      position,
      width: size.width,
      height: size.height,
      zIndex: container ? -1 : 1,
      ...(input.parentId ? { parentId: input.parentId } : {}),
      data,
    };
    await repo.writeNode(node);
    nodes.push(node);
    await this.growToFit(repo, nodes, input.parentId);
    await this.vault.touchCanvas(entry);
    const rect = absoluteRects(nodes, FALLBACK_SIZE).get(id)!;
    return { id, ...rect };
  }

  async updateNode(input: UpdateNodeInput) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const node = nodes.find((n) => n.id === input.id);
    if (!node) throw new Error(`Node "${input.id}" not found`);
    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    const oldParent = node.parentId;

    if (input.palette) {
      if (!isPaletteName(input.palette)) throw new Error(`Unknown palette "${input.palette}"`);
      Object.assign(node.data, (await this.isContainer(node.type)) ? paletteGroup(input.palette) : paletteCard(input.palette, { text: input.palette === 'amber' }));
    }
    for (const [key, value] of Object.entries(input.data ?? {})) {
      if (value === null) delete node.data[key];
      else node.data[key] = value;
    }
    if (input.title !== undefined) node.data.title = input.title;
    if (input.size) {
      node.width = input.size.width;
      node.height = input.size.height;
    }

    if (input.parentId !== undefined && input.parentId !== (node.parentId ?? null)) {
      const abs = rects.get(node.id)!;
      if (input.parentId === null) {
        delete node.parentId;
        delete node.extent;
        node.position = { x: abs.x, y: abs.y };
      } else {
        const parent = nodes.find((n) => n.id === input.parentId);
        if (!parent) throw new Error(`Parent "${input.parentId}" not found`);
        if (!(await this.isContainer(parent.type))) throw new Error(`"${input.parentId}" cannot contain nodes`);
        if (parent.id === node.id || this.isDescendant(nodes, parent.id, node.id)) throw new Error('A node cannot be placed inside itself');
        const origin = rects.get(parent.id)!;
        node.parentId = parent.id;
        node.position = { x: abs.x - origin.x, y: abs.y - origin.y };
      }
    }
    if (input.position) node.position = input.position;

    await repo.writeNode(node);
    await this.growToFit(repo, nodes, node.parentId);
    if (oldParent !== node.parentId) await this.growToFit(repo, nodes, oldParent);
    await this.vault.touchCanvas(entry);
    return { id: node.id, ...absoluteRects(nodes, FALLBACK_SIZE).get(node.id)! };
  }

  private isDescendant(nodes: StoredNode[], id: string, ancestor: string): boolean {
    let current = nodes.find((n) => n.id === id);
    for (let i = 0; current?.parentId && i < nodes.length; i++) {
      if (current.parentId === ancestor) return true;
      current = nodes.find((n) => n.id === current!.parentId);
    }
    return false;
  }

  async deleteNode(canvas: string, id: string) {
    const { entry, repo, nodes } = await this.open(canvas);
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Node "${id}" not found`);
    const rects = absoluteRects(nodes, FALLBACK_SIZE);

    // Children of a deleted container stay where they are on the canvas.
    const children = nodes.filter((n) => n.parentId === id);
    for (const child of children) {
      const abs = rects.get(child.id)!;
      const origin = node.parentId ? rects.get(node.parentId)! : { x: 0, y: 0 };
      child.position = { x: abs.x - origin.x, y: abs.y - origin.y };
      if (node.parentId) child.parentId = node.parentId;
      else delete child.parentId;
      delete child.extent;
      await repo.writeNode(child);
    }

    const edges = (await repo.readAllEdges()).filter((e) => e.source === id || e.target === id);
    for (const e of edges) await repo.deleteEdge(e.id);
    await repo.deleteNode(id);
    await this.vault.touchCanvas(entry);
    return { deleted: id, removedEdges: edges.map((e) => e.id), detachedChildren: children.map((c) => c.id) };
  }

  // ---------------------------------------------------------------------------
  // Edges
  // ---------------------------------------------------------------------------

  async connect(input: ConnectInput) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const source = nodes.find((n) => n.id === input.source);
    const target = nodes.find((n) => n.id === input.target);
    if (!source) throw new Error(`Source node "${input.source}" not found`);
    if (!target) throw new Error(`Target node "${input.target}" not found`);
    if (source.id === target.id) throw new Error('Cannot connect a node to itself');

    const types = await this.nodeTypes();
    for (const n of [source, target]) {
      if (types.find((t) => t.type === n.type)?.capabilities?.connectable === false) {
        throw new Error(`"${n.id}" (${n.type}) has no connection handles`);
      }
    }

    const edges = await repo.readAllEdges();
    if (edges.some((e) => e.source === source.id && e.target === target.id)) {
      throw new Error(`"${source.id}" is already connected to "${target.id}"; use update_edge to change it`);
    }

    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    const sides = facingSides(rects.get(source.id)!, rects.get(target.id)!);
    const taken = new Set(edges.map((e) => e.id));
    const id = input.id ?? uniqueId(`e-${source.id}-${target.id}`, taken);
    if (!SAFE_ID.test(id) || taken.has(id)) throw new Error(`Invalid or duplicate edge id "${id}"`);

    const targetBorder = typeof target.data.borderColor === 'string' ? target.data.borderColor : undefined;
    const edge = buildEdge(
      id, source.id, target.id, input.label ?? '',
      `${input.sourceSide ?? sides.source}-source`,
      `${input.targetSide ?? sides.target}-target`,
      edgeLook(input.style, targetBorder)
    );
    await repo.writeEdge(edge);
    await this.vault.touchCanvas(entry);
    return { id, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle };
  }

  async updateEdge(input: { canvas: string; id: string; label?: string; style?: EdgeStyleInput; sourceSide?: Side; targetSide?: Side }) {
    const { entry, repo } = await this.vault.openCanvas(input.canvas);
    const edge = await repo.readEdge(input.id);
    if (!edge) throw new Error(`Edge "${input.id}" not found`);
    const data = { ...(edge.data ?? {}) };
    const s = input.style ?? {};
    if (s.color || s.palette) {
      const color = edgeLook(s, String(data.color ?? '#94a3b8')).color;
      data.color = color;
      data.labelColor = color;
    }
    if (s.path) data.pathType = s.path;
    if (s.stroke) data.strokeStyle = s.stroke;
    if (s.width) data.strokeWidth = s.width;
    if (s.start) data.markerStart = s.start;
    if (s.end) data.markerEnd = s.end;
    if (s.animated !== undefined) data.animated = s.animated;

    const pathType = String(data.pathType ?? 'bezier');
    const next: StoredEdge = {
      ...edge,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.sourceSide ? { sourceHandle: `${input.sourceSide}-source` } : {}),
      ...(input.targetSide ? { targetHandle: `${input.targetSide}-target` } : {}),
      type: pathType === 'bezier' ? 'default' : pathType,
      animated: !!data.animated,
      data,
    };
    await repo.writeEdge(next);
    await this.vault.touchCanvas(entry);
    return { id: next.id };
  }

  async deleteEdge(canvas: string, id: string) {
    const { entry, repo } = await this.vault.openCanvas(canvas);
    if (!(await repo.readEdge(id))) throw new Error(`Edge "${id}" not found`);
    await repo.deleteEdge(id);
    await this.vault.touchCanvas(entry);
    return { deleted: id };
  }

  // ---------------------------------------------------------------------------
  // Structure
  // ---------------------------------------------------------------------------

  async createGroup(input: { canvas: string; title: string; nodeIds: string[]; palette?: string; id?: string }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    if (input.nodeIds.length === 0) throw new Error('nodeIds is empty');
    const members = input.nodeIds.map((id) => {
      const n = nodes.find((x) => x.id === id);
      if (!n) throw new Error(`Node "${id}" not found`);
      return n;
    });
    const parentId = members[0].parentId;
    if (members.some((m) => m.parentId !== parentId)) throw new Error('All nodes must share the same parent to be grouped');
    if (input.palette && !isPaletteName(input.palette)) throw new Error(`Unknown palette "${input.palette}"`);

    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    const bounds = boundsOf(members.map((m) => rects.get(m.id)!))!;
    const groupAbs = { x: bounds.x - GROUP_PAD.side, y: bounds.y - GROUP_PAD.top };
    const origin = parentId ? rects.get(parentId)! : { x: 0, y: 0 };
    const schema = await this.typeSchema('group').catch(() => undefined);
    const id = input.id ?? uniqueId(input.title, new Set(nodes.map((n) => n.id)));
    if (!SAFE_ID.test(id) || nodes.some((n) => n.id === id)) throw new Error(`Invalid or duplicate group id "${id}"`);

    const group: StoredNode = {
      id,
      type: 'group',
      position: { x: groupAbs.x - origin.x, y: groupAbs.y - origin.y },
      width: bounds.width + GROUP_PAD.side * 2,
      height: bounds.height + GROUP_PAD.top + GROUP_PAD.bottom,
      zIndex: -1,
      ...(parentId ? { parentId } : {}),
      data: {
        ...(schema?.defaultData ?? {}),
        ...(input.palette && isPaletteName(input.palette) ? paletteGroup(input.palette) : {}),
        title: input.title,
        label: input.title,
      },
    };
    await repo.writeNode(group);
    for (const m of members) {
      const abs = rects.get(m.id)!;
      m.parentId = id;
      m.position = { x: abs.x - groupAbs.x, y: abs.y - groupAbs.y };
      await repo.writeNode(m);
    }
    await this.vault.touchCanvas(entry);
    return { id, x: groupAbs.x, y: groupAbs.y, width: group.width, height: group.height };
  }

  async setStoryOrder(canvas: string, nodeIds: string[]) {
    const { entry, repo, nodes } = await this.open(canvas);
    const missing = nodeIds.filter((id) => !nodes.some((n) => n.id === id));
    if (missing.length) throw new Error(`Unknown node ids: ${missing.join(', ')}`);
    let changed = 0;
    for (const n of nodes) {
      const step = nodeIds.indexOf(n.id);
      const next = step >= 0 ? step + 1 : undefined;
      if (n.data.order === next) continue;
      if (next === undefined) delete n.data.order;
      else n.data.order = next;
      await repo.writeNode(n);
      changed++;
    }
    await this.vault.touchCanvas(entry);
    return { ordered: nodeIds.length, changed };
  }

  /**
   * Builds a whole knowledge map in one call: creates the canvas if needed, then groups, nodes and
   * edges (referenced by caller-chosen keys), lays them out and sets the story order.
   */
  async buildKnowledge(input: BuildKnowledgeInput) {
    const groups = input.groups ?? [];
    const edges = input.edges ?? [];
    const keys = new Set<string>();
    for (const k of [...groups.map((g) => g.key), ...input.nodes.map((n) => n.key)]) {
      if (keys.has(k)) throw new Error(`Duplicate key "${k}"`);
      keys.add(k);
    }
    const groupKeys = new Set(groups.map((g) => g.key));
    for (const n of input.nodes) {
      if (n.group && !groupKeys.has(n.group)) throw new Error(`Node "${n.key}" uses unknown group "${n.group}"`);
    }
    for (const e of edges) {
      for (const k of [e.from, e.to]) if (!keys.has(k)) throw new Error(`Edge ${e.from} -> ${e.to} uses unknown key "${k}"`);
    }

    const existing = (await this.vault.listCanvases()).find(
      (c) => c.id === input.canvas || c.name.toLowerCase() === input.canvas.trim().toLowerCase()
    );
    const canvas = existing?.name ?? (await this.createCanvas({ name: input.canvas, description: input.description, tags: input.tags })).name;

    const ids = new Map<string, string>();
    for (const g of groups) {
      const created = await this.createNode({ canvas, type: 'group', title: g.title, palette: g.palette });
      ids.set(g.key, created.id);
    }
    for (const n of input.nodes) {
      const created = await this.createNode({
        canvas,
        type: n.type,
        title: n.title,
        data: n.data,
        palette: n.palette,
        size: n.size,
        ...(n.group ? { parentId: ids.get(n.group) } : {}),
      });
      ids.set(n.key, created.id);
    }

    const edgeIds: string[] = [];
    const explicitPaths = new Set<string>();
    const warnings: string[] = [];
    for (const e of edges) {
      try {
        const created = await this.connect({ canvas, source: ids.get(e.from)!, target: ids.get(e.to)!, label: e.label, style: e.style });
        edgeIds.push(created.id);
        if (e.style?.path) explicitPaths.add(created.id);
      } catch (error) {
        warnings.push(`${e.from} -> ${e.to}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (input.layout !== 'none') {
      if (!existing) {
        // New page: arrange groups and nodes around their connections. Existing pages keep their layout.
        const order: string[] = [];
        for (const n of input.nodes) {
          const id = ids.get(n.group ?? n.key)!;
          if (!order.includes(id)) order.push(id);
        }
        for (const g of groups) if (!order.includes(ids.get(g.key)!)) order.push(ids.get(g.key)!);
        await this.arrangePage(canvas, order, explicitPaths, input.layout ?? 'TB');
      } else {
        for (const g of groups) {
          if (input.nodes.filter((n) => n.group === g.key).length >= 2) {
            await this.autoLayout({ canvas, parentId: ids.get(g.key), direction: input.layout ?? 'LR' });
          }
        }
      }
    }
    if (input.story !== false && input.nodes.length > 0) {
      await this.setStoryOrder(canvas, input.nodes.map((n) => ids.get(n.key)!));
    }

    return {
      canvas,
      created: existing ? 'added to existing canvas' : 'new canvas',
      ids: Object.fromEntries(ids),
      edges: edgeIds.length,
      ...(warnings.length ? { warnings } : {}),
    };
  }

  /**
   * Lays out a whole page so edges stay short and readable:
   * 1. inside groups: a flow layout when members link to each other, otherwise rows;
   * 2. top-level blocks (groups and loose nodes) layered along their connections, unconnected blocks in a side column;
   * 3. members of link-free groups re-ordered to line up with what they connect to (fewer crossings);
   * 4. every edge leaves from the side facing its partner; straight when aligned, step otherwise.
   */
  private async arrangePage(canvas: string, order: string[], explicitPaths: Set<string>, direction: 'LR' | 'TB') {
    const { entry, repo, nodes } = await this.open(canvas);
    const edges = await repo.readAllEdges();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const dims = (n: StoredNode) => ({ width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height });
    const topOf = (id: string): string | undefined => {
      let n = byId.get(id);
      for (let i = 0; n?.parentId && i < nodes.length; i++) n = byId.get(n.parentId);
      return n?.id;
    };
    const kidsOf = (gid: string) => nodes.filter((n) => n.parentId === gid);
    const containers = order.filter((id) => kidsOf(id).length > 0);
    const innerEdges = (kids: StoredNode[]) => {
      const set = new Set(kids.map((k) => k.id));
      return edges.filter((e) => set.has(e.source) && set.has(e.target));
    };

    const layoutGroup = (gid: string, kids: StoredNode[]) => {
      const inner = innerEdges(kids);
      const items = kids.map((k) => ({ id: k.id, ...dims(k) }));
      const origin = { x: GROUP_PAD.side, y: GROUP_PAD.top };
      const pos = inner.length
        ? autoLayout(items, inner, { direction: 'LR', origin, nodeGap: 40, layerGap: 110 })
        : gridLayout(items, { origin, nodeGap: 40, gridColumns: Math.min(kids.length, direction === 'TB' ? 5 : 2) });
      for (const k of kids) k.position = pos.get(k.id)!;
      const b = boundsOf(kids.map((k) => ({ ...k.position, ...dims(k) })))!;
      const g = byId.get(gid)!;
      g.width = b.x + b.width + GROUP_PAD.side;
      g.height = b.y + b.height + GROUP_PAD.bottom;
    };

    const placeBlocks = () => {
      const links = edges
        .map((e) => ({ source: topOf(e.source)!, target: topOf(e.target)! }))
        .filter((e) => e.source && e.target && e.source !== e.target && order.includes(e.source) && order.includes(e.target));
      const linked = order.filter((id) => links.some((l) => l.source === id || l.target === id));
      const loose = order.filter((id) => !linked.includes(id));
      const items = (list: string[]) => list.map((id) => ({ id, ...dims(byId.get(id)!) }));
      const pos = linked.length >= 2
        ? autoLayout(items(linked), links, { direction, nodeGap: 120, layerGap: 180 })
        : wrapLayout(items(order), { nodeGap: 160 });
      if (linked.length >= 2 && loose.length) {
        // Unconnected blocks stack in a column beside the flow instead of under it.
        const right = Math.max(...linked.map((id) => pos.get(id)!.x + dims(byId.get(id)!).width)) + 180;
        let y = 0;
        for (const id of loose) {
          pos.set(id, { x: right, y });
          y += dims(byId.get(id)!).height + 120;
        }
      }
      for (const id of order) if (pos.has(id)) byId.get(id)!.position = pos.get(id)!;
    };

    for (const gid of containers) layoutGroup(gid, kidsOf(gid));
    placeBlocks();
    for (let pass = 0; pass < 2; pass++) {
      const rects = absoluteRects(nodes, FALLBACK_SIZE);
      const centre = (id: string) => {
        const r = rects.get(id)!;
        return direction === 'TB' ? r.x + r.width / 2 : r.y + r.height / 2;
      };
      for (const gid of containers) {
        const kids = kidsOf(gid);
        if (innerEdges(kids).length) continue;
        const key = (k: StoredNode) => {
          const partners = edges
            .flatMap((e) => (e.source === k.id ? [e.target] : e.target === k.id ? [e.source] : []))
            .filter((o) => topOf(o) !== gid && rects.has(o));
          return partners.length ? partners.reduce((s, o) => s + centre(o), 0) / partners.length : Infinity;
        };
        const sorted = kids.map((k, i) => ({ k, i, key: key(k) })).sort((a, b) => a.key - b.key || a.i - b.i).map((s) => s.k);
        layoutGroup(gid, sorted);
      }
      placeBlocks();
    }

    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    for (const e of edges) {
      const a = rects.get(e.source);
      const b = rects.get(e.target);
      if (!a || !b) continue;
      const sides = facingSides(a, b);
      e.sourceHandle = `${sides.source}-source`;
      e.targetHandle = `${sides.target}-target`;
      if (!explicitPaths.has(e.id)) {
        const horizontal = sides.source === 'left' || sides.source === 'right';
        const offset = horizontal ? (a.y + a.height / 2) - (b.y + b.height / 2) : (a.x + a.width / 2) - (b.x + b.width / 2);
        const path = Math.abs(offset) < 24 ? 'straight' : 'smoothstep';
        e.type = path;
        e.data = { ...(e.data ?? {}), pathType: path };
      }
    }

    for (const n of nodes) await repo.writeNode(n);
    for (const e of edges) await repo.writeEdge(e);
    await this.vault.touchCanvas(entry);
  }

  /** Creates a canvas from a Mermaid flowchart (nodes become notes, subgraphs become groups). */
  async importMermaid(input: { name: string; mermaid: string; description?: string }) {
    const result = importMermaid(input.mermaid);
    const { entry, repo } = await this.vault.createCanvas({ name: input.name, description: input.description ?? 'Imported from Mermaid', tags: ['mermaid'] });
    for (const n of result.nodes) await repo.writeNode(n);
    for (const e of result.edges) await repo.writeEdge(e);
    return { canvas: entry.name, nodes: result.nodes.length, edges: result.edges.length, warnings: result.warnings };
  }

  /**
   * Re-arranges nodes with a layered layout following the edges (or a grid). Only nodes that share
   * the same parent are moved; by default the top-level nodes of the canvas.
   */
  async autoLayout(input: { canvas: string; parentId?: string; nodeIds?: string[]; direction?: 'LR' | 'TB'; mode?: 'layered' | 'wrap' }) {
    const { entry, repo, nodes } = await this.open(input.canvas);
    const edges = await repo.readAllEdges();
    let targets = input.nodeIds
      ? input.nodeIds.map((id) => {
          const n = nodes.find((x) => x.id === id);
          if (!n) throw new Error(`Node "${id}" not found`);
          return n;
        })
      : nodes.filter((n) => n.parentId === input.parentId);
    if (targets.length < 2) throw new Error('Need at least two nodes to lay out');
    const parentId = targets[0].parentId;
    targets = targets.filter((n) => n.parentId === parentId);

    // Edges to/from descendants count for their top-most ancestor in this set.
    const ids = new Set(targets.map((n) => n.id));
    const owner = (id: string): string | undefined => {
      let cur = nodes.find((n) => n.id === id);
      for (let i = 0; cur && i < nodes.length; i++) {
        if (ids.has(cur.id)) return cur.id;
        const parent: string | undefined = cur.parentId;
        cur = parent ? nodes.find((n) => n.id === parent) : undefined;
      }
      return undefined;
    };
    const layoutEdges = edges
      .map((e) => ({ source: owner(e.source), target: owner(e.target) }))
      .filter((e): e is { source: string; target: string } => !!e.source && !!e.target && e.source !== e.target);

    const before = boundsOf(targets.map((n) => ({ ...n.position, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height })))!;
    const origin = parentId ? { x: Math.max(before.x, GROUP_PAD.side), y: Math.max(before.y, GROUP_PAD.top) } : { x: before.x, y: before.y };
    const positions = input.mode === 'wrap'
      ? wrapLayout(
          targets.map((n) => ({ id: n.id, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height })),
          { origin, nodeGap: parentId ? 40 : 160 }
        )
      : autoLayout(
          targets.map((n) => ({ id: n.id, width: n.width ?? FALLBACK_SIZE.width, height: n.height ?? FALLBACK_SIZE.height })),
          layoutEdges,
          { direction: input.direction ?? 'LR', origin, nodeGap: parentId ? 40 : 60 }
        );
    for (const n of targets) {
      n.position = positions.get(n.id)!;
      await repo.writeNode(n);
    }
    await this.growToFit(repo, nodes, parentId);

    // Re-pick facing handles for edges between moved nodes.
    const rects = absoluteRects(nodes, FALLBACK_SIZE);
    let rerouted = 0;
    for (const e of edges) {
      if (!owner(e.source) || !owner(e.target)) continue;
      const sides = facingSides(rects.get(e.source)!, rects.get(e.target)!);
      const sourceHandle = `${sides.source}-source`;
      const targetHandle = `${sides.target}-target`;
      if (e.sourceHandle !== sourceHandle || e.targetHandle !== targetHandle) {
        await repo.writeEdge({ ...e, sourceHandle, targetHandle });
        rerouted++;
      }
    }
    await this.vault.touchCanvas(entry);
    return { moved: targets.length, reroutedEdges: rerouted };
  }
}
