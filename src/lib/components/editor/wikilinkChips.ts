// Shows [[node-id]] links as the node's title while editing (the raw id comes back when the cursor enters it).

import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { wikilinkLabel } from '$lib/services/navigation';

const ID_LINK = /\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\|([^[\]\n]+?))?\]\]/gi;

class LinkChip extends WidgetType {
  constructor(readonly label: string, readonly broken: boolean) {
    super();
  }
  eq(other: LinkChip) {
    return other.label === this.label && other.broken === this.broken;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = this.broken ? 'cm-wikilink-chip broken' : 'cm-wikilink-chip';
    el.textContent = this.label;
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const head = view.state.selection.main.head;
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    for (const m of text.matchAll(ID_LINK)) {
      const start = from + m.index!;
      const end = start + m[0].length;
      if (view.hasFocus && head > start && head < end) continue;
      const resolved = wikilinkLabel(m[1]);
      const label = m[2]?.trim() || resolved?.label || m[1];
      builder.add(start, end, Decoration.replace({ widget: new LinkChip(label, !!resolved?.broken) }));
    }
  }
  return builder.finish();
}

export const wikilinkChips = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);
