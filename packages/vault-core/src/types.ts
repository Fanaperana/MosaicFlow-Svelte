// =============================================================================
// NODE-TYPE SCHEMA (describes node types to humans, tools and LLM agents)
// =============================================================================

export type FieldType =
  | 'string'
  | 'markdown'
  | 'number'
  | 'boolean'
  | 'date'
  | 'url'
  | 'enum'
  | 'string[]'
  | 'object'
  | 'object[]';

export interface FieldSchema {
  type: FieldType;
  description: string;
  /** Allowed values when `type` is 'enum'. */
  values?: string[];
  required?: boolean;
}

export interface NodeKnowledgeSchema {
  /** When a user or agent should choose this node type over the others. */
  purpose: string;
  /** Data key persisted as the markdown body of the node file. Defaults to 'notes'. */
  bodyField?: string;
  /** Data key holding a language id; when set the body is written as a fenced code block. */
  bodyLanguageField?: string;
  /** Semantic data fields that agents may read and write (styling fields are omitted). */
  fields: Record<string, FieldSchema>;
}

export interface NodeCapabilities {
  /** Node can contain other nodes; children reference it through `parentId` (layout.parent on disk). */
  container?: boolean;
  /** Set to false for nodes without connection handles (they cannot be linked with edges). */
  connectable?: boolean;
}

export interface Size {
  width: number;
  height: number;
}

/** Serializable description of a node type, exported to `<vault>/.mosaicflow/node-types.json`. */
export interface NodeTypeSchema {
  type: string;
  label: string;
  description: string;
  category: string;
  pluginId: string;
  knowledge: NodeKnowledgeSchema;
  capabilities: NodeCapabilities;
  defaultSize: Size;
  minSize: Size;
  defaultData: Record<string, unknown>;
}

export interface DesignGuide {
  goal: string;
  nodeStyleFields: Record<string, string>;
  edgeStyleFields: Record<string, string>;
  palette: Record<string, { fill: string; border: string; text: string }>;
  rules: string[];
}

export interface NodeTypesDocument {
  schemaVersion: 1;
  generatedAt: string;
  format: Record<string, string>;
  design: DesignGuide;
  nodeTypes: NodeTypeSchema[];
}

// =============================================================================
// STORED GRAPH (what lives on disk inside a canvas folder)
// =============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface StoredNode {
  id: string;
  type: string;
  /** Relative to the parent when `parentId` is set, otherwise canvas coordinates. */
  position: Point;
  width?: number;
  height?: number;
  zIndex?: number;
  parentId?: string;
  extent?: unknown;
  expandParent?: boolean;
  data: Record<string, unknown>;
}

export interface StoredEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: unknown;
  type?: string;
  animated?: boolean;
  data?: Record<string, unknown>;
}
