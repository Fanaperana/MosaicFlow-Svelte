// Renders math ($...$, $$...$$, ```math) and ```mermaid fences in place; the source shows while the cursor is inside.
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { RangeSet, StateField, type EditorState, type Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNodeRef } from '@lezer/common';
import { renderMath } from './math';
import { renderMermaid } from './mermaid';

type Kind = 'math' | 'mermaid';

class BlockWidget extends WidgetType {
  constructor(readonly kind: Kind, readonly source: string) {
    super();
  }
  eq(other: BlockWidget) {
    return other.kind === this.kind && other.source === this.source;
  }
  toDOM(view: EditorView) {
    const el = document.createElement('div');
    el.className = 'cm-rich-block';
    el.setAttribute('contenteditable', 'false');
    const measure = () => view.requestMeasure();
    if (this.kind === 'math') renderMath(el, this.source, true, measure);
    else renderMermaid(el, this.source, measure);
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

class InlineMathWidget extends WidgetType {
  constructor(readonly tex: string) {
    super();
  }
  eq(other: InlineMathWidget) {
    return other.tex === this.tex;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-rich-inline';
    renderMath(el, this.tex, false);
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

/** Language and body of a fenced code block, or null when it isn't closed yet. */
export function fenceParts(state: EditorState, node: SyntaxNodeRef): { lang: string; body: string } | null {
  const info = node.node.getChild('CodeInfo');
  const lang = info ? state.sliceDoc(info.from, info.to).trim().toLowerCase() : '';
  const first = state.doc.lineAt(node.from);
  const last = state.doc.lineAt(node.to);
  if (last.number === first.number || !/^\s*(`{3,}|~{3,})\s*$/.test(last.text)) return null;
  return { lang, body: state.sliceDoc(first.to + 1, last.from).replace(/\n$/, '') };
}

function blockSource(state: EditorState, node: SyntaxNodeRef): { kind: Kind; source: string } | null {
  if (node.name === 'BlockMath') {
    const text = state.sliceDoc(node.from, node.to).trim();
    if (!text.endsWith('$$') || text.length < 4) return null;
    const tex = text.slice(2, -2).trim();
    return tex ? { kind: 'math', source: tex } : null;
  }
  const fence = fenceParts(state, node);
  if (!fence?.body.trim()) return null;
  if (fence.lang === 'mermaid') return { kind: 'mermaid', source: fence.body };
  if (fence.lang === 'math' || fence.lang === 'latex' || fence.lang === 'tex') return { kind: 'math', source: fence.body };
  return null;
}

const CONTAINERS = new Set(['Document', 'Blockquote', 'BulletList', 'OrderedList', 'ListItem']);

function buildBlocks(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursor = state.selection.main;
  syntaxTree(state).iterate({
    enter(node) {
      if (CONTAINERS.has(node.name)) return;
      if (node.name !== 'BlockMath' && node.name !== 'FencedCode') return false;
      if (cursor.from <= node.to && cursor.to >= node.from) return false;
      const block = blockSource(state, node);
      if (block) {
        const from = state.doc.lineAt(node.from).from;
        const to = state.doc.lineAt(node.to).to;
        decorations.push(Decoration.replace({ widget: new BlockWidget(block.kind, block.source), block: true }).range(from, to));
      }
      return false;
    },
  });
  return RangeSet.of(decorations, true);
}

// Block widgets must come from a state field; view plugins may not replace line breaks.
const blockField = StateField.define<DecorationSet>({
  create: buildBlocks,
  update(value, tr) {
    if (!tr.docChanged && !tr.selection && syntaxTree(tr.state) === syntaxTree(tr.startState)) return value;
    return buildBlocks(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const sourceMark = Decoration.mark({ class: 'cm-math-source' });

const inlineMath = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged || syntaxTree(u.state) !== syntaxTree(u.startState))
        this.decorations = this.build(u.view);
    }
    build(view: EditorView) {
      const decorations: Range<Decoration>[] = [];
      const cursor = view.state.selection.main;
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from, to,
          enter(node) {
            if (node.name !== 'InlineMath') return;
            const editing = cursor.from <= node.to && cursor.to >= node.from;
            const tex = view.state.sliceDoc(node.from + 1, node.to - 1);
            decorations.push(editing
              ? sourceMark.range(node.from, node.to)
              : Decoration.replace({ widget: new InlineMathWidget(tex) }).range(node.from, node.to));
            return false;
          },
        });
      }
      return Decoration.set(decorations, true);
    }
  },
  { decorations: (v) => v.decorations },
);

export const richBlocks = [blockField, inlineMath];
