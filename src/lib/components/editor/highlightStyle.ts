import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const highlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1.75em', textDecoration: 'none' },
  { tag: t.heading2, fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1.5em', textDecoration: 'none' },
  { tag: t.heading3, fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1.25em', textDecoration: 'none' },
  { tag: t.heading4, fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1.1em', textDecoration: 'none' },
  { tag: t.link, fontFamily: 'inherit', textDecoration: 'underline', color: '#60a5fa' },
  { tag: t.emphasis, fontFamily: 'inherit', fontStyle: 'italic' },
  { tag: t.strong, fontFamily: 'inherit', fontWeight: 'bold' },
  { tag: t.monospace, fontFamily: 'ui-monospace, monospace', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.1em 0.3em', borderRadius: '3px' },
  { tag: t.content, fontFamily: 'inherit' },
  { tag: t.meta, color: '#6b7280' },
  { tag: t.url, color: '#6b7280', textDecoration: 'none' },
]);

export default highlightStyle;
