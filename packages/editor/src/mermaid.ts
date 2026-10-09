import DOMPurify from 'dompurify';
import './rich.css';

type Mermaid = typeof import('mermaid').default;

let loading: Promise<Mermaid> | null = null;
let counter = 0;
const cache = new Map<string, Promise<string>>();
const CACHE_LIMIT = 50;

function loadMermaid(): Promise<Mermaid> {
  loading ??= import('mermaid').then(({ default: m }) => {
    m.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'strict',
    });
    return m;
  });
  return loading;
}

function toSvg(source: string): Promise<string> {
  let svg = cache.get(source);
  if (!svg) {
    const id = `mf-mermaid-${++counter}`;
    svg = loadMermaid().then(async (m) => {
      try {
        return (await m.render(id, source)).svg;
      } finally {
        // A failed render leaves its scratch element in <body>.
        document.getElementById(id)?.remove();
        document.getElementById(`d${id}`)?.remove();
      }
    });
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(source, svg);
  }
  return svg;
}

/** Renders a Mermaid diagram into `el`; `onDone` fires once the (async) result is in the DOM. */
export function renderMermaid(el: HTMLElement, source: string, onDone?: () => void) {
  el.classList.add('mf-mermaid');
  el.textContent = 'Rendering diagram…';
  toSvg(source.trim())
    .then((svg) => {
      // Mermaid sanitizes labels in strict mode; this also guards the SVG wrapper itself.
      const clean = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true, html: true },
        ADD_TAGS: ['foreignObject', 'style'],
        // Node labels are HTML inside <foreignObject>.
        HTML_INTEGRATION_POINTS: { foreignobject: true },
        RETURN_DOM_FRAGMENT: true,
      });
      el.replaceChildren(clean);
    })
    .catch((err: unknown) => {
      const msg = document.createElement('div');
      msg.className = 'mf-mermaid-error';
      msg.textContent = `Diagram error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`;
      el.replaceChildren(msg);
    })
    .finally(() => onDone?.());
}
