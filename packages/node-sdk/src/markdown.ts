/**
 * Safe markdown rendering for node content, with [[wikilinks]] and #tags.
 *
 * Content can come from imports, the MCP server or other tools, so the HTML is always sanitized:
 * the webview has filesystem access and must never run script from a note.
 */
import DOMPurify from 'dompurify';
import { Marked, type TokenizerAndRendererExtension } from 'marked';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Shown text of a link; lets the host show a node's title for [[node-id]] links. */
export type WikilinkLabelResolver = (ref: string) => { label: string; broken?: boolean } | null;
let resolveLabel: WikilinkLabelResolver | null = null;

export function setWikilinkLabelResolver(fn: WikilinkLabelResolver | null) {
  resolveLabel = fn;
}

const wikilink: TokenizerAndRendererExtension = {
  name: 'wikilink',
  level: 'inline',
  start: (src) => src.indexOf('[['),
  tokenizer(src) {
    const m = /^\[\[([^[\]\n|]+?)(?:\|([^[\]\n]+?))?\]\]/.exec(src);
    if (!m) return undefined;
    return { type: 'wikilink', raw: m[0], ref: m[1].trim(), alias: m[2]?.trim() };
  },
  renderer(token) {
    const ref = String(token.ref);
    const resolved = resolveLabel?.(ref) ?? null;
    const label = String(token.alias ?? resolved?.label ?? ref.slice(ref.indexOf('#') + 1));
    const cls = resolved?.broken ? 'wikilink broken' : 'wikilink';
    return `<a class="${cls}" href="#" data-wikilink="${escapeHtml(ref)}">${escapeHtml(label)}</a>`;
  },
};

const hashtag: TokenizerAndRendererExtension = {
  name: 'hashtag',
  level: 'inline',
  start(src) {
    const m = /(^|[\s(])#[A-Za-z]/.exec(src);
    return m ? m.index + m[1].length : undefined;
  },
  tokenizer(src) {
    const m = /^#([A-Za-z][\w/-]*)/.exec(src);
    if (!m) return undefined;
    return { type: 'hashtag', raw: m[0], tag: m[1].toLowerCase() };
  },
  renderer(token) {
    const tag = escapeHtml(String(token.tag));
    return `<span class="tag-pill" data-tag="${tag}">#${tag}</span>`;
  },
};

const md = new Marked({ breaks: true, gfm: true });
md.use({ extensions: [wikilink, hashtag] });

let hooked = false;
function purifier() {
  if (!hooked) {
    // External links open in the system browser (see the global link handler); never inside the app.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('href') && !node.classList.contains('wikilink')) {
        node.setAttribute('rel', 'noopener noreferrer');
        node.setAttribute('target', '_blank');
      }
    });
    hooked = true;
  }
  return DOMPurify;
}

export function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    const html = md.parse(text, { async: false }) as string;
    return purifier().sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
      ADD_ATTR: ['target'],
    });
  } catch {
    return escapeHtml(text);
  }
}
