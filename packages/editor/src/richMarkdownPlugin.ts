import { ViewPlugin } from '@codemirror/view';
import { syntaxHighlighting, LanguageDescription } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import type { MarkdownExtension } from '@lezer/markdown';

import { tagParser } from './tagParser';
import { highlightStyle } from './highlightStyle';
import { RichEditPlugin } from './richEdit';
import { renderBlock } from './renderBlock';

import type { Config } from '@markdoc/markdoc';

export type MarkdocPluginConfig = { 
  extensions?: MarkdownExtension[];
  markdoc: Config;
  codeLanguages?: readonly LanguageDescription[];
};

export function richMarkdownPlugin(config: MarkdocPluginConfig) {
  const allExtensions = [tagParser, ...(config.extensions ?? [])];

  return ViewPlugin.fromClass(RichEditPlugin, {
    decorations: v => v.decorations,
    provide: () => [
      renderBlock(config.markdoc),
      syntaxHighlighting(highlightStyle),
      markdown({ 
        codeLanguages: config.codeLanguages,
        extensions: allExtensions
      })
    ],
    eventHandlers: {
      mousedown({ target }, view) {
        if (target instanceof Element && target.matches('.cm-markdoc-renderBlock *'))
          view.dispatch({ selection: { anchor: view.posAtDOM(target) } });
      }
    }
  });
}

export default richMarkdownPlugin;
