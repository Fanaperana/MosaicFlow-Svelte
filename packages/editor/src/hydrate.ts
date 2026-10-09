import { renderMath } from './math';
import { renderMermaid } from './mermaid';

const MATH_LANGS = ['math', 'latex', 'tex'];

/** Turns math placeholders and ```mermaid / ```math code blocks in rendered markdown into formulas and diagrams. */
export function hydrateRichContent(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-tex]')) {
    const tex = el.dataset.tex ?? '';
    delete el.dataset.tex;
    renderMath(el, tex, el.tagName === 'DIV');
  }
  for (const code of root.querySelectorAll<HTMLElement>('pre > code[class*="language-"]')) {
    const lang = /language-(\S+)/.exec(code.className)?.[1].toLowerCase() ?? '';
    if (lang !== 'mermaid' && !MATH_LANGS.includes(lang)) continue;
    const el = document.createElement('div');
    code.parentElement!.replaceWith(el);
    if (lang === 'mermaid') renderMermaid(el, code.textContent ?? '');
    else renderMath(el, code.textContent ?? '', true);
  }
}

/** Svelte action that shows already-sanitized HTML with math and diagrams rendered: `<div use:richContent={html}></div>` */
export function richContent(node: HTMLElement, html: string) {
  const set = (value: string) => {
    node.innerHTML = value;
    hydrateRichContent(node);
  };
  set(html);
  return { update: set };
}
