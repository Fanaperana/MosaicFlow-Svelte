<!--
  CodeEditor - Syntax-highlighted code editor using CodeMirror
  
  Features:
  - Multi-language syntax highlighting
  - Line numbers
  - Code folding
  - Dark theme optimized for node canvas
-->
<script lang="ts">
  import { EditorState } from '@codemirror/state';
  import { 
    EditorView, 
    drawSelection, 
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
    placeholder as placeholderPlugin,
  } from '@codemirror/view';
  import { 
    defaultKeymap, 
    history, 
    historyKeymap, 
    indentWithTab 
  } from '@codemirror/commands';
  import { 
    HighlightStyle,
    syntaxHighlighting, 
    indentOnInput,
    bracketMatching,
    foldGutter,
    foldKeymap,
  } from '@codemirror/language';
  import { languages } from '@codemirror/language-data';
  import { tags as t } from '@lezer/highlight';

  interface Props {
    value?: string;
    language?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    class?: string;
    readonly?: boolean;
  }

  let { 
    value = '', 
    language = 'javascript',
    onChange = () => {}, 
    placeholder = '// Enter code here...',
    class: className = '',
    readonly = false,
  }: Props = $props();

  let view: EditorView | null = null;
  let isInternalChange = false;
  let loadedLanguage = '';

  // Dark theme highlight style for code
  const codeHighlightStyle = HighlightStyle.define([
    // Comments
    { tag: t.comment, color: '#6a9955', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#6a9955', fontStyle: 'italic' },
    { tag: t.blockComment, color: '#6a9955', fontStyle: 'italic' },
    { tag: t.docComment, color: '#6a9955', fontStyle: 'italic' },
    
    // Strings
    { tag: t.string, color: '#ce9178' },
    { tag: t.special(t.string), color: '#d7ba7d' },
    { tag: t.regexp, color: '#d16969' },
    
    // Numbers
    { tag: t.number, color: '#b5cea8' },
    { tag: t.integer, color: '#b5cea8' },
    { tag: t.float, color: '#b5cea8' },
    
    // Keywords
    { tag: t.keyword, color: '#569cd6' },
    { tag: t.controlKeyword, color: '#c586c0' },
    { tag: t.operatorKeyword, color: '#569cd6' },
    { tag: t.definitionKeyword, color: '#569cd6' },
    { tag: t.moduleKeyword, color: '#c586c0' },
    
    // Operators
    { tag: t.operator, color: '#d4d4d4' },
    { tag: t.compareOperator, color: '#d4d4d4' },
    { tag: t.arithmeticOperator, color: '#d4d4d4' },
    { tag: t.logicOperator, color: '#d4d4d4' },
    
    // Functions and variables
    { tag: t.function(t.variableName), color: '#dcdcaa' },
    { tag: t.definition(t.variableName), color: '#9cdcfe' },
    { tag: t.variableName, color: '#9cdcfe' },
    { tag: t.local(t.variableName), color: '#9cdcfe' },
    { tag: t.special(t.variableName), color: '#4fc1ff' },
    
    // Types and classes
    { tag: t.typeName, color: '#4ec9b0' },
    { tag: t.className, color: '#4ec9b0' },
    { tag: t.namespace, color: '#4ec9b0' },
    { tag: t.macroName, color: '#dcdcaa' },
    
    // Properties
    { tag: t.propertyName, color: '#9cdcfe' },
    { tag: t.definition(t.propertyName), color: '#9cdcfe' },
    
    // Tags (HTML/XML)
    { tag: t.tagName, color: '#569cd6' },
    { tag: t.attributeName, color: '#9cdcfe' },
    { tag: t.attributeValue, color: '#ce9178' },
    
    // Punctuation
    { tag: t.punctuation, color: '#d4d4d4' },
    { tag: t.bracket, color: '#ffd700' },
    { tag: t.angleBracket, color: '#808080' },
    { tag: t.squareBracket, color: '#ffd700' },
    { tag: t.brace, color: '#ffd700' },
    { tag: t.paren, color: '#ffd700' },
    
    // Constants and special
    { tag: t.bool, color: '#569cd6' },
    { tag: t.null, color: '#569cd6' },
    { tag: t.atom, color: '#569cd6' },
    { tag: t.self, color: '#569cd6' },
    
    // Misc
    { tag: t.heading, color: '#569cd6', fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.link, color: '#3794ff', textDecoration: 'underline' },
    { tag: t.invalid, color: '#f44747' },
  ]);

  // Dark theme for the editor
  const editorTheme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '12px',
      backgroundColor: 'transparent',
    },
    '.cm-content': {
      fontFamily: "'Space Mono', monospace",
      padding: '4px 0',
      caretColor: '#fff',
    },
    '.cm-line': {
      padding: '0 4px 0 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#fff',
      borderLeftWidth: '2px',
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
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#858585',
      border: 'none',
      paddingRight: '4px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 4px',
      minWidth: '32px',
    },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 2px',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(255, 215, 0, 0.2)',
      outline: '1px solid rgba(255, 215, 0, 0.5)',
    },
    '.cm-placeholder': {
      color: '#6b7280',
      fontStyle: 'italic',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
  });

  // Find language by name
  async function getLanguageExtension(langName: string) {
    const normalizedName = langName.toLowerCase();
    
    // Map common language names to CodeMirror language descriptions
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'sh': 'shell',
      'bash': 'shell',
      'powershell': 'shell',
      'yml': 'yaml',
      'md': 'markdown',
      'htm': 'html',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'c++': 'cpp',
      'c#': 'csharp',
    };
    
    const targetName = languageMap[normalizedName] || normalizedName;
    
    // Find the language in CodeMirror's language data
    const lang = languages.find(l => 
      l.name.toLowerCase() === targetName ||
      l.alias.some(a => a.toLowerCase() === targetName) ||
      l.extensions.some(ext => ext.toLowerCase() === `.${targetName}`)
    );
    
    if (lang) {
      try {
        const support = await lang.load();
        return support;
      } catch (e) {
        console.warn(`Failed to load language: ${langName}`, e);
      }
    }
    
    return null;
  }

  // Svelte action to initialize the editor when DOM is ready
  function initEditor(container: HTMLDivElement) {
    createEditor(container);
    
    return {
      destroy() {
        if (view) {
          view.destroy();
          view = null;
        }
      }
    };
  }

  async function createEditor(container: HTMLDivElement) {
    if (!container || view) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !readonly) {
        isInternalChange = true;
        onChange(update.state.doc.toString());
        isInternalChange = false;
      }
    });

    // Base extensions
    const baseExtensions = [
      lineNumbers(),
      foldGutter(),
      drawSelection(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      indentOnInput(),
      bracketMatching(),
      history(),
      syntaxHighlighting(codeHighlightStyle),
      editorTheme,
      keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
      ]),
      updateListener,
      placeholderPlugin(placeholder),
      EditorView.lineWrapping,
    ];

    if (readonly) {
      baseExtensions.push(EditorState.readOnly.of(true));
    }

    // Try to load the language extension
    const langExtension = await getLanguageExtension(language);
    if (langExtension) {
      baseExtensions.push(langExtension);
    }

    const state = EditorState.create({
      doc: value,
      extensions: baseExtensions,
    });

    view = new EditorView({
      state,
      parent: container,
    });

    loadedLanguage = language;
  }

  // Update language when it changes
  async function updateLanguage(newLang: string) {
    if (!view || newLang === loadedLanguage) return;
    
    // Recreate editor with new language - need container reference
    const parent = view.dom.parentElement;
    const currentValue = view.state.doc.toString();
    view.destroy();
    view = null;
    value = currentValue;
    loadedLanguage = newLang;
    if (parent) {
      await createEditor(parent as HTMLDivElement);
    }
  }

  // Watch for external value changes
  $effect(() => {
    if (view && !isInternalChange) {
      const currentContent = view.state.doc.toString();
      if (value !== currentContent) {
        view.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: value,
          },
        });
      }
    }
  });

  // Watch for language changes
  $effect(() => {
    if (language !== loadedLanguage && loadedLanguage !== '') {
      updateLanguage(language);
    }
  });
</script>

<div 
  use:initEditor
  class="code-editor-container {className}"
></div>

<style>
  .code-editor-container {
    width: 100%;
    height: 100%;
    min-height: 60px;
    overflow: hidden;
  }

  .code-editor-container :global(.cm-editor) {
    height: 100%;
  }

  .code-editor-container :global(.cm-scroller) {
    overflow: auto !important;
  }
</style>
