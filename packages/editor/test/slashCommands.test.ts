import { describe, expect, it } from 'vitest';
import { EditorState, EditorSelection, Transaction, type TransactionSpec } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import type { EditorView } from '@codemirror/view';
import { applySlashCommand, filterSlashCommands, slashCommands, tableSlashCommands } from '../src/slashCommands';

function makeView(doc: string, cursor = doc.length) {
  const view = {
    state: EditorState.create({ doc, selection: EditorSelection.single(cursor), extensions: [markdown({ extensions: [Table] })] }),
    dispatch(spec: Transaction | TransactionSpec) {
      view.state = spec instanceof Transaction ? spec.state : view.state.update(spec).state;
    },
  };
  return view as unknown as EditorView & { state: EditorState };
}

const cmd = (id: string) => [...slashCommands, ...tableSlashCommands].find((c) => c.id === id)!;

/** Types `/query` at the end of `doc` and applies the command. */
function run(doc: string, id: string, query = id) {
  const text = `${doc}/${query}`;
  const v = makeView(text);
  applySlashCommand(v, cmd(id), doc.length, text.length);
  const { from, to } = v.state.selection.main;
  return { doc: v.state.doc.toString(), selected: v.state.sliceDoc(from, to), head: v.state.selection.main.head };
}

describe('slash commands', () => {
  it('inserts a heading on an empty line', () => {
    expect(run('', 'h2').doc).toBe('## ');
  });

  it('converts the existing line text', () => {
    expect(run('Intro ', 'h1').doc).toBe('# Intro');
    expect(run('- item ', 'task').doc).toBe('- [ ] item');
    expect(run('  ## Title ', 'quote').doc).toBe('  > Title');
  });

  it('puts blocks on their own line', () => {
    expect(run('Some text ', 'divider').doc).toBe('Some text \n---\n');
  });

  it('selects the placeholder in a new table', () => {
    const r = run('', 'table');
    expect(r.doc.split('\n')).toHaveLength(3);
    expect(r.selected).toBe('Column 1');
  });

  it('places the cursor inside a math block', () => {
    const r = run('', 'math');
    expect(r.doc).toBe('$$\n\n$$');
    expect(r.head).toBe(3);
  });

  it('selects the sample mermaid diagram', () => {
    expect(run('', 'mermaid').selected).toBe('flowchart TD\n  A[Start] --> B[End]');
  });

  it('wraps inline commands without converting the line', () => {
    const r = run('Energy is ', 'inline-math');
    expect(r.doc).toBe('Energy is $x$');
    expect(r.selected).toBe('x');
  });

  it('filters by label and keywords, prefix matches first', () => {
    const v = makeView('');
    expect(filterSlashCommands(v, 'latex').map((c) => c.id)).toContain('math');
    expect(filterSlashCommands(v, 'tab')[0].id).toBe('table');
    expect(filterSlashCommands(v, 'chart')[0].id).toBe('mermaid');
    expect(filterSlashCommands(v, 'zzz')).toEqual([]);
  });

  it('offers table actions only inside a table', () => {
    expect(filterSlashCommands(makeView('text'), 'row').map((c) => c.id)).not.toContain('row-add');
    const doc = '| a | b |\n| - | - |\n| 1 | 2 |';
    expect(filterSlashCommands(makeView(doc, 2), 'row').map((c) => c.id)).toContain('row-add');
  });

  it('runs table actions after removing the slash text', () => {
    const doc = '| a | b |\n| --- | --- |\n| 1 | /col |';
    const v = makeView(doc, doc.length - 2);
    applySlashCommand(v, cmd('col-add'), doc.indexOf('/col'), doc.length - 2);
    expect(v.state.doc.toString()).not.toContain('/col');
    expect(v.state.doc.line(1).text.split('|').length - 2).toBe(3);
  });
});
