import { tags as t } from '@lezer/highlight';
import type { MarkdownConfig } from '@lezer/markdown';

const DOLLAR = 36;
const BACKSLASH = 92;
const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === -1;
const isDigit = (c: number) => c >= 48 && c <= 57;

// $x$ inline (pandoc rules so prices like "$5 and $10" stay text) and $$ ... $$ display blocks.
export const mathParser: MarkdownConfig = {
  defineNodes: [
    { name: 'InlineMath', style: t.special(t.string) },
    { name: 'InlineMathMark', style: t.processingInstruction },
    { name: 'BlockMath', block: true, style: t.special(t.string) },
  ],
  parseInline: [{
    name: 'InlineMath',
    before: 'Emphasis',
    parse(cx, next, pos) {
      if (next !== DOLLAR || cx.char(pos + 1) === DOLLAR || isSpace(cx.char(pos + 1))) return -1;
      for (let i = pos + 1; i < cx.end; i++) {
        const c = cx.char(i);
        if (c === BACKSLASH) i++;
        else if (c === DOLLAR && !isSpace(cx.char(i - 1)) && !isDigit(cx.char(i + 1))) {
          return cx.addElement(cx.elt('InlineMath', pos, i + 1, [
            cx.elt('InlineMathMark', pos, pos + 1),
            cx.elt('InlineMathMark', i, i + 1),
          ]));
        }
      }
      return -1;
    },
  }],
  parseBlock: [{
    name: 'BlockMath',
    before: 'FencedCode',
    parse(cx, line) {
      if (line.next !== DOLLAR || line.text.charCodeAt(line.pos + 1) !== DOLLAR) return false;
      const from = cx.lineStart + line.pos;
      const rest = line.text.slice(line.pos + 2);
      let to = cx.lineStart + line.text.length;
      const closedOnFirstLine = /\$\$\s*$/.test(rest) && rest.trim().length > 2;
      if (!closedOnFirstLine) {
        // Unclosed blocks run to the end of the document, like an unclosed code fence.
        while (cx.nextLine()) {
          to = cx.lineStart + line.text.length;
          if (/\$\$\s*$/.test(line.text)) break;
        }
      }
      cx.nextLine();
      cx.addElement(cx.elt('BlockMath', from, to));
      return true;
    },
  }],
};

export default mathParser;
