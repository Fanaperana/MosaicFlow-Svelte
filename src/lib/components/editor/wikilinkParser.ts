import { tags as t } from '@lezer/highlight';
import type { MarkdownConfig } from '@lezer/markdown';

const BRACKET_OPEN = 91; // [
const BRACKET_CLOSE = 93; // ]
const NEWLINE = 10;

// [[Target]] / [[Page#Title]] / [[id|alias]] as one node; without it the Markdown link parser claims the inner [..].
export const wikilinkParser: MarkdownConfig = {
  defineNodes: [
    { name: 'Wikilink', style: t.link },
    { name: 'WikilinkMark', style: t.processingInstruction },
  ],
  parseInline: [{
    name: 'Wikilink',
    before: 'Link',
    parse(cx, next, pos) {
      if (next !== BRACKET_OPEN || cx.char(pos + 1) !== BRACKET_OPEN) return -1;
      for (let i = pos + 2; i < cx.end - 1; i++) {
        const ch = cx.char(i);
        if (ch === NEWLINE || ch === BRACKET_OPEN) return -1;
        if (ch === BRACKET_CLOSE) {
          if (cx.char(i + 1) !== BRACKET_CLOSE || i === pos + 2) return -1;
          const end = i + 2;
          return cx.addElement(cx.elt('Wikilink', pos, end, [
            cx.elt('WikilinkMark', pos, pos + 2),
            cx.elt('WikilinkMark', end - 2, end),
          ]));
        }
      }
      return -1;
    },
  }],
};

export default wikilinkParser;
