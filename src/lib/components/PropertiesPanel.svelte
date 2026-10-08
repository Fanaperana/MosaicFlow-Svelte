<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import type { MosaicEdge, MarkerShape, EdgeStrokeStyle } from '$lib/types';
  import { nodeRegistry, getIconByName } from '$lib/kernel/registries/node-registry';
  import { MarkerType } from '@xyflow/svelte';
  import {
    X, Copy, Check, Trash2, StickyNote, Link2, ExternalLink, Lock, Unlock, Eye, Pencil,
    AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type, Baseline, Square, SquareRoundCorner,
    PaintBucket, Spline, Sparkles, MoveHorizontal, ArrowUpRight, CornerDownLeft, Tags, Text, Hash,
    List, Calendar, FileText, SquareCheck, RotateCw, FlipHorizontal2, FlipVertical2, Clock, Scan, Ungroup
  } from 'lucide-svelte';
  import { ColorInput } from '$lib/components/ui/color-picker';
  import { PropertyGroup } from '$lib/components/ui/property-group';
  import FixedTooltip from '$lib/components/ui/FixedTooltip.svelte';
  import { openExternal } from '$lib/utils';
  import { knowledge } from '$lib/stores/knowledge.svelte';
  import { vaultStore } from '$lib/stores/vault.svelte';
  import { openNode, openWikilink } from '$lib/services/navigation';
  import { extractTags } from '@mosaicflow/vault-core';

  // Helper: Convert hex + opacity to RGBA string
  function hexToRgba(hex: string, opacity: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return hex;
  }

  // Helper: Parse RGBA string to extract hex and alpha
  function parseRgba(color: string): { hex: string; alpha: number } {
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]);
      const g = parseInt(rgbaMatch[2]);
      const b = parseInt(rgbaMatch[3]);
      const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      return { hex, alpha: a };
    }
    return { hex: color, alpha: 1 };
  }

  interface Props {
    onClose: () => void;
  }
  
  let { onClose }: Props = $props();

  // Accordion states for PropertyGroup
  let generalOpen = $state(true);
  let labelOpen = $state(true);
  let nodeSettingsOpen = $state(false);
  let appearanceOpen = $state(true);
  let optionsOpen = $state(true);
  let lookupOpen = $state(true);
  let fieldsOpen = $state(true);
  let linksOpen = $state(true);

  let tagDraft = $state('');
  let idCopied = $state(false);
  let linkCopied = $state(false);

  const STROKES: EdgeStrokeStyle[] = ['solid', 'dashed', 'dotted'];
  const MARKERS: MarkerShape[] = ['none', 'arrow', 'arrowclosed'];
  const MARKER_LABELS: Record<MarkerShape, string> = { none: 'None', arrow: 'Arrow', arrowclosed: 'Filled arrow' };
  const TIME_PARTS: [key: string, label: string, fallback: boolean][] = [
    ['showMonth', 'Month', true], ['showDay', 'Day', true], ['showYear', 'Year', false], ['showDayOfWeek', 'Weekday', false],
    ['showHour', 'Hour', true], ['showMinute', 'Min', true], ['showSecond', 'Sec', false], ['showMillisecond', 'Ms', false],
  ];

  let selectedNode = $derived(
    workspace.selectedNodeIds.length === 1
      ? workspace.nodes.find(n => n.id === workspace.selectedNodeIds[0])
      : null
  );

  let selectedEdge = $derived(
    workspace.selectedEdgeIds.length === 1
      ? workspace.edges.find(e => e.id === workspace.selectedEdgeIds[0])
      : null
  );

  // Object-valued fields have bespoke editors inside the node itself.
  let schemaFields = $derived(
    selectedNode
      ? Object.entries(nodeRegistry.get(selectedNode.type)?.knowledge?.fields ?? {})
          .filter(([, f]) => f.type !== 'object' && f.type !== 'object[]')
      : []
  );

  let bodyField = $derived(selectedNode ? nodeRegistry.getBodyMapping(selectedNode.type).field : '');

  let canvasId = $derived(vaultStore.currentCanvas?.id ?? '');
  let nodeTags = $derived(selectedNode ? extractTags(selectedNode.data as Record<string, unknown>) : []);
  let outgoing = $derived(selectedNode ? knowledge.index.outgoing(canvasId, selectedNode.id) : []);
  let backlinks = $derived(selectedNode ? knowledge.index.backlinks(canvasId, selectedNode.id) : []);
  let explicitTags = $derived(
    selectedNode && Array.isArray(selectedNode.data.tags) ? (selectedNode.data.tags as string[]) : []
  );

  function normalizeTag(tag: string): string {
    return tag.trim().replace(/^#/, '').toLowerCase();
  }

  function isExplicitTag(tag: string): boolean {
    return explicitTags.some((t) => normalizeTag(t) === tag);
  }

  function commitTagDraft() {
    const existing = new Set(explicitTags.map(normalizeTag));
    const added = tagDraft.split(/[,\s]+/).map(normalizeTag).filter((t) => t && !existing.has(t));
    tagDraft = '';
    if (added.length > 0) updateNodeData('tags', [...explicitTags, ...new Set(added)]);
  }

  function removeTag(tag: string) {
    updateNodeData('tags', explicitTags.filter((t) => normalizeTag(t) !== tag));
  }

  function handleTagKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTagDraft();
    } else if (e.key === 'Backspace' && tagDraft === '' && explicitTags.length > 0) {
      updateNodeData('tags', explicitTags.slice(0, -1));
    }
  }

  async function copyNodeId() {
    if (!selectedNode) return;
    await navigator.clipboard.writeText(selectedNode.id);
    idCopied = true;
    setTimeout(() => (idCopied = false), 1200);
  }

  async function copyNodeLink() {
    if (!selectedNode) return;
    await navigator.clipboard.writeText(`[[${selectedNode.id}]]`);
    linkCopied = true;
    setTimeout(() => (linkCopied = false), 1200);
  }

  function fieldLabel(key: string): string {
    const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  function fieldIcon(type: string) {
    switch (type) {
      case 'number': return Hash;
      case 'enum': return List;
      case 'date': return Calendar;
      case 'url': return Link2;
      case 'boolean': return SquareCheck;
      case 'string[]': return Tags;
      case 'markdown': return FileText;
      default: return Text;
    }
  }

  // Use centralized icon registry
  function getIconComponent(iconName: string) {
    return getIconByName(iconName);
  }

  function getNodeTypeInfo(type: string) {
    return nodeRegistry.get(type);
  }

  function updateNodeData(key: string, value: unknown) {
    if (selectedNode) {
      workspace.updateNodeData(selectedNode.id, { [key]: value });
    }
  }

  function updateNodePosition(axis: 'x' | 'y', value: number) {
    if (selectedNode && !selectedNode.data.locked) {
      workspace.updateNode(selectedNode.id, { 
        position: { 
          ...selectedNode.position, 
          [axis]: value 
        } 
      });
    }
  }

  function updateNodeSize(dim: 'width' | 'height', value: number) {
    if (selectedNode && !selectedNode.data.sizeLocked) {
      workspace.updateNode(selectedNode.id, { [dim]: value });
    }
  }

  function updateEdge(updates: Partial<MosaicEdge>) {
    if (selectedEdge) {
      // Dispatch event to FlowHelper for immediate SvelteFlow update
      window.dispatchEvent(new CustomEvent('mosaicflow:updateEdge', {
        detail: { id: selectedEdge.id, updates }
      }));
      // Also update workspace store for persistence
      workspace.updateEdge(selectedEdge.id, updates);
    }
  }

  function updateEdgeData(key: string, value: unknown) {
    if (selectedEdge) {
      const currentData = selectedEdge.data || {};
      const newData = { ...currentData, [key]: value };
      
      // Dispatch event to FlowHelper for immediate SvelteFlow update
      window.dispatchEvent(new CustomEvent('mosaicflow:updateEdge', {
        detail: { id: selectedEdge.id, updates: { data: newData } }
      }));
      // Also update workspace store for persistence
      workspace.updateEdge(selectedEdge.id, { data: newData });
    }
  }

  function updateNodeExtent(contained: boolean) {
    if (selectedNode && selectedNode.parentId) {
      workspace.updateNode(selectedNode.id, { 
        extent: contained ? 'parent' : undefined 
      });
    }
  }

  function getMarkerConfig(shape: MarkerShape, color: string) {
    if (shape === 'none') return undefined;
    
    const markerType = shape === 'arrowclosed' ? MarkerType.ArrowClosed : MarkerType.Arrow;
    return {
      type: markerType,
      color: color,
      width: 20,
      height: 20,
    };
  }

  function applyMarkers(startMarker: MarkerShape, endMarker: MarkerShape) {
    if (selectedEdge) {
      const color = selectedEdge.data?.color || '#555555';
      // When marker is 'none', we must explicitly pass undefined to remove it
      // But Svelte Flow might need null or a specific way to clear it
      // Let's try passing undefined which is what getMarkerConfig returns for 'none'
      const markerStart = getMarkerConfig(startMarker, color);
      const markerEnd = getMarkerConfig(endMarker, color);
      
      // Dispatch event to FlowHelper for immediate SvelteFlow update
      // We need to ensure we're passing the correct structure for Svelte Flow
      window.dispatchEvent(new CustomEvent('mosaicflow:updateEdge', {
        detail: { 
          id: selectedEdge.id, 
          updates: { 
            markerStart: markerStart || null, // Try null instead of undefined for clearing
            markerEnd: markerEnd || null 
          } 
        }
      }));
      
      // Also update workspace store for persistence (includes data)
      workspace.updateEdge(selectedEdge.id, { 
        markerStart, 
        markerEnd,
        data: {
          ...selectedEdge.data,
          markerStart: startMarker,
          markerEnd: endMarker,
        }
      });
    }
  }

  function deleteNode() {
    if (selectedNode) {
      workspace.deleteNode(selectedNode.id);
      onClose();
    }
  }

  function deleteEdge() {
    if (selectedEdge) {
      workspace.deleteEdge(selectedEdge.id);
    }
  }

  function duplicateNode() {
    if (selectedNode) {
      const [copy] = workspace.duplicateNodes([selectedNode.id]);
      if (copy) workspace.setSelectedNodes([copy.id]);
    }
  }

  function handlePanelEvent(e: Event) {
    e.stopPropagation();
  }

  // Helper to generate edge style string
  function getEdgeStyleString(color: string, width: number, strokeStyle: EdgeStrokeStyle = 'solid'): string {
    let style = `stroke: ${color}; stroke-width: ${width}px;`;
    
    if (strokeStyle === 'dashed') {
      style += ` stroke-dasharray: ${width * 3} ${width * 2};`;
    } else if (strokeStyle === 'dotted') {
      style += ` stroke-dasharray: ${width} ${width * 2};`;
    }
    
    return style;
  }

  function updateEdgeAppearance(updates: { color?: string; strokeWidth?: number; strokeStyle?: EdgeStrokeStyle }) {
    if (!selectedEdge) return;
    
    const color = updates.color ?? selectedEdge.data?.color ?? '#555555';
    const width = updates.strokeWidth ?? selectedEdge.data?.strokeWidth ?? 2;
    const strokeStyle = updates.strokeStyle ?? selectedEdge.data?.strokeStyle ?? 'solid';
    
    // Build updated data
    const newData = {
      ...selectedEdge.data,
      color,
      strokeWidth: width,
      strokeStyle,
    };
    
    const styleString = getEdgeStyleString(color, width, strokeStyle);
    
    // Build markers with new color if color changed
    let markerStart = selectedEdge.markerStart;
    let markerEnd = selectedEdge.markerEnd;
    
    if (updates.color !== undefined) {
      markerStart = getMarkerConfig(selectedEdge.data?.markerStart || 'none', color);
      markerEnd = getMarkerConfig(selectedEdge.data?.markerEnd || 'none', color);
    }
    
    // Dispatch event to FlowHelper for immediate SvelteFlow update
    window.dispatchEvent(new CustomEvent('mosaicflow:updateEdge', {
      detail: { 
        id: selectedEdge.id, 
        updates: { 
          style: styleString, 
          markerStart: markerStart || null, 
          markerEnd: markerEnd || null 
        } 
      }
    }));
    
    // Update workspace store for persistence
    workspace.updateEdge(selectedEdge.id, {
      style: styleString,
      data: newData,
      markerStart,
      markerEnd,
    });
  }
</script>

{#snippet strokeGlyph(style: string)}
  <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
    <line
      x1="2" y1="5" x2="20" y2="5"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap={style === 'dotted' ? 'round' : 'butt'}
      stroke-dasharray={style === 'dashed' ? '4 3' : style === 'dotted' ? '0.01 3.5' : undefined}
    />
  </svg>
{/snippet}

{#snippet markerGlyph(kind: MarkerShape, start: boolean)}
  <svg
    class={start ? 'flip' : ''}
    width="22" height="10" viewBox="0 0 22 10"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"
  >
    <line x1="2" y1="5" x2={kind === 'none' ? 20 : 17} y2="5" />
    {#if kind === 'arrow'}
      <polyline points="14,1.5 19,5 14,8.5" />
    {:else if kind === 'arrowclosed'}
      <polygon points="14,1.5 20,5 14,8.5" fill="currentColor" />
    {/if}
  </svg>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="properties-panel"
  class:readonly={workspace.locked}
  onclick={handlePanelEvent}
  onkeydown={handlePanelEvent}
  onmousedown={handlePanelEvent}
  onpointerdown={handlePanelEvent}
>
  <header class="pp-header">
    <div class="pp-bar">
      {#if selectedEdge}
        <span class="pp-kind edge"><span class="pp-kind-icon"><Spline size={12} /></span>Edge</span>
      {:else if selectedNode}
        {@const info = getNodeTypeInfo(selectedNode.type)}
        {@const KindIcon = info ? getIconComponent(info.iconName) : StickyNote}
        <span class="pp-kind"><span class="pp-kind-icon"><KindIcon size={12} /></span>{info?.label || selectedNode.type}</span>
      {:else}
        <span class="pp-kind muted">Properties</span>
      {/if}

      <div class="pp-bar-actions">
        {#if selectedNode && !workspace.locked}
          <FixedTooltip text="Duplicate" position="bottom">
            <button class="icon-btn" onclick={duplicateNode} aria-label="Duplicate node"><Copy size={14} /></button>
          </FixedTooltip>
          <FixedTooltip text="Delete" position="bottom">
            <button class="icon-btn danger" onclick={deleteNode} aria-label="Delete node"><Trash2 size={14} /></button>
          </FixedTooltip>
        {:else if selectedEdge && !workspace.locked}
          <FixedTooltip text="Delete edge" position="bottom">
            <button class="icon-btn danger" onclick={deleteEdge} aria-label="Delete edge"><Trash2 size={14} /></button>
          </FixedTooltip>
        {/if}
        <FixedTooltip text="Close" position="left">
          <button class="icon-btn" onclick={onClose} aria-label="Close properties"><X size={14} /></button>
        </FixedTooltip>
      </div>
    </div>

    {#if selectedEdge}
      <input
        class="pp-title"
        type="text"
        value={selectedEdge.label || ''}
        placeholder="Untitled edge"
        oninput={(e) => {
          const label = (e.target as HTMLInputElement).value;
          updateEdge({ label: label || undefined });
        }}
      />
    {:else if selectedNode}
      <input
        class="pp-title"
        type="text"
        value={selectedNode.data.title || ''}
        placeholder="Untitled"
        oninput={(e) => updateNodeData('title', (e.target as HTMLInputElement).value)}
      />
      <div class="pp-id-row">
        <button class="pp-id" onclick={copyNodeId} title="Copy node ID">
          {#if idCopied}<Check size={11} />{:else}<Copy size={11} />{/if}
          <span>{selectedNode.id}</span>
        </button>
        <button class="pp-id pp-copy-link" onclick={copyNodeLink} title="Copy a [[link]] to this node — paste it into any note">
          {#if linkCopied}<Check size={11} />{:else}<Link2 size={11} />{/if}
          <span>Copy link</span>
        </button>
      </div>
    {/if}
    {#if workspace.locked}
      <div class="pp-locked"><Lock size={11} /> Page is view only — unlock it to edit.</div>
    {/if}
  </header>

  {#if selectedEdge}
    <div class="panel-content">
      <PropertyGroup title="Connection" bind:open={generalOpen}>
        <div class="prop">
          <span class="prop-label"><Spline size={14} />Path</span>
          <select
            class="pp-control"
            value={selectedEdge.type || 'default'}
            onchange={(e) => {
              const edgeType = (e.target as HTMLSelectElement).value;
              // Map edge type to path type for GlowEdge
              const pathType = edgeType === 'default' ? 'bezier' : edgeType;
              workspace.updateEdgeWithRefresh(selectedEdge.id, {
                type: edgeType as any,
                data: { ...selectedEdge.data, pathType: pathType as any }
              });
            }}
          >
            <option value="default">Bezier</option>
            <option value="straight">Straight</option>
            <option value="step">Step</option>
            <option value="smoothstep">Smooth step</option>
          </select>
        </div>

        <div class="prop">
          <span class="prop-label"><MoveHorizontal size={14} />Start</span>
          <div class="seg">
            {#each MARKERS as m (m)}
              <button
                type="button"
                class="seg-btn"
                class:active={(selectedEdge.data?.markerStart || 'none') === m}
                onclick={() => applyMarkers(m, selectedEdge.data?.markerEnd || 'none')}
                title={MARKER_LABELS[m]}
              >{@render markerGlyph(m, true)}</button>
            {/each}
          </div>
        </div>

        <div class="prop">
          <span class="prop-label"><MoveHorizontal size={14} />End</span>
          <div class="seg">
            {#each MARKERS as m (m)}
              <button
                type="button"
                class="seg-btn"
                class:active={(selectedEdge.data?.markerEnd || 'none') === m}
                onclick={() => applyMarkers(selectedEdge.data?.markerStart || 'none', m)}
                title={MARKER_LABELS[m]}
              >{@render markerGlyph(m, false)}</button>
            {/each}
          </div>
        </div>

        <label class="prop">
          <span class="prop-label"><Sparkles size={14} />Animated</span>
          <span class="prop-value">
            <input
              type="checkbox"
              class="switch"
              checked={selectedEdge.animated ?? false}
              onchange={(e) => updateEdge({ animated: (e.target as HTMLInputElement).checked })}
            />
          </span>
        </label>
      </PropertyGroup>

      <PropertyGroup title="Stroke" bind:open={appearanceOpen}>
        <div class="prop">
          <span class="prop-label"><PaintBucket size={14} />Color</span>
          <span class="prop-value">
            <ColorInput value={selectedEdge.data?.color || '#555555'} onchange={(color) => updateEdgeAppearance({ color })} size="sm" />
          </span>
        </div>
        <div class="prop">
          <span class="prop-label"><Baseline size={14} />Width</span>
          <span class="prop-value">
            <label class="num">
              <input
                type="number"
                min="1"
                max="10"
                value={selectedEdge.data?.strokeWidth || 2}
                oninput={(e) => updateEdgeAppearance({ strokeWidth: parseInt((e.target as HTMLInputElement).value) || 2 })}
              />
              <span class="unit">px</span>
            </label>
          </span>
        </div>
        <div class="prop">
          <span class="prop-label"><Scan size={14} />Style</span>
          <div class="seg">
            {#each STROKES as s (s)}
              <button
                type="button"
                class="seg-btn"
                class:active={(selectedEdge.data?.strokeStyle || 'solid') === s}
                onclick={() => updateEdgeAppearance({ strokeStyle: s })}
                title={s}
              >{@render strokeGlyph(s)}</button>
            {/each}
          </div>
        </div>
      </PropertyGroup>

      <PropertyGroup title="Label" bind:open={labelOpen}>
        <div class="prop">
          <span class="prop-label"><Baseline size={14} />Text</span>
          <span class="prop-value">
            <ColorInput value={selectedEdge.data?.labelColor || '#ffffff'} onchange={(color) => updateEdgeData('labelColor', color)} size="sm" />
          </span>
        </div>
        <div class="prop">
          <span class="prop-label"><PaintBucket size={14} />Background</span>
          <span class="prop-value">
            <ColorInput value={selectedEdge.data?.labelBgColor || '#1a1d21'} onchange={(color) => updateEdgeData('labelBgColor', color)} size="sm" />
          </span>
        </div>
        <div class="prop">
          <span class="prop-label"><Type size={14} />Size</span>
          <span class="prop-value">
            <label class="num">
              <input
                type="number"
                min="8"
                max="24"
                value={selectedEdge.data?.labelFontSize || 12}
                oninput={(e) => updateEdgeData('labelFontSize', parseInt((e.target as HTMLInputElement).value))}
              />
              <span class="unit">px</span>
            </label>
          </span>
        </div>
      </PropertyGroup>
    </div>

  {:else if selectedNode}
    {@const data = selectedNode.data as Record<string, any>}
    <div class="panel-content">
      <!-- Type-specific fields, generated from the node plugin's schema -->
      {#if schemaFields.length > 0}
        <PropertyGroup title="Properties" bind:open={fieldsOpen}>
          {#each schemaFields as [key, field] (key)}
            {@const value = data[key]}
            {@const FieldIcon = fieldIcon(field.type)}
            {#if field.type === 'boolean'}
              <label class="prop" title={field.description}>
                <span class="prop-label"><FieldIcon size={14} />{fieldLabel(key)}</span>
                <span class="prop-value">
                  <input type="checkbox" class="switch" checked={!!value} onchange={(e) => updateNodeData(key, (e.target as HTMLInputElement).checked)} />
                </span>
              </label>
            {:else if field.type === 'markdown' || key === bodyField}
              <div class="prop prop-block" title={field.description}>
                <span class="prop-label"><FieldIcon size={14} />{fieldLabel(key)}</span>
                <textarea
                  class="pp-textarea"
                  rows="3"
                  value={typeof value === 'string' ? value : ''}
                  placeholder={field.description || 'Empty'}
                  oninput={(e) => updateNodeData(key, (e.target as HTMLTextAreaElement).value)}
                ></textarea>
              </div>
            {:else}
              <div class="prop" title={field.description}>
                <span class="prop-label"><FieldIcon size={14} />{fieldLabel(key)}</span>
                {#if field.type === 'enum'}
                  <select class="pp-control" value={typeof value === 'string' ? value : ''} onchange={(e) => updateNodeData(key, (e.target as HTMLSelectElement).value)}>
                    <option value="">Empty</option>
                    {#each field.values ?? [] as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                {:else if field.type === 'number'}
                  <input
                    class="pp-control"
                    type="number"
                    step="any"
                    value={typeof value === 'number' ? value : ''}
                    placeholder="Empty"
                    oninput={(e) => {
                      const n = parseFloat((e.target as HTMLInputElement).value);
                      updateNodeData(key, Number.isFinite(n) ? n : undefined);
                    }}
                  />
                {:else if field.type === 'string[]'}
                  <input
                    class="pp-control"
                    type="text"
                    value={Array.isArray(value) ? value.join(', ') : ''}
                    placeholder="Empty"
                    oninput={(e) => updateNodeData(key, (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean))}
                  />
                {:else}
                  <input
                    class="pp-control"
                    type="text"
                    value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                    placeholder={field.type === 'date' ? 'YYYY-MM-DD' : field.type === 'url' ? 'https://' : 'Empty'}
                    oninput={(e) => updateNodeData(key, (e.target as HTMLInputElement).value)}
                  />
                {/if}
              </div>
            {/if}
          {/each}
        </PropertyGroup>
      {/if}

      <!-- Knowledge: tags, [[wikilinks]] and backlinks across the vault -->
      <PropertyGroup title="Links & Tags" bind:open={linksOpen}>
        <div class="prop prop-top">
          <span class="prop-label"><Tags size={14} />Tags</span>
          <div class="tag-field" title="Enter to add. #tags written in the text are picked up automatically.">
            {#each nodeTags as tag (tag)}
              <span class="tag-pill" class:active={knowledge.activeTag === tag}>
                <button type="button" class="tag-name" onclick={() => knowledge.toggleTag(tag)} title="Highlight nodes tagged #{tag}">#{tag}</button>
                {#if isExplicitTag(tag)}
                  <button type="button" class="tag-x" onclick={() => removeTag(tag)} aria-label="Remove #{tag}"><X size={10} /></button>
                {/if}
              </span>
            {/each}
            <input
              class="tag-input"
              type="text"
              bind:value={tagDraft}
              placeholder={nodeTags.length ? 'Add…' : 'Empty'}
              onkeydown={handleTagKey}
              onblur={commitTagDraft}
            />
          </div>
        </div>

        <div class="sub-heading"><span>Links</span><span class="count">{outgoing.length}</span></div>
        {#each outgoing as { link, node } (link.raw)}
          <button
            class="link-row"
            class:unresolved={!node}
            onclick={() => openWikilink(link.canvas ? `${link.canvas}#${link.target}` : link.target)}
            data-wikilink={link.canvas ? `${link.canvas}#${link.target}` : link.target}
          >
            <ArrowUpRight size={13} />
            <span class="link-title">{link.alias ?? (node && node.id.toLowerCase() === link.target.toLowerCase() ? node.title || 'Untitled' : link.target)}</span>
            {#if node && node.canvasId !== canvasId}<span class="link-canvas">{node.canvasName}</span>{/if}
          </button>
        {:else}
          <p class="hint">Write [[Node title]] in the text to link nodes.</p>
        {/each}

        <div class="sub-heading"><span>Backlinks</span><span class="count">{backlinks.length}</span></div>
        {#each backlinks as source (source.canvasId + source.id)}
          <button class="link-row" onclick={() => openNode(source.canvasId, source.id)} data-preview-canvas={source.canvasId} data-preview-node={source.id}>
            <CornerDownLeft size={13} />
            <span class="link-title">{source.title || source.id}</span>
            {#if source.canvasId !== canvasId}<span class="link-canvas">{source.canvasName}</span>{/if}
          </button>
        {:else}
          <p class="hint">No other node links here yet.</p>
        {/each}
      </PropertyGroup>

      <PropertyGroup title="Appearance" bind:open={appearanceOpen}>
        <div class="prop">
          <span class="prop-label"><PaintBucket size={14} />Fill</span>
          <span class="prop-value">
            <ColorInput
              value={
                selectedNode.type === 'simpleText'
                  ? hexToRgba(data.color || '#1a1d21', (data.bgOpacity as number) ?? 0)
                  : data.color || (selectedNode.type === 'group' ? 'rgba(59, 130, 246, 0.05)' : '#1e1e1e')
              }
              onchange={(color, rgba) => {
                if (selectedNode.type === 'simpleText' && rgba) {
                  // SimpleText stores hex and alpha separately
                  const parsed = parseRgba(color);
                  updateNodeData('color', parsed.hex);
                  updateNodeData('bgOpacity', parsed.alpha);
                } else {
                  updateNodeData('color', color);
                }
              }}
              size="sm"
            />
          </span>
        </div>

        {#if selectedNode.type === 'group'}
          <div class="prop">
            <span class="prop-label"><Baseline size={14} />Label</span>
            <span class="prop-value">
              <ColorInput value={data.labelColor || data.borderColor || '#3b82f6'} onchange={(color) => updateNodeData('labelColor', color)} size="sm" />
            </span>
          </div>
        {:else if selectedNode.type !== 'image' && selectedNode.type !== 'annotation'}
          <div class="prop">
            <span class="prop-label"><Baseline size={14} />Text</span>
            <span class="prop-value">
              <ColorInput value={data.textColor || '#e0e0e0'} onchange={(color) => updateNodeData('textColor', color)} size="sm" />
            </span>
          </div>
        {/if}

        <div class="prop">
          <span class="prop-label"><Square size={14} />Border</span>
          <span class="prop-value">
            <ColorInput
              value={data.borderColor || (selectedNode.type === 'group' ? '#3b82f6' : '#333333')}
              onchange={(color) => updateNodeData('borderColor', color)}
              size="sm"
            />
            <label class="num" title="Border width">
              <input
                type="number"
                min="0"
                max="10"
                value={(data.borderWidth as number) ?? 1}
                oninput={(e) => updateNodeData('borderWidth', parseInt((e.target as HTMLInputElement).value) || 1)}
              />
              <span class="unit">px</span>
            </label>
          </span>
        </div>

        <div class="prop">
          <span class="prop-label"><Scan size={14} />Style</span>
          <div class="seg">
            {#each STROKES as s (s)}
              <button
                type="button"
                class="seg-btn"
                class:active={(data.borderStyle || 'solid') === s}
                onclick={() => updateNodeData('borderStyle', s)}
                title={s}
              >{@render strokeGlyph(s)}</button>
            {/each}
            <button type="button" class="seg-btn" class:active={data.borderStyle === 'none'} onclick={() => updateNodeData('borderStyle', 'none')} title="No border">
              <X size={12} />
            </button>
          </div>
        </div>

        <div class="prop">
          <span class="prop-label"><SquareRoundCorner size={14} />Radius</span>
          <span class="prop-value">
            <label class="num">
              <input
                type="number"
                min="0"
                max="50"
                value={(data.borderRadius as number) ?? 4}
                oninput={(e) => updateNodeData('borderRadius', parseInt((e.target as HTMLInputElement).value) || 0)}
              />
              <span class="unit">px</span>
            </label>
          </span>
        </div>

        {#if selectedNode.type === 'simpleText'}
          <div class="prop">
            <span class="prop-label"><Type size={14} />Font size</span>
            <span class="prop-value">
              <label class="num">
                <input
                  type="number"
                  min="8"
                  max="72"
                  value={(data.fontSize as number) ?? 14}
                  oninput={(e) => updateNodeData('fontSize', parseInt((e.target as HTMLInputElement).value) || 14)}
                />
                <span class="unit">px</span>
              </label>
            </span>
          </div>
          <div class="prop">
            <span class="prop-label"><AlignLeft size={14} />Align</span>
            <div class="seg">
              <button type="button" class="seg-btn" class:active={!data.textAlign || data.textAlign === 'left'} onclick={() => updateNodeData('textAlign', 'left')} title="Left"><AlignLeft size={13} /></button>
              <button type="button" class="seg-btn" class:active={data.textAlign === 'center'} onclick={() => updateNodeData('textAlign', 'center')} title="Center"><AlignCenter size={13} /></button>
              <button type="button" class="seg-btn" class:active={data.textAlign === 'right'} onclick={() => updateNodeData('textAlign', 'right')} title="Right"><AlignRight size={13} /></button>
            </div>
          </div>
        {/if}

        <label class="prop">
          <span class="prop-label"><Eye size={14} />Show header</span>
          <span class="prop-value">
            <input
              type="checkbox"
              class="switch"
              checked={data.showHeader ?? false}
              onchange={(e) => updateNodeData('showHeader', (e.target as HTMLInputElement).checked)}
            />
          </span>
        </label>

        {#if selectedNode.parentId}
          <label class="prop">
            <span class="prop-label"><Lock size={14} />Keep in group</span>
            <span class="prop-value">
              <input
                type="checkbox"
                class="switch"
                checked={selectedNode.extent === 'parent'}
                onchange={(e) => updateNodeExtent((e.target as HTMLInputElement).checked)}
              />
            </span>
          </label>
        {/if}
      </PropertyGroup>

      <PropertyGroup title="Layout" bind:open={nodeSettingsOpen}>
        <div class="xy-grid">
          <label class="num field" class:disabled={data.locked}>
            <span class="prefix">X</span>
            <input
              type="number"
              value={Math.round(selectedNode.position.x)}
              oninput={(e) => updateNodePosition('x', parseInt((e.target as HTMLInputElement).value))}
              disabled={data.locked}
            />
          </label>
          <label class="num field" class:disabled={data.locked}>
            <span class="prefix">Y</span>
            <input
              type="number"
              value={Math.round(selectedNode.position.y)}
              oninput={(e) => updateNodePosition('y', parseInt((e.target as HTMLInputElement).value))}
              disabled={data.locked}
            />
          </label>
          <button
            class="icon-btn"
            class:on={data.locked}
            onclick={() => updateNodeData('locked', !data.locked)}
            title={data.locked ? 'Unlock position' : 'Lock position'}
            aria-label={data.locked ? 'Unlock position' : 'Lock position'}
          >
            {#if data.locked}<Lock size={13} />{:else}<Unlock size={13} />{/if}
          </button>

          <label class="num field" class:disabled={data.sizeLocked}>
            <span class="prefix">W</span>
            <input
              type="number"
              min="50"
              value={selectedNode.width || 200}
              oninput={(e) => updateNodeSize('width', parseInt((e.target as HTMLInputElement).value))}
              disabled={data.sizeLocked}
            />
          </label>
          <label class="num field" class:disabled={data.sizeLocked}>
            <span class="prefix">H</span>
            <input
              type="number"
              min="50"
              value={selectedNode.height || 100}
              oninput={(e) => updateNodeSize('height', parseInt((e.target as HTMLInputElement).value))}
              disabled={data.sizeLocked}
            />
          </label>
          <button
            class="icon-btn"
            class:on={data.sizeLocked}
            onclick={() => updateNodeData('sizeLocked', !data.sizeLocked)}
            title={data.sizeLocked ? 'Unlock size' : 'Lock size'}
            aria-label={data.sizeLocked ? 'Unlock size' : 'Lock size'}
          >
            {#if data.sizeLocked}<Lock size={13} />{:else}<Unlock size={13} />{/if}
          </button>
        </div>
      </PropertyGroup>

      {#if selectedNode.type === 'note'}
        <PropertyGroup title="Note" bind:open={optionsOpen}>
          <div class="prop">
            <span class="prop-label"><Pencil size={14} />Mode</span>
            <div class="seg">
              <button type="button" class="seg-btn wide" class:active={data.viewMode !== 'view'} onclick={() => updateNodeData('viewMode', 'edit')}>
                <Pencil size={12} />Edit
              </button>
              <button type="button" class="seg-btn wide" class:active={data.viewMode === 'view'} onclick={() => updateNodeData('viewMode', 'view')}>
                <Eye size={12} />View
              </button>
            </div>
          </div>
        </PropertyGroup>
      {/if}

      {#if selectedNode.type === 'timestamp'}
        <PropertyGroup title="Timestamp" bind:open={optionsOpen}>
          <div class="prop">
            <span class="prop-label"><Calendar size={14} />Date</span>
            <input
              type="datetime-local"
              class="pp-control nodrag"
              value={data.customTimestamp ? new Date(data.customTimestamp).toISOString().slice(0, 16) : ''}
              onchange={(e) => {
                const value = (e.target as HTMLInputElement).value;
                updateNodeData('customTimestamp', value ? new Date(value).toISOString() : null);
              }}
            />
          </div>
          <p class="prop-hint">
            {#if data.customTimestamp}
              Fixed time · <button type="button" class="link-btn" onclick={() => updateNodeData('customTimestamp', null)}>Use live time</button>
            {:else}
              Showing live time
            {/if}
          </p>

          <div class="prop prop-top">
            <span class="prop-label"><Clock size={14} />Show</span>
            <div class="chips">
              {#each TIME_PARTS as [key, label, fallback] (key)}
                {@const on = (data[key] as boolean | undefined) ?? fallback}
                <button type="button" class="chip" class:active={on} aria-pressed={on} onclick={() => updateNodeData(key, !on)}>{label}</button>
              {/each}
            </div>
          </div>

          <label class="prop" title={data.use24HourFormat ? 'Shows 13:00, 14:30…' : 'Shows 1:00 PM, 2:30 PM…'}>
            <span class="prop-label"><Hash size={14} />24-hour clock</span>
            <span class="prop-value">
              <input
                type="checkbox"
                class="switch"
                checked={data.use24HourFormat ?? false}
                onchange={(e) => updateNodeData('use24HourFormat', (e.target as HTMLInputElement).checked)}
              />
            </span>
          </label>

          <label class="prop">
            <span class="prop-label"><AlignLeft size={14} />Multi-line</span>
            <span class="prop-value">
              <input
                type="checkbox"
                class="switch"
                checked={data.multiLine ?? false}
                onchange={(e) => updateNodeData('multiLine', (e.target as HTMLInputElement).checked)}
              />
            </span>
          </label>
        </PropertyGroup>
      {/if}

      {#if selectedNode.type === 'annotation'}
        <PropertyGroup title="Annotation" bind:open={optionsOpen}>
          <div class="prop">
            <span class="prop-label"><Baseline size={14} />Text</span>
            <span class="prop-value">
              <ColorInput value={data.textColor || '#999999'} onchange={(color) => updateNodeData('textColor', color)} size="sm" />
            </span>
          </div>

          <div class="prop">
            <span class="prop-label"><ArrowUpRight size={14} />Arrow</span>
            <select class="pp-control" value={data.arrowPosition || 'bottom-left'} onchange={(e) => updateNodeData('arrowPosition', (e.target as HTMLSelectElement).value)}>
              <option value="none">None</option>
              <option value="top-left">Top left ↖</option>
              <option value="top-right">Top right ↗</option>
              <option value="bottom-left">Bottom left ↙</option>
              <option value="bottom-right">Bottom right ↘</option>
              <option value="left">Left ←</option>
              <option value="right">Right →</option>
            </select>
          </div>

          <div class="prop">
            <span class="prop-label"><Spline size={14} />Shape</span>
            <div class="seg">
              <button type="button" class="seg-btn wide" class:active={data.arrowShape !== 'straight'} onclick={() => updateNodeData('arrowShape', 'curved')}>Curved</button>
              <button type="button" class="seg-btn wide" class:active={data.arrowShape === 'straight'} onclick={() => updateNodeData('arrowShape', 'straight')}>Straight</button>
            </div>
          </div>

          <div class="prop">
            <span class="prop-label"><RotateCw size={14} />Rotation</span>
            <select class="pp-control" value={data.arrowRotation || 0} onchange={(e) => updateNodeData('arrowRotation', parseInt((e.target as HTMLSelectElement).value))}>
              {#each [0, 45, 90, 135, 180, 225, 270, 315] as deg (deg)}
                <option value={deg}>{deg}°</option>
              {/each}
            </select>
          </div>

          <div class="prop">
            <span class="prop-label"><FlipHorizontal2 size={14} />Flip</span>
            <div class="seg">
              <button type="button" class="seg-btn" class:active={data.arrowFlipX} onclick={() => updateNodeData('arrowFlipX', !data.arrowFlipX)} title="Flip horizontally"><FlipHorizontal2 size={13} /></button>
              <button type="button" class="seg-btn" class:active={data.arrowFlipY} onclick={() => updateNodeData('arrowFlipY', !data.arrowFlipY)} title="Flip vertically"><FlipVertical2 size={13} /></button>
            </div>
          </div>

          <div class="prop">
            <span class="prop-label"><Type size={14} />Font size</span>
            <span class="prop-value">
              <label class="num" title="Leave empty to scale with the node size">
                <input
                  type="number"
                  min="8"
                  max="120"
                  placeholder="Auto"
                  value={data.fontSize ?? ''}
                  oninput={(e) => {
                    const size = parseInt((e.target as HTMLInputElement).value);
                    updateNodeData('fontSize', Number.isFinite(size) && size > 0 ? Math.min(size, 120) : undefined);
                  }}
                />
                <span class="unit">px</span>
              </label>
            </span>
          </div>

          <div class="prop">
            <span class="prop-label"><Type size={14} />Font</span>
            <select class="pp-control" value={data.fontFamily || 'mono'} onchange={(e) => updateNodeData('fontFamily', (e.target as HTMLSelectElement).value)}>
              <option value="mono">Mono</option>
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="hand">Handwritten</option>
            </select>
          </div>

          <div class="prop">
            <span class="prop-label"><Bold size={14} />Weight</span>
            <select class="pp-control" value={data.fontWeight || '400'} onchange={(e) => updateNodeData('fontWeight', (e.target as HTMLSelectElement).value)}>
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
            </select>
          </div>

          <div class="prop">
            <span class="prop-label"><Italic size={14} />Style</span>
            <div class="seg">
              <button type="button" class="seg-btn wide" class:active={data.fontStyle !== 'italic'} onclick={() => updateNodeData('fontStyle', 'normal')}>Normal</button>
              <button type="button" class="seg-btn wide" class:active={data.fontStyle === 'italic'} onclick={() => updateNodeData('fontStyle', 'italic')}><em>Italic</em></button>
            </div>
          </div>

          <div class="prop">
            <span class="prop-label"><AlignLeft size={14} />Align</span>
            <div class="seg">
              <button type="button" class="seg-btn" class:active={!data.textAlign || data.textAlign === 'left'} onclick={() => updateNodeData('textAlign', 'left')} title="Left"><AlignLeft size={13} /></button>
              <button type="button" class="seg-btn" class:active={data.textAlign === 'center'} onclick={() => updateNodeData('textAlign', 'center')} title="Center"><AlignCenter size={13} /></button>
              <button type="button" class="seg-btn" class:active={data.textAlign === 'right'} onclick={() => updateNodeData('textAlign', 'right')} title="Right"><AlignRight size={13} /></button>
            </div>
          </div>
        </PropertyGroup>
      {/if}

      {#if selectedNode.type === 'group'}
        <PropertyGroup title="Group" bind:open={optionsOpen}>
          {@const childNodes = workspace.getChildNodes(selectedNode.id)}
          <div class="prop">
            <span class="prop-label"><Text size={14} />Label</span>
            <input
              type="text"
              class="pp-control"
              value={data.label || 'Group'}
              placeholder="Group label"
              oninput={(e) => updateNodeData('label', (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="prop">
            <span class="prop-label"><Type size={14} />Font size</span>
            <span class="prop-value">
              <label class="num">
                <input
                  type="number"
                  min="10"
                  max="32"
                  value={data.fontSize ?? 14}
                  oninput={(e) => updateNodeData('fontSize', parseInt((e.target as HTMLInputElement).value) || 14)}
                />
                <span class="unit">px</span>
              </label>
            </span>
          </div>

          <div class="prop">
            <span class="prop-label"><Bold size={14} />Weight</span>
            <select class="pp-control" value={data.fontWeight || 'semibold'} onchange={(e) => updateNodeData('fontWeight', (e.target as HTMLSelectElement).value)}>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="semibold">Semibold</option>
              <option value="bold">Bold</option>
            </select>
          </div>

          <div class="prop">
            <span class="prop-label"><Italic size={14} />Style</span>
            <div class="seg">
              <button type="button" class="seg-btn wide" class:active={data.fontStyle !== 'italic'} onclick={() => updateNodeData('fontStyle', 'normal')}>Normal</button>
              <button type="button" class="seg-btn wide" class:active={data.fontStyle === 'italic'} onclick={() => updateNodeData('fontStyle', 'italic')}><em>Italic</em></button>
            </div>
          </div>

          <div class="sub-heading"><span>Contained nodes</span><span class="count">{childNodes.length}</span></div>
          {#each childNodes as child (child.id)}
            <label class="child-row" title="Keep inside the group bounds">
              <input
                type="checkbox"
                class="check"
                checked={child.extent === 'parent'}
                onchange={(e) => workspace.setNodeContained(child.id, (e.target as HTMLInputElement).checked)}
              />
              <span class="child-label">{String(child.data?.title || child.data?.label || child.type || child.id)}</span>
            </label>
          {:else}
            <p class="hint">No nodes inside this group.</p>
          {/each}
          {#if childNodes.length > 0}
            <p class="hint">Checked nodes stay within the group bounds.</p>
            <button class="row-btn" onclick={() => workspace.ungroupNode(selectedNode.id)}>
              <Ungroup size={14} />Ungroup nodes
            </button>
          {/if}
        </PropertyGroup>
      {/if}

      {#if selectedNode.type === 'hash' || selectedNode.type === 'credential' || selectedNode.type === 'domain'}
        <PropertyGroup title="Lookup" bind:open={lookupOpen}>
          {#if selectedNode.type === 'hash'}
            <button class="row-btn" onclick={() => { if (data.hash) openExternal(`https://www.virustotal.com/gui/search/${encodeURIComponent(data.hash)}`); }}>
              <ExternalLink size={14} />VirusTotal
            </button>
          {:else if selectedNode.type === 'credential'}
            <button class="row-btn" onclick={() => { if (data.email) openExternal(`https://haveibeenpwned.com/account/${encodeURIComponent(data.email)}`); }}>
              <ExternalLink size={14} />Have I Been Pwned
            </button>
          {:else}
            <button class="row-btn" onclick={() => { if (data.domain) openExternal(`https://who.is/whois/${encodeURIComponent(data.domain)}`); }}>
              <ExternalLink size={14} />WHOIS
            </button>
          {/if}
        </PropertyGroup>
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <StickyNote size={32} strokeWidth={1.25} />
      <p>Select a node or edge to view its properties</p>
    </div>
  {/if}
</div>

<style>
  .properties-panel {
    --label-w: 96px;
    width: 272px;
    height: 100vh;
    background: var(--mf-surface);
    border-left: 1px solid var(--mf-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    color: var(--mf-text);
    font-family: var(--mf-font-ui);
    font-size: 12.5px;
  }

  /* Header: type crumb + actions, then a page-style title */
  .pp-header {
    display: flex;
    flex-direction: column;
    padding: 0 10px;
  }

  .pp-header:has(.pp-title) {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--mf-border);
  }

  /* Same height as the canvas header so their dividers line up */
  .pp-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    margin: 0 -10px 6px;
    padding: 0 6px 0 12px;
    border-bottom: 1px solid var(--mf-border);
  }

  .pp-kind {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--mf-text-2);
  }

  .pp-kind.muted {
    color: var(--mf-text-3);
  }

  .pp-kind-icon {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
  }

  .pp-kind.edge .pp-kind-icon {
    background: rgba(163, 113, 247, 0.16);
    color: #b48cf7;
  }

  .pp-bar-actions {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text-3);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .icon-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .icon-btn.danger:hover {
    background: var(--mf-danger-soft);
    color: var(--mf-danger);
  }

  .icon-btn.on {
    color: var(--mf-accent);
  }

  .pp-title {
    width: 100%;
    margin: 0;
    padding: 2px 0;
    border: none;
    background: transparent;
    outline: none;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .pp-title::placeholder {
    color: var(--mf-text-3);
  }

  .pp-id-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .pp-id-row .pp-id:first-child {
    min-width: 0;
    flex: 0 1 auto;
  }

  .pp-copy-link {
    flex-shrink: 0;
    margin-left: auto !important;
    font-family: inherit !important;
  }

  .pp-locked {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    padding: 4px 8px;
    border-radius: 5px;
    background: rgba(245, 158, 11, 0.12);
    color: #f5b041;
    font-size: 11px;
  }

  .properties-panel.readonly :global(.panel-content :is(input, select, textarea, .seg, .pp-control, .tag-remove, [contenteditable])),
  .properties-panel.readonly .pp-title {
    pointer-events: none;
    opacity: 0.6;
  }

  .pp-id {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: calc(100% + 6px);
    height: 20px;
    margin-left: -6px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    font-family: var(--mf-font-mono);
    font-size: 10.5px;
    cursor: pointer;
  }

  .pp-id span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pp-id:hover {
    background: var(--mf-hover);
    color: var(--mf-text-2);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 2px 6px 16px;
    display: flex;
    flex-direction: column;
    scrollbar-width: thin;
  }

  /* Property rows: icon + label on the left, value on the right */
  .prop {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    align-items: center;
    column-gap: 4px;
    min-height: var(--mf-row);
    padding: 0 4px;
    border-radius: var(--mf-radius);
  }

  .prop:hover {
    background: var(--mf-hover);
  }

  label.prop {
    cursor: pointer;
  }

  .prop-top {
    align-items: start;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  .prop-block {
    grid-template-columns: 1fr;
    row-gap: 2px;
    padding-bottom: 4px;
  }

  .prop-label {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    height: 24px;
    font-size: 12px;
    color: var(--mf-text-2);
    white-space: nowrap;
    overflow: hidden;
  }

  .prop-label :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .prop-value {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding-left: 2px;
  }

  /* Borderless inputs that reveal themselves on hover/focus */
  .pp-control {
    width: 100%;
    height: 24px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background-color: transparent;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    outline: none;
    box-sizing: border-box;
    transition: background-color 0.12s, border-color 0.12s;
  }

  .pp-control::placeholder,
  .pp-textarea::placeholder,
  .tag-input::placeholder {
    color: var(--mf-text-3);
  }

  select.pp-control {
    appearance: none;
    padding-right: 20px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236e6e76' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
    cursor: pointer;
  }

  .pp-control:hover {
    background-color: var(--mf-active);
  }

  .pp-control:focus {
    background-color: var(--mf-surface-2);
    border-color: var(--mf-accent);
  }

  .pp-control::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }

  .pp-textarea {
    width: 100%;
    min-height: 60px;
    padding: 6px 8px;
    border: 1px solid var(--mf-border);
    border-radius: var(--mf-radius);
    background: var(--mf-surface-2);
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
  }

  .pp-textarea:focus {
    border-color: var(--mf-accent);
  }

  /* Compact numeric chip with unit/prefix */
  .num {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    width: 58px;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--mf-border);
    border-radius: 4px;
    background: var(--mf-surface-2);
    box-sizing: border-box;
    cursor: text;
    transition: border-color 0.12s;
  }

  .num:hover {
    border-color: var(--mf-border-strong);
  }

  .num:focus-within {
    border-color: var(--mf-accent);
  }

  .num.field {
    width: 100%;
  }

  .num.disabled {
    opacity: 0.5;
  }

  .num input {
    flex: 1;
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    outline: none;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .num input:disabled {
    cursor: not-allowed;
  }

  .num input::-webkit-inner-spin-button,
  .num input::-webkit-outer-spin-button,
  .pp-control::-webkit-inner-spin-button,
  .pp-control::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .num .unit,
  .num .prefix {
    flex-shrink: 0;
    font-size: 10.5px;
    color: var(--mf-text-3);
  }

  .num .prefix {
    width: 11px;
    font-weight: 500;
  }

  .xy-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 24px;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
  }

  /* Segmented control */
  .seg {
    display: inline-flex;
    justify-self: start;
    gap: 1px;
    padding: 2px;
    border: 1px solid var(--mf-border);
    border-radius: var(--mf-radius);
    background: var(--mf-surface-2);
  }

  .seg-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 26px;
    height: 20px;
    padding: 0 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
    font-family: inherit;
    font-size: 11.5px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .seg-btn:hover {
    color: var(--mf-text);
  }

  .seg-btn.active {
    background: var(--mf-active);
    color: var(--mf-text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }

  .seg-btn.wide {
    padding: 0 8px;
  }

  .seg :global(svg.flip) {
    transform: scaleX(-1);
  }

  /* Toggle switch */
  .switch {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    width: 26px;
    height: 15px;
    margin: 0;
    border-radius: 999px;
    background: var(--mf-active);
    cursor: pointer;
    transition: background 0.15s;
  }

  .switch::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #cfcfd4;
    transition: transform 0.15s;
  }

  .switch:checked {
    background: var(--mf-accent);
  }

  .switch:checked::before {
    transform: translateX(11px);
    background: #fff;
  }

  .switch:focus-visible,
  .check:focus-visible {
    outline: 2px solid var(--mf-accent);
    outline-offset: 2px;
  }

  /* Toggle chips */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 2px 0;
  }

  .chip {
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--mf-border);
    border-radius: 999px;
    background: transparent;
    color: var(--mf-text-3);
    font-family: inherit;
    font-size: 11.5px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .chip:hover {
    border-color: var(--mf-border-strong);
    color: var(--mf-text);
  }

  .chip.active {
    border-color: transparent;
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
  }

  /* Tags */
  .tag-field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    min-height: 24px;
    padding: 2px 0 2px 2px;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    height: 20px;
    border-radius: 4px;
    background: var(--mf-active);
    color: var(--mf-text-2);
    font-size: 11.5px;
    overflow: hidden;
  }

  .tag-pill.active {
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
  }

  .tag-name {
    height: 100%;
    padding: 0 6px;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .tag-x {
    display: grid;
    place-items: center;
    width: 16px;
    height: 100%;
    margin-left: -4px;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.55;
    cursor: pointer;
  }

  .tag-x:hover {
    opacity: 1;
  }

  .tag-input {
    flex: 1;
    min-width: 48px;
    height: 20px;
    padding: 0 2px;
    border: none;
    background: transparent;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12px;
    outline: none;
  }

  .sub-heading {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    margin-top: 4px;
    padding: 0 4px;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .sub-heading .count {
    padding: 0 5px;
    border-radius: 999px;
    background: var(--mf-active);
    color: var(--mf-text-2);
    font-size: 10px;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
  }

  /* List rows */
  .link-row,
  .row-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    height: var(--mf-row);
    padding: 0 4px;
    border: none;
    border-radius: var(--mf-radius);
    background: transparent;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }

  .row-btn {
    color: var(--mf-text-2);
  }

  .link-row:hover,
  .row-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .link-row :global(svg),
  .row-btn :global(svg) {
    flex-shrink: 0;
    color: var(--mf-text-3);
  }

  .link-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .link-row.unresolved .link-title {
    color: var(--mf-text-3);
    text-decoration: underline dashed;
    text-underline-offset: 3px;
  }

  .link-canvas {
    flex-shrink: 0;
    max-width: 45%;
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .hint,
  .prop-hint {
    margin: 0;
    padding: 2px 4px 4px;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--mf-text-3);
  }

  .prop-hint {
    padding-left: calc(var(--label-w) + 10px);
  }

  .link-btn {
    padding: 0;
    border: none;
    background: none;
    color: var(--mf-accent);
    font: inherit;
    cursor: pointer;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  /* Group children */
  .child-row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 26px;
    padding: 0 4px;
    border-radius: var(--mf-radius);
    font-size: 12px;
    color: var(--mf-text-2);
    cursor: pointer;
  }

  .child-row:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .child-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .check {
    appearance: none;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    margin: 0;
    border: 1px solid var(--mf-border-strong);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
  }

  .check:checked {
    border-color: var(--mf-accent);
    background: var(--mf-accent);
  }

  .check:checked::after {
    content: '';
    width: 7px;
    height: 4px;
    border-left: 1.5px solid #fff;
    border-bottom: 1.5px solid #fff;
    transform: translateY(-1px) rotate(-45deg);
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px;
    color: var(--mf-text-3);
    text-align: center;
  }

  .empty-state p {
    margin: 0;
    font-size: 12.5px;
  }

  /* Smaller, rounder colour swatches than the picker's default */
  .properties-panel :global(.color-swatch-btn) {
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    border-radius: 5px;
    border-color: var(--mf-border-strong);
  }

  .properties-panel :global(option) {
    background: var(--mf-surface-2);
    color: var(--mf-text);
  }
</style>
