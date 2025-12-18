<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorState } from '@codemirror/state';
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
  import { Table } from '@lezer/markdown';

  import { richMarkdownPlugin } from './richMarkdownPlugin';
  import { markdocConfig } from './markdocConfig';
  import './richEditor.css';

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

  function createEditor() {
    if (!editorContainer) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        isInternalChange = true;
        onChange(update.state.doc.toString());
        isInternalChange = false;
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        richMarkdownPlugin({
          markdoc: markdocConfig,
          codeLanguages: languages,
          extensions: [Table]
        }),
        EditorView.lineWrapping,
        history(),
        drawSelection(),
        highlightActiveLine(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
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
    if (view && !isInternalChange) {
      const currentContent = view.state.doc.toString();
      if (currentContent !== value) {
        view.dispatch({
          changes: { from: 0, to: currentContent.length, insert: value }
        });
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

<style>
  .rich-markdown-editor {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
