import { Decoration } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

import type { DecorationSet, EditorView, PluginValue, ViewUpdate } from '@codemirror/view';
import type { Range } from '@codemirror/state';

const tokenElement = [
  'InlineCode',
  'Emphasis',
  'StrongEmphasis',
  'Strikethrough',
  'FencedCode',
  'Link',
  'Wikilink',
];

const tokenHidden = [
  'HardBreak',
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'CodeInfo',
  'WikilinkMark',
];

// Only inside [text](url) / ![alt](url); autolinks <url> and [ref]: url definitions keep their URL visible.
const hiddenInLink = ['LinkMark', 'URL', 'LinkTitle'];

const decorationHidden = Decoration.mark({ class: 'cm-markdoc-hidden' });
const decorationBullet = Decoration.mark({ class: 'cm-markdoc-bullet' });
const decorationInlineCode = Decoration.mark({ class: 'cm-markdoc-inline-code' });
const decorationWikilink = Decoration.mark({ class: 'cm-wikilink-chip' });
const decorationTag = Decoration.mark({ class: 'cm-markdoc-tag' });

// Line decorations: a mark spanning several lines is split per line, so a fence would render as separate boxes.
function codeBlockLine(first: boolean, last: boolean) {
  const cls = ['cm-markdoc-codeblock', first && 'cm-markdoc-codeblock-first', last && 'cm-markdoc-codeblock-last'];
  return Decoration.line({ class: cls.filter(Boolean).join(' ') });
}

export class RichEditPlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.process(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet)
      this.decorations = this.process(update.view);
  }

  process(view: EditorView): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    const [cursor] = view.state.selection.ranges;
    const { doc } = view.state;
    const codeLines = new Set<number>();

    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from, to,
        enter(node) {
          if (node.name === 'MarkdocTag')
            widgets.push(decorationTag.range(node.from, node.to));

          if (node.name === 'FencedCode') {
            const first = doc.lineAt(node.from).number;
            const last = doc.lineAt(node.to).number;
            for (let n = first; n <= last; n++) {
              if (codeLines.has(n)) continue;
              codeLines.add(n);
              widgets.push(codeBlockLine(n === first, n === last).range(doc.line(n).from));
            }
          }

          if (node.name === 'InlineCode')
            widgets.push(decorationInlineCode.range(node.from, node.to));

          if ((node.name.startsWith('ATXHeading') || tokenElement.includes(node.name)) &&
            cursor.from >= node.from && cursor.to <= node.to)
            return false;

          // Brackets are drawn by the chip style while the cursor is outside the link.
          if (node.name === 'Wikilink' && node.to - node.from > 4)
            widgets.push(decorationWikilink.range(node.from + 2, node.to - 2));

          if (hiddenInLink.includes(node.name) && ['Link', 'Image'].includes(node.node.parent?.name ?? ''))
            widgets.push(decorationHidden.range(node.from, node.to));

          if (node.name === 'ListMark' && node.matchContext(['BulletList', 'ListItem']) &&
            cursor.from != node.from && cursor.from != node.from + 1)
            widgets.push(decorationBullet.range(node.from, node.to));

          if (node.name === 'HeaderMark')
            widgets.push(decorationHidden.range(node.from, node.to + 1));

          if (tokenHidden.includes(node.name))
            widgets.push(decorationHidden.range(node.from, node.to));
        }
      });
    }

    return Decoration.set(widgets, true);
  }
}

export default RichEditPlugin;
