import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSet, StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import markdoc from '@markdoc/markdoc';
import DOMPurify from 'dompurify';

import type { Config } from '@markdoc/markdoc';
import type { DecorationSet } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

const patternTag = /{%\s*(?<closing>\/)?(?<tag>[a-zA-Z0-9-_]+)(?<attrs>\s+[^]+)?\s*(?<self>\/)?%}\s*$/m;

// Rendered HTML by source: blocks are rebuilt on every transaction, re-rendering them all made typing slow.
const renderCache = new Map<string, string>();
const CACHE_LIMIT = 300;

function renderSource(source: string, config: Config): string {
  const cached = renderCache.get(source);
  if (cached !== undefined) return cached;
  const transformed = markdoc.transform(markdoc.parse(source), config);
  const html = DOMPurify.sanitize(markdoc.renderers.html(transformed));
  if (renderCache.size >= CACHE_LIMIT) renderCache.delete(renderCache.keys().next().value!);
  renderCache.set(source, html);
  return html;
}

class RenderBlockWidget extends WidgetType {
  rendered: string;

  constructor(public source: string, config: Config) {
    super();
    this.rendered = renderSource(source, config);
  }

  eq(widget: RenderBlockWidget): boolean {
    return widget.source === this.source;
  }

  toDOM(): HTMLElement {
    const content = document.createElement('div');
    content.setAttribute('contenteditable', 'false');
    content.className = 'cm-markdoc-renderBlock';
    content.innerHTML = this.rendered;
    return content;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function replaceBlocks(state: EditorState, config: Config, from?: number, to?: number) {
  const decorations: Range<Decoration>[] = [];
  const [cursor] = state.selection.ranges;

  const tags: [number, number][] = [];
  const stack: number[] = [];

  syntaxTree(state).iterate({
    from, to,
    enter(node) {
      if (!['Table', 'Blockquote', 'MarkdocTag'].includes(node.name))
        return;

      if (node.name === 'MarkdocTag') {
        const text = state.doc.sliceString(node.from, node.to);
        const match = text.match(patternTag);

        if (match?.groups?.self) {
          tags.push([node.from, node.to]);
          return;
        }

        if (match?.groups?.closing) {
          const last = stack.pop();
          if (last) tags.push([last, node.to]);
          return;
        }

        stack.push(node.from);
        return;
      }

      if (cursor.from >= node.from && cursor.to <= node.to)
        return false;

      const text = state.doc.sliceString(node.from, node.to);
      const decoration = Decoration.replace({
        widget: new RenderBlockWidget(text, config),
        block: true,
      });

      decorations.push(decoration.range(node.from, node.to));
    }
  });

  for (const [tagFrom, tagTo] of tags) {
    if (cursor.from >= tagFrom && cursor.to <= tagTo) continue;
    const text = state.doc.sliceString(tagFrom, tagTo);
    const decoration = Decoration.replace({
      widget: new RenderBlockWidget(text, config),
      block: true,
    });

    decorations.push(decoration.range(tagFrom, tagTo));
  }

  return decorations;
}

export function renderBlock(config: Config) {
  return StateField.define<DecorationSet>({
    create(state) {
      return RangeSet.of(replaceBlocks(state, config), true);
    },

    update(decorations, transaction) {
      if (!transaction.docChanged && !transaction.selection) return decorations;
      return RangeSet.of(replaceBlocks(transaction.state, config), true);
    },

    provide(field) {
      return EditorView.decorations.from(field);
    },
  });
}

export default renderBlock;
