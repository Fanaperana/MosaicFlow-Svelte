import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Table } from '@lezer/markdown';
import { mathParser } from '../src/mathParser';

function nodes(doc: string, name: string) {
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: [Table, mathParser] })] });
  const found: string[] = [];
  ensureSyntaxTree(state, state.doc.length, 5000)!.iterate({
    enter(n) {
      if (n.name === name) found.push(state.sliceDoc(n.from, n.to));
    },
  });
  return found;
}

describe('inline math', () => {
  it('parses $...$', () => {
    expect(nodes('Euler: $e^{i\\pi} + 1 = 0$ done', 'InlineMath')).toEqual(['$e^{i\\pi} + 1 = 0$']);
  });

  it('keeps prices as text', () => {
    expect(nodes('It costs $5 and $10 today', 'InlineMath')).toEqual([]);
    expect(nodes('From $5 to $ 10', 'InlineMath')).toEqual([]);
  });

  it('protects underscores from emphasis', () => {
    expect(nodes('$a_1 + b_1$ and _x_', 'InlineMath')).toEqual(['$a_1 + b_1$']);
    expect(nodes('$a_1 + b_1$ and _x_', 'Emphasis')).toEqual(['_x_']);
  });

  it('allows escaped dollars inside', () => {
    expect(nodes('$\\$5$', 'InlineMath')).toEqual(['$\\$5$']);
  });

  it('is ignored inside inline code', () => {
    expect(nodes('`$x$`', 'InlineMath')).toEqual([]);
  });
});

describe('block math', () => {
  it('parses a multi-line $$ block', () => {
    expect(nodes('before\n\n$$\na^2 + b^2\n$$\n\nafter', 'BlockMath')).toEqual(['$$\na^2 + b^2\n$$']);
  });

  it('parses a single-line $$ block', () => {
    expect(nodes('$$x = 1$$', 'BlockMath')).toEqual(['$$x = 1$$']);
  });

  it('runs an unclosed block to the end', () => {
    expect(nodes('$$\nx\ny', 'BlockMath')).toEqual(['$$\nx\ny']);
  });

  it('is ignored inside fenced code', () => {
    expect(nodes('```\n$$\nx\n$$\n```', 'BlockMath')).toEqual([]);
  });
});
