import type { EditorView } from '@codemirror/view';
import { isInTable, tableCommands } from './table';
import type { SlashIcon } from './slashIcons';

export type SlashCommand = {
  id: string;
  label: string;
  group: string;
  icon: SlashIcon;
  keywords?: string;
  /** Text to insert; the cursor goes to `cursor` (default: end) and selects `select` characters. */
  insert?: string;
  cursor?: number;
  select?: number;
  /** Multi-line blocks are put on their own line when the current line has other text. */
  block?: boolean;
  /** Rewrites the current line's text instead, e.g. "Intro /h1" -> "# Intro". */
  convert?: (text: string) => string;
  /** Runs after the slash text is removed; shown only when `when` allows it. */
  run?: (view: EditorView) => boolean;
  when?: (view: EditorView) => boolean;
};

const prefix = (p: string) => (text: string) => p + text;

const MERMAID = 'flowchart TD\n  A[Start] --> B[End]';
const TABLE = '| Column 1 | Column 2 |\n| -------- | -------- |\n|          |          |';

export const slashCommands: SlashCommand[] = [
  { id: 'h1', label: 'Heading 1', group: 'Text', icon: 'Heading1', keywords: 'title', insert: '# ', convert: prefix('# ') },
  { id: 'h2', label: 'Heading 2', group: 'Text', icon: 'Heading2', keywords: 'subtitle', insert: '## ', convert: prefix('## ') },
  { id: 'h3', label: 'Heading 3', group: 'Text', icon: 'Heading3', insert: '### ', convert: prefix('### ') },
  { id: 'quote', label: 'Quote', group: 'Text', icon: 'Quote', keywords: 'blockquote', insert: '> ', convert: prefix('> ') },
  { id: 'bullet', label: 'Bullet list', group: 'Lists', icon: 'List', keywords: 'ul unordered', insert: '- ', convert: prefix('- ') },
  { id: 'numbered', label: 'Numbered list', group: 'Lists', icon: 'ListOrdered', keywords: 'ol ordered', insert: '1. ', convert: prefix('1. ') },
  { id: 'task', label: 'Task list', group: 'Lists', icon: 'ListChecks', keywords: 'todo checkbox', insert: '- [ ] ', convert: prefix('- [ ] ') },
  { id: 'code', label: 'Code block', group: 'Blocks', icon: 'Code', keywords: 'fence snippet', insert: '```\n\n```', cursor: 3, block: true },
  { id: 'table', label: 'Table', group: 'Blocks', icon: 'Table', keywords: 'grid', insert: TABLE, cursor: 2, select: 8, block: true },
  { id: 'math', label: 'Math block', group: 'Blocks', icon: 'Sigma', keywords: 'latex equation formula katex', insert: '$$\n\n$$', cursor: 3, block: true },
  { id: 'mermaid', label: 'Mermaid diagram', group: 'Blocks', icon: 'Workflow', keywords: 'flowchart chart graph sequence', insert: '```mermaid\n' + MERMAID + '\n```', cursor: 11, select: MERMAID.length, block: true },
  { id: 'divider', label: 'Divider', group: 'Blocks', icon: 'Minus', keywords: 'hr rule line separator', insert: '---\n', block: true },
  { id: 'inline-math', label: 'Inline math', group: 'Inline', icon: 'Sigma', keywords: 'latex equation formula', insert: '$x$', cursor: 1, select: 1 },
  { id: 'bold', label: 'Bold', group: 'Inline', icon: 'Bold', keywords: 'strong', insert: '**bold**', cursor: 2, select: 4 },
  { id: 'italic', label: 'Italic', group: 'Inline', icon: 'Italic', keywords: 'emphasis', insert: '*italic*', cursor: 1, select: 6 },
  { id: 'strike', label: 'Strikethrough', group: 'Inline', icon: 'Strikethrough', keywords: 'delete', insert: '~~text~~', cursor: 2, select: 4 },
  { id: 'inline-code', label: 'Inline code', group: 'Inline', icon: 'CodeXml', insert: '`code`', cursor: 1, select: 4 },
  { id: 'link', label: 'Link', group: 'Inline', icon: 'Link', keywords: 'url href', insert: '[text](https://)', cursor: 1, select: 4 },
  { id: 'node-link', label: 'Link to node or page', group: 'Inline', icon: 'Link2', keywords: 'wikilink reference', insert: '[[' },
];

const inTable = (view: EditorView) => isInTable(view);
const tableAction = (id: string, label: string, icon: SlashIcon, run: (view: EditorView) => boolean, keywords = ''): SlashCommand =>
  ({ id, label, group: 'Table', icon, keywords: `table ${keywords}`, run, when: inTable });

export const tableSlashCommands: SlashCommand[] = [
  tableAction('row-add', 'Add row', 'Rows3', tableCommands.insertRow, 'insert'),
  tableAction('col-add', 'Add column', 'Columns3', tableCommands.insertColumn, 'insert'),
  tableAction('row-delete', 'Delete row', 'Trash2', tableCommands.deleteRow, 'remove'),
  tableAction('col-delete', 'Delete column', 'Trash2', tableCommands.deleteColumn, 'remove'),
  tableAction('align-left', 'Align column left', 'AlignLeft', tableCommands.alignLeft),
  tableAction('align-center', 'Align column center', 'AlignCenter', tableCommands.alignCenter),
  tableAction('align-right', 'Align column right', 'AlignRight', tableCommands.alignRight),
  tableAction('table-format', 'Format table', 'WandSparkles', tableCommands.format, 'tidy align'),
];

const allCommands = [...tableSlashCommands, ...slashCommands];

export function filterSlashCommands(view: EditorView, query: string): SlashCommand[] {
  const q = query.toLowerCase();
  const available = allCommands.filter((c) => !c.when || c.when(view));
  if (!q) return available;
  const matches = available.filter((c) => `${c.id} ${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  const starts = (c: SlashCommand) => Number(c.label.toLowerCase().startsWith(q) || c.id.startsWith(q));
  return matches.sort((a, b) => starts(b) - starts(a));
}

const LINE_PREFIX = /^(\s*)(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;

/** Replaces the `/query` text between `from` and `to` with the command. */
export function applySlashCommand(view: EditorView, cmd: SlashCommand, from: number, to: number) {
  const { state } = view;
  const line = state.doc.lineAt(from);

  if (cmd.run) {
    view.dispatch({ changes: { from, to }, selection: { anchor: from } });
    cmd.run(view);
    return;
  }

  const before = state.sliceDoc(line.from, from);
  const after = state.sliceDoc(to, line.to);
  const rest = (before + after).trim();

  if (rest && cmd.convert) {
    const [, indent] = LINE_PREFIX.exec(before + after)!;
    const text = indent + cmd.convert((before + after).replace(LINE_PREFIX, '').trim());
    view.dispatch({ changes: { from: line.from, to: line.to, insert: text }, selection: { anchor: line.from + text.length } });
    return;
  }

  let insert = cmd.insert ?? '';
  let offset = 0;
  if (cmd.block) {
    if (before.trim()) {
      insert = '\n' + insert;
      offset = 1;
    }
    if (after.trim() && !insert.endsWith('\n')) insert += '\n';
  }
  const anchor = from + offset + (cmd.cursor ?? insert.length - offset);
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor, head: anchor + (cmd.select ?? 0) },
    scrollIntoView: true,
    userEvent: 'input.complete',
  });
}
