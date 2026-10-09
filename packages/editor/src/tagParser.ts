import { tags as t } from '@lezer/highlight';
import type { MarkdownConfig } from '@lezer/markdown';

export const tagParser: MarkdownConfig = {
  defineNodes: [
    { name: 'MarkdocTag', block: true, style: t.meta }
  ],
  parseBlock: [{
    name: 'MarkdocTag',
    endLeaf(_cx, line, _leaf) {
      return line.next == 123 && line.text.slice(line.pos).trim().startsWith('{%');
    },
    parse(cx, line) {
      if (line.next != 123) return false;

      const content = line.text.slice(line.pos).trim();
      if (!content.startsWith('{%') || !content.endsWith('%}')) return false;

      cx.addElement(cx.elt('MarkdocTag', cx.lineStart, cx.lineStart + line.text.length));
      cx.nextLine();
      return true;
    },
  }]
};

export default tagParser;
