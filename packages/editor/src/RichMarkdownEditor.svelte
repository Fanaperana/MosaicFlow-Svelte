<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorState, Prec } from '@codemirror/state';
  import { 
    EditorView, 
    drawSelection, 
    highlightActiveLine,
    keymap,
    placeholder as placeholderPlugin,
  } from '@codemirror/view';
  import { 
    defaultKeymap, 
    history, 
    historyKeymap, 
    indentWithTab 
  } from '@codemirror/commands';
  import { 
    defaultHighlightStyle, 
    syntaxHighlighting, 
    indentOnInput 
  } from '@codemirror/language';
  import { languages } from '@codemirror/language-data';
  import { Strikethrough, Table, TaskList } from '@lezer/markdown';

  import { richMarkdownPlugin } from './richMarkdownPlugin';
  import { markdocConfig } from './markdocConfig';
  import { wikilinkParser } from './wikilinkParser';
  import './richEditor.css';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { nodeRegistry, getIconByName } from '$lib/kernel/registries/node-registry';
  import { FileText } from 'lucide-svelte';
  import { wikilinkChips } from './wikilinkChips';

  interface Props {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    class?: string;
    autoFocus?: boolean;
  }

  let { 
    value = '', 
    onChange = () => {}, 
    placeholder = 'Write markdown here...',
    class: className = '',
    autoFocus = false,
  }: Props = $props();

  let editorContainer: HTMLDivElement;
  let view: EditorView | null = null;
  let isInternalChange = false;

  // ---- [[ link picker: browse vault nodes and insert a stable [[node-id]] link ----
  type PickItem = { kind: 'node' | 'page'; ref: string; title: string; detail: string; icon: typeof FileText };
  let picker = $state<{ from: number; query: string; x: number; y: number } | null>(null);
  let pickIndex = $state(0);

  let pickItems = $derived.by((): PickItem[] => {
    if (!picker) return [];
    const q = picker.query.trim();
    const current = vaultStore.currentCanvas?.id;
    const nodes = q
      ? knowledge.index.search(q, { limit: 30 }).map((h) => h.node)
      : [...knowledge.index.nodes]
          .filter((n) => n.title)
          .sort((a, b) => Number(b.canvasId === current) - Number(a.canvasId === current) || a.title.localeCompare(b.title))
          .slice(0, 30);
    const items: PickItem[] = nodes.map((n) => {
      const reg = nodeRegistry.get(n.type);
      return {
        kind: 'node',
        ref: n.id,
        title: n.title || 'Untitled',
        detail: `${reg?.label ?? n.type} · ${n.canvasName}`,
        icon: getIconByName(reg?.iconName ?? 'Box'),
      };
    });
    const ql = q.toLowerCase();
    const pages = vaultStore.canvases
      .filter((c) => !ql || c.name.toLowerCase().includes(ql))
      .slice(0, 5)
      .map((c): PickItem => ({ kind: 'page', ref: c.name, title: c.name, detail: 'Page', icon: FileText }));
    return [...items, ...pages];
  });

  function updatePicker(v: EditorView) {
    const sel = v.state.selection.main;
    if (!sel.empty || !v.hasFocus) return (picker = null);
    const line = v.state.doc.lineAt(sel.head);
    const m = /\[\[([^[\]|\n]*)$/.exec(line.text.slice(0, sel.head - line.from));
    if (!m) return (picker = null);
    const from = sel.head - m[0].length;
    const coords = v.coordsAtPos(sel.head);
    if (!coords) return (picker = null);
    if (!picker || picker.from !== from) pickIndex = 0;
    picker = { from, query: m[1], x: coords.left, y: coords.bottom + 4 };
  }

  function applyPick(item: PickItem | undefined) {
    if (!view || !picker || !item) return;
    const head = view.state.selection.main.head;
    const after = view.state.sliceDoc(head, head + 2);
    const to = after === ']]' ? head + 2 : head;
    const insert = `[[${item.ref}]]`;
    view.dispatch({ changes: { from: picker.from, to, insert }, selection: { anchor: picker.from + insert.length } });
    picker = null;
    view.focus();
  }

  function movePick(delta: number) {
    const n = pickItems.length;
    if (n) pickIndex = (pickIndex + delta + n) % n;
  }

  const pickerKeymap = Prec.highest(keymap.of([
    { key: 'ArrowDown', run: () => (picker && pickItems.length ? (movePick(1), true) : false) },
    { key: 'ArrowUp', run: () => (picker && pickItems.length ? (movePick(-1), true) : false) },
    { key: 'Enter', run: () => (picker && pickItems.length ? (applyPick(pickItems[pickIndex]), true) : false) },
    { key: 'Tab', run: () => (picker && pickItems.length ? (applyPick(pickItems[pickIndex]), true) : false) },
    { key: 'Escape', run: () => (picker ? ((picker = null), true) : false) },
  ]));

  /** Renders the picker on <body> so the canvas transform doesn't offset it. */
  function portal(el: HTMLElement) {
    document.body.appendChild(el);
    return { destroy: () => el.remove() };
  }

  function createEditor() {
    if (!editorContainer) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        isInternalChange = true;
        onChange(update.state.doc.toString());
        isInternalChange = false;
      }
      if (update.docChanged || update.selectionSet || update.focusChanged) updatePicker(update.view);
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        richMarkdownPlugin({
          markdoc: markdocConfig,
          codeLanguages: languages,
          extensions: [Table, TaskList, Strikethrough, wikilinkParser]
        }),
        EditorView.lineWrapping,
        history(),
        drawSelection(),
        highlightActiveLine(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        pickerKeymap,
        wikilinkChips,
        updateListener,
        placeholderPlugin(placeholder),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
          },
          '.cm-content': {
            fontFamily: 'inherit',
            padding: '8px 0',
            caretColor: '#fff',
          },
          '.cm-line': {
            padding: '0 4px',
          },
          '.cm-cursor': {
            borderLeftColor: '#fff',
          },
          '.cm-selectionBackground': {
            backgroundColor: 'rgba(59, 130, 246, 0.3) !important',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: 'rgba(59, 130, 246, 0.4) !important',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'inherit',
          },
          '.cm-gutters': {
            display: 'none',
          },
          '&.cm-focused': {
            outline: 'none',
          },
        }),
      ],
    });

    view = new EditorView({
      state,
      parent: editorContainer,
    });

    if (autoFocus) {
      view.focus();
    }
  }

  // Update editor content when value prop changes externally
  $effect(() => {
    // CodeMirror stores \n only; comparing raw CRLF text would rewrite the note just by opening it.
    const next = value.replace(/\r\n?/g, '\n');
    if (view && !isInternalChange) {
      const current = view.state.doc.toString();
      if (current !== next) {
        // Replace only the part that changed so the cursor and scroll position survive.
        let start = 0;
        while (start < current.length && start < next.length && current[start] === next[start]) start++;
        let endCur = current.length;
        let endNext = next.length;
        while (endCur > start && endNext > start && current[endCur - 1] === next[endNext - 1]) {
          endCur--;
          endNext--;
        }
        view.dispatch({ changes: { from: start, to: endCur, insert: next.slice(start, endNext) } });
      }
    }
  });

  onMount(() => {
    createEditor();
  });

  onDestroy(() => {
    if (view) {
      view.destroy();
      view = null;
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    // Stop propagation of all keyboard events to prevent canvas from handling them
    // This prevents Backspace/Delete from removing the node while editing
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  bind:this={editorContainer} 
  class="rich-markdown-editor nodrag nowheel {className}"
  onkeydown={handleKeyDown}
></div>

{#if picker}
  <div
    class="wl-picker"
    use:portal
    style="left: {Math.min(picker.x, window.innerWidth - 330)}px; top: {Math.min(picker.y, window.innerHeight - 300)}px"
    role="listbox"
    tabindex="-1"
    onmousedown={(e) => e.preventDefault()}
  >
    <div class="wl-head">Link to a node or page{picker.query ? ` · “${picker.query}”` : ''}</div>
    {#each pickItems as item, i (item.kind + item.ref)}
      <button
        class="wl-item"
        class:active={i === pickIndex}
        role="option"
        aria-selected={i === pickIndex}
        onmouseenter={() => (pickIndex = i)}
        onclick={() => applyPick(item)}
      >
        <item.icon size={14} />
        <span class="wl-title">{item.title}</span>
        <span class="wl-detail">{item.detail}</span>
      </button>
    {:else}
      <div class="wl-empty">No matching nodes</div>
    {/each}
  </div>
{/if}

<style>
  .rich-markdown-editor {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .wl-picker {
    position: fixed;
    z-index: 10000;
    width: 320px;
    max-height: 290px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--mf-border, #333);
    border-radius: 8px;
    background: var(--mf-surface, #1e1e1e);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    font-size: 12.5px;
  }

  .wl-head {
    padding: 4px 8px 6px;
    color: var(--mf-text-3, #888);
    font-size: 11px;
  }

  .wl-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-2, #ccc);
    text-align: left;
    cursor: pointer;
  }

  .wl-item.active {
    background: var(--mf-active, rgba(255, 255, 255, 0.08));
    color: var(--mf-text, #fff);
  }

  .wl-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wl-detail {
    flex-shrink: 0;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--mf-text-3, #888);
    font-size: 11px;
  }

  .wl-empty {
    padding: 8px;
    color: var(--mf-text-3, #888);
  }
</style>
