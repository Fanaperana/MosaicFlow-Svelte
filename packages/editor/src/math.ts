import 'katex/dist/katex.min.css';
import './rich.css';

type Katex = typeof import('katex').default;

let katex: Katex | null = null;
let loading: Promise<Katex> | null = null;

// KaTeX is large, so it loads the first time a formula is shown.
export function loadKatex(): Promise<Katex> {
  loading ??= import('katex').then((m) => (katex = m.default));
  return loading;
}

function render(k: Katex, el: HTMLElement, tex: string, display: boolean) {
  try {
    // trust stays false: \href, \url and \includegraphics are rendered as plain text.
    k.render(tex, el, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore' });
  } catch (err) {
    el.textContent = tex;
    el.classList.add('mf-math-error');
    el.title = err instanceof Error ? err.message : String(err);
  }
}

/** Renders TeX into `el`, synchronously once KaTeX has loaded. `onDone` fires when an async render lands. */
export function renderMath(el: HTMLElement, tex: string, display: boolean, onDone?: () => void) {
  el.classList.add('mf-math', display ? 'mf-math-display' : 'mf-math-inline');
  if (katex) return render(katex, el, tex, display);
  el.textContent = display ? tex : `$${tex}$`;
  loadKatex().then((k) => {
    render(k, el, tex, display);
    onDone?.();
  });
}
