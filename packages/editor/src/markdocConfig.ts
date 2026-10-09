import markdoc from '@markdoc/markdoc';
import type { Config } from '@markdoc/markdoc';

// Allow fallback rendering for unknown tags
markdoc.transformer.findSchema = (node, config) => {
  return node.tag ?
    config?.tags?.[node.tag] ?? config?.tags?.$$fallback :
    config?.nodes?.[node.type];
};

export const markdocConfig: Config = {
  tags: {
    $$fallback: {
      transform(node, config) {
        const children = node.transformChildren(config);
        const className = 'cm-markdoc-fallbackTag';
        return new markdoc.Tag('div', { class: className }, [
          new markdoc.Tag('div', { class: `${className}--name` }, [node?.tag ?? '']),
          new markdoc.Tag('div', { class: `${className}--inner` }, children)
        ]);
      }
    },
    callout: {
      transform(node, config) {
        const children = node.transformChildren(config);
        const kind = node.attributes.type === 'warning' ? 'warning' : 'info';
        const className = `cm-markdoc-callout cm-markdoc-callout--${kind}`;
        return new markdoc.Tag('div', { class: className }, [
          new markdoc.Tag('div', {}, children)
        ]);
      }
    },
    note: {
      transform(node, config) {
        const children = node.transformChildren(config);
        return new markdoc.Tag('div', { class: 'cm-markdoc-note' }, [
          new markdoc.Tag('div', {}, children)
        ]);
      }
    }
  }
};

export default markdocConfig;
