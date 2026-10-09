/// <reference path="./mte-kernel.d.ts" />
// Markdown table editing: Tab moves between cells and re-aligns the whole table as you type.
import { Prec, EditorSelection, ChangeSet, type EditorState, type Text } from '@codemirror/state';
import { keymap, type EditorView, type KeyBinding } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Alignment, TableEditor, options, type ITextEditor, type Point, type Range } from '@susisu/mte-kernel';

const tableOptions = options({ smartCursor: true });

const CODE_NODES = new Set(['FencedCode', 'CodeBlock', 'BlockMath']);

/**
 * Lets the kernel edit a working copy of the document so a whole command lands as one transaction
 * (one undo step) instead of one per line.
 */
class Adapter implements ITextEditor {
  private state!: EditorState;
  private doc!: Text;
  private changes!: ChangeSet;
  private selection: EditorSelection | null = null;
  // A document always has a line, so deleting the only one leaves a placeholder the next insert fills.
  private noLines = false;

  begin(state: EditorState) {
    this.state = state;
    this.doc = state.doc;
    this.changes = ChangeSet.empty(state.doc.length);
    this.selection = null;
    this.noLines = false;
  }

  flush(view: EditorView) {
    if (this.changes.empty && !this.selection) return;
    view.dispatch({
      changes: this.changes,
      selection: this.selection ?? this.state.selection.map(this.changes),
      scrollIntoView: true,
      userEvent: 'input.table',
    });
  }

  private pos({ row, column }: Point): number {
    const line = this.doc.line(Math.min(Math.max(row, 0), this.doc.lines - 1) + 1);
    return line.from + Math.min(Math.max(column, 0), line.length);
  }

  private change(from: number, to: number, insert: string) {
    const cs = ChangeSet.of({ from, to, insert }, this.doc.length);
    this.doc = cs.apply(this.doc);
    this.changes = this.changes.compose(cs);
    this.selection = this.selection?.map(cs) ?? null;
  }

  getCursorPosition(): Point {
    const head = this.selection?.main.head ?? this.state.selection.main.head;
    const pos = this.selection ? head : this.changes.mapPos(head);
    const line = this.doc.lineAt(pos);
    return { row: line.number - 1, column: pos - line.from };
  }

  setCursorPosition(point: Point) {
    this.selection = EditorSelection.single(this.pos(point));
  }

  setSelectionRange(range: Range) {
    this.selection = EditorSelection.single(this.pos(range.start), this.pos(range.end));
  }

  getLastRow() {
    return this.noLines ? -1 : this.doc.lines - 1;
  }

  // Only asked while locating the table, before any edit, so the original syntax tree still applies.
  acceptsTableEdit(row: number) {
    if (row < 0 || row >= this.state.doc.lines) return false;
    const first = syntaxTree(this.state).resolveInner(this.state.doc.line(row + 1).from, 1);
    for (let node: typeof first | null = first; node; node = node.parent) {
      if (CODE_NODES.has(node.name)) return false;
    }
    return true;
  }

  getLine(row: number) {
    return row < 0 || row > this.getLastRow() ? '' : this.doc.line(row + 1).text;
  }

  insertLine(row: number, text: string) {
    if (this.noLines) {
      this.noLines = false;
      this.change(0, this.doc.length, text);
    } else if (row > this.getLastRow()) this.change(this.doc.length, this.doc.length, `\n${text}`);
    else {
      const from = this.doc.line(Math.max(row, 0) + 1).from;
      this.change(from, from, `${text}\n`);
    }
  }

  deleteLine(row: number) {
    const last = this.getLastRow();
    if (row < 0 || row > last) return;
    const line = this.doc.line(row + 1);
    if (row < last) this.change(line.from, this.doc.line(row + 2).from, '');
    else if (row > 0) this.change(this.doc.line(row).to, line.to, '');
    else {
      this.change(line.from, line.to, '');
      this.noLines = true;
    }
  }

  replaceLines(startRow: number, endRow: number, lines: string[]) {
    if (this.noLines) {
      this.noLines = !lines.length;
      this.change(0, this.doc.length, lines.join('\n'));
      return;
    }
    const last = this.getLastRow();
    const from = startRow > last ? this.doc.length : this.doc.line(Math.max(startRow, 0) + 1).from;
    const toEnd = endRow > last;
    const to = toEnd ? this.doc.length : this.doc.line(Math.max(endRow, 0) + 1).from;
    this.change(from, to, lines.join('\n') + (!toEnd && lines.length ? '\n' : ''));
  }

  transact(fn: () => void) {
    fn();
  }
}

// One kernel per editor so the smart cursor remembers the column you started from.
const editors = new WeakMap<EditorView, { adapter: Adapter; editor: TableEditor }>();

function kernel(view: EditorView) {
  let entry = editors.get(view);
  if (!entry) {
    const adapter = new Adapter();
    entry = { adapter, editor: new TableEditor(adapter) };
    editors.set(view, entry);
  }
  entry.adapter.begin(view.state);
  return entry;
}

function run(command: (editor: TableEditor) => void, anywhere = false) {
  return (view: EditorView): boolean => {
    const { adapter, editor } = kernel(view);
    if (!view.state.selection.main.empty && !anywhere) return false;
    if (!anywhere && !editor.cursorIsInTable(tableOptions)) {
      editor.resetSmartCursor();
      return false;
    }
    command(editor);
    adapter.flush(view);
    return true;
  };
}

export const tableCommands = {
  nextCell: run((e) => e.nextCell(tableOptions)),
  previousCell: run((e) => e.previousCell(tableOptions)),
  nextRow: run((e) => e.nextRow(tableOptions)),
  escape: run((e) => e.escape(tableOptions)),
  format: run((e) => e.format(tableOptions)),
  formatAll: run((e) => e.formatAll(tableOptions), true),
  alignLeft: run((e) => e.alignColumn(Alignment.LEFT, tableOptions)),
  alignRight: run((e) => e.alignColumn(Alignment.RIGHT, tableOptions)),
  alignCenter: run((e) => e.alignColumn(Alignment.CENTER, tableOptions)),
  alignNone: run((e) => e.alignColumn(Alignment.NONE, tableOptions)),
  insertRow: run((e) => e.insertRow(tableOptions)),
  deleteRow: run((e) => e.deleteRow(tableOptions)),
  insertColumn: run((e) => e.insertColumn(tableOptions)),
  deleteColumn: run((e) => e.deleteColumn(tableOptions)),
  moveRowUp: run((e) => e.moveRow(-1, tableOptions)),
  moveRowDown: run((e) => e.moveRow(1, tableOptions)),
  moveColumnLeft: run((e) => e.moveColumn(-1, tableOptions)),
  moveColumnRight: run((e) => e.moveColumn(1, tableOptions)),
};

export function isInTable(view: EditorView): boolean {
  return kernel(view).editor.cursorIsInTable(tableOptions);
}

const bindings: KeyBinding[] = [
  { key: 'Tab', run: tableCommands.nextCell, shift: tableCommands.previousCell },
  { key: 'Enter', run: tableCommands.nextRow },
  { key: 'Mod-Enter', run: tableCommands.escape },
  { key: 'Mod-Shift-f', run: tableCommands.format },
  { key: 'Mod-Alt-Shift-f', run: tableCommands.formatAll },
  { key: 'Mod-Alt-ArrowLeft', run: tableCommands.alignLeft },
  { key: 'Mod-Alt-ArrowRight', run: tableCommands.alignRight },
  { key: 'Mod-Alt-ArrowUp', run: tableCommands.alignCenter },
  { key: 'Mod-Alt-ArrowDown', run: tableCommands.alignNone },
  { key: 'Alt-ArrowUp', run: tableCommands.moveRowUp },
  { key: 'Alt-ArrowDown', run: tableCommands.moveRowDown },
  { key: 'Alt-ArrowLeft', run: tableCommands.moveColumnLeft },
  { key: 'Alt-ArrowRight', run: tableCommands.moveColumnRight },
];

export const tableKeymap = Prec.high(keymap.of(bindings));
