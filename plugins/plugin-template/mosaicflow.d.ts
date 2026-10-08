// Type definitions for the MosaicFlow plugin API.
// Reference them from JavaScript for editor autocomplete:
//   /** @param {import('./mosaicflow').PluginAPI} api */
//   export function activate(api) { ... }

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  apiVersion?: string;
  capabilities?: { type: 'nodeTypes'; types: string[] }[];
  frontend: { main: string; styles?: string };
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface NodeContext {
  id: string;
  type: string;
  /** A copy of the node's data; change it with `update`. */
  data: Record<string, any>;
  selected: boolean;
  /** Merge `patch` into the node's data (saved to the vault, undoable). */
  update(patch: Record<string, unknown>): void;
  /** Sanitized markdown → HTML, with [[wikilinks]] and #tags. Safe for innerHTML. */
  renderMarkdown(text: string): string;
  /** Navigate like clicking [[ref]]: a node title, "Page#Title", a node id or a page name. */
  openWikilink(ref: string): void;
}

export interface NodeHandle {
  /** Called when the node's data or selection changes. */
  update?(ctx: NodeContext): void;
  /** Called when the node unmounts (deleted, page closed, plugin disabled). */
  destroy?(): void;
}

export type FieldType = 'string' | 'markdown' | 'number' | 'boolean' | 'date' | 'url' | 'enum' | 'string[]' | 'object' | 'object[]';

export interface NodeType {
  /** Unique type id, stored in every node file (`type:`). Never change it after release. */
  type: string;
  render(container: HTMLElement, ctx: NodeContext): NodeHandle | void;
  /** Name in the insert menu (default: `type`). */
  label?: string;
  description?: string;
  /** Extra search terms for the insert menu. */
  keywords?: string[];
  /** Insert-menu group (default 'custom', shown as "Plugins"). */
  category?: 'content' | 'entity' | 'data' | 'utility' | 'custom';
  /** Built-in icon name, e.g. 'Lightbulb' (default 'Puzzle'). */
  iconName?: string;
  /** Data for new nodes; `title` defaults to the label. */
  defaultData?: Record<string, unknown>;
  dimensions?: { minWidth?: number; minHeight?: number; defaultWidth?: number; defaultHeight?: number };
  /** Colours used by the SVG export; `icon` is an emoji. */
  colors?: { bg?: string; border?: string; icon?: string };
  /** How the data is stored, searched and described to AI agents. */
  knowledge?: {
    purpose: string;
    /** Data key written as the Markdown body of the node file (default 'notes'). */
    bodyField?: string;
    fields: Record<string, { type: FieldType; description: string; values?: string[]; required?: boolean }>;
  };
  capabilities?: {
    /** Other nodes can be placed inside this one. */
    container?: boolean;
    /** false: no connection handles. */
    connectable?: boolean;
  };
  /** Show in the floating toolbar. */
  quickAccess?: boolean;
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

export interface PanelContext {
  /** The open page, or null. */
  page: { id: string; name: string } | null;
  renderMarkdown(text: string): string;
  openWikilink(ref: string): void;
  /** Close this panel. */
  close(): void;
}

export interface PanelHandle {
  /** Called when the page changes or its nodes/edges are edited. */
  update?(ctx: PanelContext): void;
  destroy?(): void;
}

export interface Panel {
  id: string;
  /** Ribbon tooltip and panel header. */
  label: string;
  description?: string;
  /** Built-in icon name for the ribbon button. */
  iconName?: string;
  /** Initial width in px (users can resize). */
  defaultWidth?: number;
  /** Ribbon order, higher first. */
  priority?: number;
  render(container: HTMLElement, ctx: PanelContext): PanelHandle | void;
}

// ---------------------------------------------------------------------------
// Commands, templates, layouts
// ---------------------------------------------------------------------------

export interface Command {
  /** Prefixed with your plugin id automatically. */
  id: string;
  /** Shown in the command palette and Settings → Keyboard shortcuts. */
  label: string;
  description?: string;
  /** Palette group (default: your plugin name). */
  category?: string;
  /** Default shortcut(s), e.g. 'Ctrl+Shift+D' (Ctrl means Cmd on macOS). Users can change them. */
  shortcut?: string | string[];
  /** 'canvas' (default): only on an open page while not typing. 'global': everywhere. */
  context?: 'canvas' | 'global';
  /** Hide from the palette and ignore the shortcut when it returns false. */
  enabled?: boolean | (() => boolean);
  handler(args?: unknown): void | Promise<void>;
}

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

export interface TemplateContent {
  nodes: {
    /** Local key used by edges and `parent`. */
    key: string;
    type: string;
    /** Relative to the template's top-left, or to the parent group. */
    x: number;
    y: number;
    width?: number;
    height?: number;
    data?: Record<string, unknown>;
    /** Key of a group (or other container) node in this template. */
    parent?: string;
  }[];
  edges?: { from: string; to: string; label?: string; fromSide?: HandleSide; toSide?: HandleSide }[];
}

export interface Template {
  id: string;
  /** Palette entry: "Insert template: <name>". */
  name: string;
  description?: string;
  content: TemplateContent | (() => TemplateContent | Promise<TemplateContent>);
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutInput {
  nodes: { id: string; type: string; x: number; y: number; width: number; height: number }[];
  /** Only edges between the given nodes. */
  edges: { source: string; target: string }[];
}

export interface Layout {
  id: string;
  /** Palette entry: "Arrange: <name>". */
  name: string;
  description?: string;
  /** New top-left positions by node id; nodes left out don't move. */
  arrange(input: LayoutInput): Record<string, Point> | Map<string, Point> | Promise<Record<string, Point> | Map<string, Point>>;
}

// ---------------------------------------------------------------------------
// Appearance and themes
// ---------------------------------------------------------------------------

export interface Appearance {
  /** Theme id, e.g. 'core.default', 'core.nord' or a plugin theme. */
  theme: string;
  /** '#rrggbb' */
  accent: string;
  /** 0.75–1.5, zoom of the whole window. */
  uiScale: number;
  /** 0.85–1.35, text in menus, panels and dialogs. */
  textScale: number;
  uiFont: 'space-grotesk' | 'system' | 'serif' | 'mono' | 'custom';
  customUiFont: string;
  monoFont: 'pt-mono' | 'space-mono' | 'system' | 'custom';
  customMonoFont: string;
  /** 0.75–1.5 */
  iconScale: number;
  iconColor: 'default' | 'accent' | 'custom';
  customIconColor: string;
  iconWeight: 'thin' | 'regular' | 'bold';
  /** 0–14 px */
  radius: number;
  density: 'compact' | 'default' | 'comfortable';
  reduceMotion: boolean;
  /** The user's own CSS. */
  customCss: string;
}

export interface Theme {
  /** Prefixed with your plugin id automatically. */
  id: string;
  name: string;
  description?: string;
  /** CSS custom properties for :root, e.g. { '--mf-bg': '#0f1a14' }. Keys must start with '--'. */
  variables: Record<string, string>;
  /** Extra CSS while the theme is active. */
  css?: string;
}

// ---------------------------------------------------------------------------
// Workspace and settings
// ---------------------------------------------------------------------------

export interface NodeView {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Group the node is inside (its x/y are then relative to the group). */
  parentId?: string;
  selected: boolean;
  data: Record<string, any>;
}

export interface EdgeView {
  id: string;
  source: string;
  target: string;
  label?: string;
  data: Record<string, any>;
}

export interface SettingDef {
  key: string;
  label: string;
  description?: string;
  type: 'toggle' | 'text' | 'number' | 'select';
  /** For 'select'. */
  options?: { value: string; label: string }[];
  default: unknown;
}

export interface PluginAPI {
  manifest: PluginManifest;

  registerNodeTypes(types: NodeType[]): void;
  registerPanels(panels: Panel[]): void;
  registerCommands(commands: Command[]): void;
  registerTemplates(templates: Template[]): void;
  registerLayouts(layouts: Layout[]): void;
  /** Themes for Settings → Appearance → Theme. */
  registerThemes(themes: Theme[]): void;

  /** Settings → Appearance. Changes are saved for the user; invalid values are ignored or clamped. */
  appearance: {
    get(): Appearance;
    set(patch: Partial<Appearance>): void;
    reset(): void;
    /** Returns an unsubscribe function. */
    onChange(listener: (appearance: Appearance) => void): () => void;
    themes(): { id: string; name: string; description?: string; pluginId: string }[];
  };

  /** The open page. Reads return copies; changes are saved and undoable. */
  workspace: {
    getNodes(): NodeView[];
    getEdges(): EdgeView[];
    getSelection(): string[];
    select(ids: string[]): void;
    /** Returns the new node id. Throws for unknown types. */
    createNode(type: string, position: Point, data?: Record<string, unknown>): string;
    updateNodeData(id: string, patch: Record<string, unknown>): void;
    moveNode(id: string, position: Point): void;
    deleteNodes(ids: string[]): void;
    /** Returns the new edge id. */
    createEdge(source: string, target: string, label?: string): string;
    /** True on view-only pages, where changes are ignored. */
    isLocked(): boolean;
  };

  ui: {
    notify(message: string, kind?: 'info' | 'success' | 'warning' | 'error'): void;
    /** Inject CSS while the plugin is on; returns a function that removes it. */
    addStyles(css: string): () => void;
  };

  commands: {
    /** Run any command: built in (e.g. 'view.fit') or from a plugin ('<plugin id>.<command id>'). */
    execute(id: string, args?: unknown): Promise<void>;
  };

  /** Shown under your plugin in Settings → Plugins, saved in settings.json. */
  settings: {
    register(defs: SettingDef[]): void;
    get<T = unknown>(key: string): T;
    set(key: string, value: unknown): void;
    /** Returns an unsubscribe function. */
    onChange(listener: (key: string, value: unknown) => void): () => void;
  };
}
