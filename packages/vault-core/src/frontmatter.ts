import { parse, stringify } from 'yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;

export interface FrontmatterDocument {
  attributes: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(text: string): FrontmatterDocument {
  const match = FRONTMATTER.exec(text);
  if (!match) return { attributes: {}, body: text };

  const parsed: unknown = parse(match[1]);
  const attributes =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { attributes, body: match[2] };
}

export function stringifyFrontmatter(attributes: Record<string, unknown>, body: string): string {
  const yaml = stringify(attributes, { lineWidth: 0 });
  return `---\n${yaml}---\n${body}`;
}
