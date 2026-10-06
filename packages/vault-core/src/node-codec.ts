import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import type { NodeKnowledgeSchema, StoredNode } from './types';

export const DEFAULT_BODY_FIELD = 'notes';

export interface BodyMapping {
  field: string;
  languageField?: string;
}

export type BodyMappingResolver = (type: string) => BodyMapping;

export function bodyMappingFor(
  knowledge?: Pick<NodeKnowledgeSchema, 'bodyField' | 'bodyLanguageField'>
): BodyMapping {
  return {
    field: knowledge?.bodyField ?? DEFAULT_BODY_FIELD,
    languageField: knowledge?.bodyLanguageField,
  };
}

const FENCED = /^```([^\n]*)\n([\s\S]*?)\n?```\s*$/;

/**
 * Node file layout:
 *
 * ---
 * id, type, title        <- identity (title hoisted so Obsidian & LLMs see it first)
 * layout: {x, y, width, height, zIndex, parent, extent, expandParent}
 * data: {...}            <- every other data field
 * ---
 * <markdown body>        <- value of the type's body field
 */
export function nodeToMarkdown(node: StoredNode, mapping: BodyMapping): string {
  const { title, ...rest } = node.data;
  const data: Record<string, unknown> = { ...rest };

  const rawBody = data[mapping.field];
  delete data[mapping.field];
  let body = typeof rawBody === 'string' ? rawBody : rawBody == null ? '' : String(rawBody);

  if (mapping.languageField) {
    const language = typeof data[mapping.languageField] === 'string' ? data[mapping.languageField] : '';
    body = `\`\`\`${language}\n${body}\n\`\`\`\n`;
  }

  const attributes: Record<string, unknown> = {
    id: node.id,
    type: node.type,
    title: title ?? '',
    layout: {
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
      zIndex: node.zIndex,
      parent: node.parentId,
      extent: node.extent,
      expandParent: node.expandParent,
    },
    data,
  };

  return stringifyFrontmatter(attributes, body);
}

export function markdownToNode(text: string, resolveMapping: BodyMappingResolver): StoredNode {
  const { attributes, body } = parseFrontmatter(text);

  const id = attributes.id;
  const type = attributes.type;
  if (typeof id !== 'string' || typeof type !== 'string') {
    throw new Error('Node file is missing a string `id` or `type` in its frontmatter');
  }

  const layout = (attributes.layout ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {
    ...((attributes.data ?? {}) as Record<string, unknown>),
    title: attributes.title ?? '',
  };

  const mapping = resolveMapping(type);
  let content = body;
  if (mapping.languageField) {
    const fenced = FENCED.exec(body.replace(/\s+$/, ''));
    if (fenced) {
      content = fenced[2];
      if (data[mapping.languageField] === undefined && fenced[1]) {
        data[mapping.languageField] = fenced[1].trim();
      }
    }
  }
  // An empty implicit `notes` body is not written back as a field to keep data clean.
  if (content !== '' || mapping.field !== DEFAULT_BODY_FIELD) {
    data[mapping.field] = content;
  }

  return {
    id,
    type,
    position: { x: toNumber(layout.x), y: toNumber(layout.y) },
    width: optionalNumber(layout.width),
    height: optionalNumber(layout.height),
    zIndex: optionalNumber(layout.zIndex),
    parentId: typeof layout.parent === 'string' ? layout.parent : undefined,
    extent: layout.extent ?? undefined,
    expandParent: typeof layout.expandParent === 'boolean' ? layout.expandParent : undefined,
    data,
  };
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
