<script lang="ts">
  import { Search, X, FileText, StickyNote, Image, Link, Code, Clock, User, Building2, Globe, FileDigit, KeyRound, MessageSquare, Router, Camera, FolderOpen, MapPin, List, ChevronRight } from 'lucide-svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { openNode } from '$lib/services/navigation';
  import type { CanvasInfo } from '$lib/services/vaultService';
  import type { IndexedNode } from '@mosaicflow/vault-core';
  import Fuse from 'fuse.js';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCanvasSelect: (canvas: CanvasInfo) => void;
  }

  let { isOpen, onClose, onCanvasSelect }: Props = $props();

  let searchQuery = $state('');
  let searchInputRef = $state<HTMLInputElement | null>(null);
  let searchResults = $state<SearchResult[]>([]);
  let isSearching = $state(false);
  let selectedIndex = $state(0);

  interface SearchResult {
    type: 'canvas' | 'node';
    canvas: CanvasInfo;
    node?: IndexedNode;
    matchedText?: string;
    score: number;
  }

  const nodeIconMap: Record<string, typeof StickyNote> = {
    note: StickyNote,
    image: Image,
    link: Link,
    code: Code,
    timestamp: Clock,
    person: User,
    organization: Building2,
    domain: Globe,
    hash: FileDigit,
    credential: KeyRound,
    socialPost: MessageSquare,
    group: FolderOpen,
    map: MapPin,
    router: Router,
    linkList: List,
    snapshot: Camera,
    action: FileText,
    iframe: Globe,
  };

  function getNodeIcon(type: string) {
    return nodeIconMap[type] || StickyNote;
  }

  // Focus input when opening
  $effect(() => {
    if (isOpen && searchInputRef) {
      setTimeout(() => searchInputRef?.focus(), 50);
    }
  });

  // Make sure the vault index is fresh when the palette opens
  $effect(() => {
    if (isOpen) knowledge.loadVault();
  });

  // Perform search when query or index changes
  $effect(() => {
    void knowledge.index;
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      // Show recent canvases when no query
      searchResults = vaultStore.canvases.slice(0, 10).map(canvas => ({
        type: 'canvas' as const,
        canvas,
        score: 0
      }));
    }
  });

  function performSearch(query: string) {
    isSearching = true;

    const canvasHits = new Fuse(vaultStore.canvases, { keys: ['name', 'description', 'tags'], threshold: 0.35, ignoreLocation: true })
      .search(query)
      .slice(0, 5)
      .map((r): SearchResult => ({ type: 'canvas', canvas: r.item, score: 0 }));

    const byId = new Map(vaultStore.canvases.map(c => [c.id, c]));
    const nodeHits = knowledge.index.search(query, { limit: 40 })
      .filter(h => byId.has(h.node.canvasId))
      .map((h): SearchResult => ({
        type: 'node',
        canvas: byId.get(h.node.canvasId)!,
        node: h.node,
        matchedText: h.snippet,
        score: h.score,
      }));

    searchResults = [...canvasHits, ...nodeHits].slice(0, 30);
    selectedIndex = 0;
    isSearching = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          handleResultClick(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }

  function handleResultClick(result: SearchResult) {
    if (result.type === 'canvas') {
      onCanvasSelect(result.canvas);
    } else if (result.node) {
      openNode(result.node.canvasId, result.node.id);
    }
    onClose();
  }

  function highlightMatch(text: string, rawQuery: string): string {
    const query = rawQuery.trim().split(/\s+/).find(w => !w.startsWith('#')) ?? '';
    if (!query) return escapeHtml(text);
    const escapedText = escapeHtml(text);
    const escapedQuery = escapeHtml(query);
    // Use indexOf for safe matching (no regex on user input)
    const lowerText = escapedText.toLowerCase();
    const lowerQuery = escapedQuery.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return escapedText;
    return (
      escapedText.slice(0, idx) +
      '<mark>' + escapedText.slice(idx, idx + escapedQuery.length) + '</mark>' +
      escapedText.slice(idx + escapedQuery.length)
    );
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="search-overlay" onclick={onClose} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="search-panel" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="search-header">
        <Search size={18} class="search-icon" />
        <input
          bind:this={searchInputRef}
          type="text"
          placeholder="Search canvases and nodes..."
          bind:value={searchQuery}
          onkeydown={handleKeydown}
          class="search-input"
        />
        <button class="close-btn" onclick={onClose} title="Close (Esc)">
          <X size={18} />
        </button>
      </div>

      <div class="search-results">
        {#if searchQuery.trim() === ''}
          <div class="results-section">
            <div class="section-label">Recent Canvases</div>
            {#each searchResults as result, index}
              <button
                class="result-item"
                class:selected={index === selectedIndex}
                onclick={() => handleResultClick(result)}
                onmouseenter={() => selectedIndex = index}
              >
                <FileText size={16} class="result-icon" />
                <div class="result-content">
                  <span class="result-title">{result.canvas.name}</span>
                </div>
                <ChevronRight size={14} class="result-arrow" />
              </button>
            {/each}
          </div>
        {:else if isSearching}
          <div class="loading">Searching...</div>
        {:else if searchResults.length === 0}
          <div class="no-results">No results found for "{searchQuery}"</div>
        {:else}
          <div class="results-section">
            <div class="section-label">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</div>
            {#each searchResults as result, index}
              {@const IconComponent = result.type === 'node' && result.node 
                ? getNodeIcon(result.node.type) 
                : FileText}
              <button
                class="result-item"
                class:selected={index === selectedIndex}
                onclick={() => handleResultClick(result)}
                onmouseenter={() => selectedIndex = index}
              >
                <IconComponent size={16} class="result-icon" />
                <div class="result-content">
                  {#if result.type === 'canvas'}
                    <span class="result-title">{@html highlightMatch(result.canvas.name, searchQuery)}</span>
                    <span class="result-type">Canvas</span>
                  {:else if result.node}
                    <span class="result-title">{@html highlightMatch(result.node.title || result.node.id, searchQuery)}</span>
                    {#if result.matchedText}
                      <span class="result-snippet">{@html highlightMatch(result.matchedText, searchQuery)}</span>
                    {/if}
                    <span class="result-meta">
                      <span class="result-type">{result.node.type}</span>
                      <span class="result-canvas">in {result.canvas.name}</span>
                    </span>
                  {/if}
                </div>
                <ChevronRight size={14} class="result-arrow" />
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="search-footer">
        <span class="hint"><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
        <span class="hint"><kbd>Enter</kbd> Open</span>
        <span class="hint"><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .search-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 1000;
  }

  .search-panel {
    width: 100%;
    max-width: 560px;
    background: #111118;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .search-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid #1e1e2e;
  }

  .search-header :global(.search-icon) {
    color: #666;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #fafafa;
    font-size: 16px;
    font-family: inherit;
  }

  .search-input::placeholder {
    color: #666;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #666;
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: #1e1e2e;
    color: #fafafa;
  }

  .search-results {
    max-height: 400px;
    overflow-y: auto;
    padding: 8px;
  }

  .results-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-label {
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #666;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .result-item:hover,
  .result-item.selected {
    background: #1e1e2e;
  }

  .result-item :global(.result-icon) {
    color: #888;
    flex-shrink: 0;
  }

  .result-item.selected :global(.result-icon) {
    color: #3b82f6;
  }

  .result-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .result-title {
    color: #fafafa;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-title :global(mark),
  .result-snippet :global(mark) {
    background: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
    padding: 0 2px;
    border-radius: 2px;
  }

  .result-snippet {
    color: var(--mf-text-muted, #a1a1aa);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .result-type {
    font-size: 11px;
    color: #666;
    text-transform: capitalize;
  }

  .result-canvas {
    font-size: 11px;
    color: #555;
  }

  .result-item :global(.result-arrow) {
    color: #444;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .result-item:hover :global(.result-arrow),
  .result-item.selected :global(.result-arrow) {
    opacity: 1;
  }

  .loading,
  .no-results {
    padding: 32px;
    text-align: center;
    color: #666;
    font-size: 14px;
  }

  .search-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: #0a0a0f;
    border-top: 1px solid #1e1e2e;
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #555;
  }

  .hint kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: #1e1e2e;
    border: 1px solid #2a2a3a;
    border-radius: 4px;
    font-size: 10px;
    font-family: inherit;
    color: #888;
  }
</style>
