import { describe, expect, it } from 'vitest';
import { EditorState, EditorSelection, Transaction, type TransactionSpec } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import type { EditorView } from '@codemirror/view';
import { tableCommands } from '../src/table';
import { undo, history } from '@codemirror/commands';

// The commands only use state + dispatch, so a stub avoids needing a DOM.
function makeView(doc: string, cursor = doc.indexOf('|') + 1) {
  const view = {
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(cursor),
      extensions: [markdown({ extensions: [Table] }), history()],
    }),
    dispatch(spec: Transaction | TransactionSpec) {
      view.state = spec instanceof Transaction ? spec.state : view.state.update(spec).state;
    },
  };
  return view as unknown as EditorView & { state: EditorState };
}

const head = (v: EditorView) => v.state.selection.main.head;

describe('table editing', () => {
  it('aligns the table and moves to the next cell on Tab', () => {
    const v = makeView('| a | bbbb |\n|-|-|\n| ccc | d |', 2);
    expect(tableCommands.nextCell(v)).toBe(true);
    expect(v.state.doc.toString()).toBe('| a   | bbbb |\n| --- | ---- |\n| ccc | d    |');
    expect(v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to)).toBe('bbbb');
  });

  it('completes a header-only line into a table', () => {
    const v = makeView('| name | age', 3);
    tableCommands.nextCell(v);
    expect(v.state.doc.toString()).toBe('| name | age |\n| ---- | --- |');
  });

  it('adds a row when pressing Enter on the last row', () => {
    const doc = '| a | b |\n| --- | --- |\n| 1 | 2 |';
    const v = makeView(doc, doc.lastIndexOf('1'));
    tableCommands.nextRow(v);
    expect(v.state.doc.lines).toBe(4);
    expect(v.state.doc.line(4).text).toMatch(/^\|\s+\|\s+\|$/);
  });

  it('is a single undo step', () => {
    const doc = '| a | bbbb |\n|-|-|\n| ccc | d |';
    const v = makeView(doc, 2);
    tableCommands.nextCell(v);
    undo(v);
    expect(v.state.doc.toString()).toBe(doc);
  });

  it('ignores tables inside fenced code', () => {
    const v = makeView('```\n| a | b |\n```', 6);
    expect(tableCommands.nextCell(v)).toBe(false);
  });

  it('ignores lines that are not tables', () => {
    const v = makeView('just text', 3);
    expect(tableCommands.nextCell(v)).toBe(false);
    expect(tableCommands.nextRow(v)).toBe(false);
  });

  it('sets column alignment', () => {
    const v = makeView('| a | b |\n| --- | --- |\n| 1 | 2 |', 2);
    tableCommands.alignCenter(v);
    expect(v.state.doc.line(2).text).toBe('|:---:| --- |');
  });

  it('inserts and deletes columns', () => {
    const v = makeView('| a | b |\n| --- | --- |\n| 1 | 2 |', 2);
    tableCommands.insertColumn(v);
    expect(v.state.doc.line(1).text.split('|').length - 2).toBe(3);
    tableCommands.deleteColumn(v);
    expect(v.state.doc.line(1).text.split('|').length - 2).toBe(2);
  });

  it('moves rows', () => {
    const doc = '| a |\n| --- |\n| 1 |\n| 2 |';
    const v = makeView(doc, doc.indexOf('2'));
    tableCommands.moveRowUp(v);
    expect(v.state.doc.toString()).toBe('| a   |\n| --- |\n| 2   |\n| 1   |');
  });

  it('pads wide (CJK) characters by display width', () => {
    const v = makeView('| 日本 | a |\n|-|-|\n| x | y |', 2);
    tableCommands.format(v);
    expect(v.state.doc.line(3).text).toBe('| x    | y   |');
  });

  it('leaves the table with Mod-Enter', () => {
    const doc = '| a |\n| --- |\n| 1 |\nafter';
    const v = makeView(doc, 2);
    tableCommands.escape(v);
    expect(v.state.doc.lineAt(head(v)).text).toBe('after');
  });
});
