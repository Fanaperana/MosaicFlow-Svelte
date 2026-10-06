<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import type { NodeType, MosaicEdge, MarkerShape, EdgeStrokeStyle } from '$lib/types';
  import { nodeRegistry, getIconByName } from '$lib/kernel/registries/node-registry';
  import { MarkerType } from '@xyflow/svelte';
  import { X, Copy, Trash2, StickyNote, Link2 as Link, ExternalLink, ChevronDown, ChevronRight, Lock, Unlock, Eye, Pencil, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type, Palette, Settings2, Move, Maximize2, Square, Minus, Circle, SquareRoundCorner } from 'lucide-svelte';
  import { ColorInput } from '$lib/components/ui/color-picker';
  import { IconButton } from '$lib/components/ui/icon-button';
  import { PropertyGroup } from '$lib/components/ui/property-group';
  import { PropertyRow } from '$lib/components/ui/property-row';
  import { NumberInput } from '$lib/components/ui/number-input';
  import FixedTooltip from '$lib/components/ui/FixedTooltip.svelte';
  import { openExternal } from '$lib/utils';

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
  let nodeSettingsOpen = $state(false);
  let appearanceOpen = $state(true);
  let optionsOpen = $state(true);
  let actionsOpen = $state(true);
  let fieldsOpen = $state(true);

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

  function fieldLabel(key: string): string {
    const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    return words.charAt(0).toUpperCase() + words.slice(1);
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="properties-panel"
  onclick={handlePanelEvent}
  onkeydown={handlePanelEvent}
  onmousedown={handlePanelEvent}
  onpointerdown={handlePanelEvent}
>
  <div class="panel-header">
    {#if selectedEdge}
      <span class="header-title"><span class="header-icon edge"><Link size={13} /></span>Edge</span>
    {:else if selectedNode}
      {@const info = getNodeTypeInfo(selectedNode.type)}
      {@const HeaderIcon = info ? getIconComponent(info.iconName) : StickyNote}
      <span class="header-title"><span class="header-icon"><HeaderIcon size={13} /></span>{info?.label || selectedNode.type}</span>
    {:else}
      <span class="header-title">Properties</span>
    {/if}
    <FixedTooltip text="Close" position="left">
      <button class="close-btn" onclick={onClose}>
        <X size={14} />
      </button>
    </FixedTooltip>
  </div>

  {#if selectedEdge}
    <!-- Edge Properties -->
    <div class="panel-content">
      <div class="section">
        <div class="section-header">General</div>
        
        <div class="field">
          <span>Label</span>
          <input 
            type="text" 
            value={selectedEdge.label || ''}
            oninput={(e) => {
              const label = (e.target as HTMLInputElement).value;
              updateEdge({ label: label || undefined });
            }}
            placeholder="Edge label..."
          />
        </div>

        <div class="field">
          <span>Edge Type</span>
          <select 
            value={selectedEdge.type || 'default'}
            onchange={(e) => {
              const edgeType = (e.target as HTMLSelectElement).value;
              // Map edge type to path type for GlowEdge
              const pathType = edgeType === 'default' ? 'bezier' : edgeType;
              // Use updateEdgeWithRefresh for immediate visual update
              workspace.updateEdgeWithRefresh(selectedEdge.id, { 
                type: edgeType as any,
                data: { ...selectedEdge.data, pathType: pathType as any }
              });
            }}
          >
            <option value="default">Bezier</option>
            <option value="straight">Straight</option>
            <option value="step">Step</option>
            <option value="smoothstep">Smooth Step</option>
          </select>
        </div>

        <label class="checkbox-row">
          <input 
            type="checkbox" 
            checked={selectedEdge.animated ?? false}
            onchange={(e) => updateEdge({ animated: (e.target as HTMLInputElement).checked })}
          />
          <span>Animated</span>
        </label>
      </div>

      <div class="section">
        <div class="section-header">Markers</div>
        
        <div class="field">
          <span>Start Marker</span>
          <select 
            value={selectedEdge.data?.markerStart || 'none'}
            onchange={(e) => {
              const value = (e.target as HTMLSelectElement).value as 'none' | 'arrow' | 'arrowclosed';
              applyMarkers(value, selectedEdge.data?.markerEnd || 'none');
            }}
          >
            <option value="none">None</option>
            <option value="arrow">Arrow</option>
            <option value="arrowclosed">Arrow (Filled)</option>
          </select>
        </div>

        <div class="field">
          <span>End Marker</span>
          <select 
            value={selectedEdge.data?.markerEnd || 'none'}
            onchange={(e) => {
              const value = (e.target as HTMLSelectElement).value as 'none' | 'arrow' | 'arrowclosed';
              applyMarkers(selectedEdge.data?.markerStart || 'none', value);
            }}
          >
            <option value="none">None</option>
            <option value="arrow">Arrow</option>
            <option value="arrowclosed">Arrow (Filled)</option>
          </select>
        </div>
      </div>

      <div class="section">
        <div class="section-header">Appearance</div>
        
        <!-- Notion-like Color Toolbar for Edge -->
        <div class="notion-toolbar">
          <FixedTooltip text="Line color" position="top">
            <div class="toolbar-group">
              <span class="toolbar-label">Line</span>
              <ColorInput 
              value={selectedEdge.data?.color || '#555555'}
              onchange={(color) => updateEdgeAppearance({ color })}
              size="sm"
              />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Line width (1-10px)" position="top">
            <div class="toolbar-group compact">
              <span class="toolbar-label">W</span>
            <input 
              type="number" 
              class="toolbar-input"
              value={selectedEdge.data?.strokeWidth || 2}
              oninput={(e) => {
                updateEdgeAppearance({ strokeWidth: parseInt((e.target as HTMLInputElement).value) || 2 });
              }}
              min="1"
              max="10"
            />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Line style" position="top">
            <div class="toolbar-group">
              <select 
              class="toolbar-select"
              value={selectedEdge.data?.strokeStyle || 'solid'}
              onchange={(e) => {
                updateEdgeAppearance({ strokeStyle: (e.target as HTMLSelectElement).value as EdgeStrokeStyle });
              }}
            >
              <option value="solid">━</option>
              <option value="dashed">┅</option>
              <option value="dotted">┈</option>
            </select>
            </div>
          </FixedTooltip>
        </div>

        <!-- Label Styling Toolbar -->
        <div class="notion-toolbar">
          <FixedTooltip text="Label text color" position="top">
            <div class="toolbar-group">
              <Type size={14} class="toolbar-icon" />
            <ColorInput 
              value={selectedEdge.data?.labelColor || '#ffffff'}
              onchange={(color) => updateEdgeData('labelColor', color)}
              size="sm"
            />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Label background color" position="top">
            <div class="toolbar-group">
              <span class="toolbar-label">BG</span>
            <ColorInput 
              value={selectedEdge.data?.labelBgColor || '#1a1d21'}
              onchange={(color) => updateEdgeData('labelBgColor', color)}
              size="sm"
            />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Label font size (8-24px)" position="top">
            <div class="toolbar-group compact">
              <span class="toolbar-label">Sz</span>
              <input 
                type="number" 
                class="toolbar-input"
                value={selectedEdge.data?.labelFontSize || 12}
                oninput={(e) => updateEdgeData('labelFontSize', parseInt((e.target as HTMLInputElement).value))}
                min="8"
                max="24"
              />
            </div>
          </FixedTooltip>
        </div>
      </div>

      <div class="section">
        <div class="section-header">Actions</div>
        <div class="action-buttons">
          <button class="action-btn danger full-width" onclick={deleteEdge}>
            <Trash2 size={14} />
            <span>Delete Edge</span>
          </button>
        </div>
      </div>
    </div>

  {:else if selectedNode}
    <div class="panel-content">
      <!-- General Section -->
      <PropertyGroup title="General" bind:open={generalOpen}>
        <div class="field">
          <span>Title</span>
          <input 
            type="text" 
            value={selectedNode.data.title || ''}
            oninput={(e) => updateNodeData('title', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="field">
          <span class="muted">ID</span>
          <input 
            type="text" 
            value={selectedNode.id}
            readonly
            class="readonly"
          />
        </div>
      </PropertyGroup>

      <!-- Type-specific fields, generated from the node plugin's schema -->
      {#if schemaFields.length > 0}
        <PropertyGroup title="Properties" bind:open={fieldsOpen}>
          {#each schemaFields as [key, field] (key)}
            {@const value = selectedNode.data[key]}
            {#if field.type === 'boolean'}
              <label class="checkbox-row" title={field.description}>
                <input type="checkbox" checked={!!value} onchange={(e) => updateNodeData(key, (e.target as HTMLInputElement).checked)} />
                <span>{fieldLabel(key)}</span>
              </label>
            {:else if field.type === 'markdown' || key === bodyField}
              <div class="field field-block" title={field.description}>
                <span>{fieldLabel(key)}</span>
                <textarea
                  rows="3"
                  value={typeof value === 'string' ? value : ''}
                  placeholder={field.description}
                  oninput={(e) => updateNodeData(key, (e.target as HTMLTextAreaElement).value)}
                ></textarea>
              </div>
            {:else}
              <div class="field" title={field.description}>
                <span>{fieldLabel(key)}</span>
                {#if field.type === 'enum'}
                  <select value={typeof value === 'string' ? value : ''} onchange={(e) => updateNodeData(key, (e.target as HTMLSelectElement).value)}>
                    <option value="">—</option>
                    {#each field.values ?? [] as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                {:else if field.type === 'number'}
                  <input
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
                    type="text"
                    value={Array.isArray(value) ? value.join(', ') : ''}
                    placeholder="a, b, c"
                    oninput={(e) => updateNodeData(key, (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean))}
                  />
                {:else}
                  <input
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

      <!-- Appearance Section -->
      <PropertyGroup title="Appearance" bind:open={appearanceOpen}>
        <!-- Notion-like Color Toolbar -->
        <div class="notion-toolbar">
          <FixedTooltip text="Background color" position="top">
            <div class="toolbar-group">
              <span class="toolbar-label">BG</span>
              <ColorInput 
                value={
                  selectedNode.type === 'simpleText' 
                    ? hexToRgba(
                        selectedNode.data.color || '#1a1d21', 
                        (selectedNode.data.bgOpacity as number) ?? 0
                      )
                    : selectedNode.data.color || (selectedNode.type === 'group' ? 'rgba(59, 130, 246, 0.05)' : '#1e1e1e')
                }
                onchange={(color, rgba) => {
                  if (selectedNode.type === 'simpleText' && rgba) {
                    // For SimpleText, extract hex and alpha separately
                    const parsed = parseRgba(color);
                    updateNodeData('color', parsed.hex);
                    updateNodeData('bgOpacity', parsed.alpha);
                  } else {
                    updateNodeData('color', color);
                  }
                }}
                size="sm"
              />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Border color" position="top">
            <div class="toolbar-group">
              <Square size={14} />
              <ColorInput 
              value={selectedNode.data.borderColor || (selectedNode.type === 'group' ? '#3b82f6' : '#333333')}
              onchange={(color) => updateNodeData('borderColor', color)}
              size="sm"
            />
            </div>
          </FixedTooltip>
          {#if selectedNode.type === 'group'}
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Label text color" position="top">
            <div class="toolbar-group">
              <Type size={14} />
            <ColorInput 
              value={(selectedNode.data as any).labelColor || selectedNode.data.borderColor || '#3b82f6'}
              onchange={(color) => updateNodeData('labelColor', color)}
              size="sm"
            />
            </div>
          </FixedTooltip>
          {:else if selectedNode.type !== 'image' && selectedNode.type !== 'annotation'}
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Text color" position="top">
            <div class="toolbar-group">
              <Type size={14} />
            <ColorInput 
              value={selectedNode.data.textColor || '#e0e0e0'}
              onchange={(color) => updateNodeData('textColor', color)}
              size="sm"
            />
            </div>
          </FixedTooltip>
          {/if}
        </div>

        <!-- Border Settings Toolbar -->
        <div class="notion-toolbar">
          <FixedTooltip text="Border width (0-10px)" position="top">
            <div class="toolbar-group compact">
              <span class="toolbar-label">W</span>
            <input 
              type="number" 
              class="toolbar-input"
              value={(selectedNode.data.borderWidth as number) ?? 1}
              oninput={(e) => updateNodeData('borderWidth', parseInt((e.target as HTMLInputElement).value) || 1)}
              min="0"
              max="10"
            />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Border radius (0-50px)" position="top">
            <div class="toolbar-group compact">
              <SquareRoundCorner size={14} />
            <input 
              type="number" 
              class="toolbar-input"
              value={(selectedNode.data.borderRadius as number) ?? 4}
              oninput={(e) => updateNodeData('borderRadius', parseInt((e.target as HTMLInputElement).value) || 0)}
              min="0"
              max="50"
            />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Border style" position="top">
            <div class="toolbar-group">
              <select 
              class="toolbar-select"
              value={(selectedNode.data.borderStyle as string) || 'solid'}
              onchange={(e) => updateNodeData('borderStyle', (e.target as HTMLSelectElement).value)}
            >
              <option value="solid">━</option>
              <option value="dashed">┅</option>
              <option value="dotted">┈</option>
              <option value="none">✕</option>
            </select>
            </div>
          </FixedTooltip>
        </div>

        <!-- Text Settings Toolbar (SimpleText only) -->
        {#if selectedNode.type === 'simpleText'}
        <div class="notion-toolbar">
          <FixedTooltip text="Font size" position="top">
            <div class="toolbar-group compact">
              <span class="toolbar-label">Aa</span>
              <input 
                type="number" 
                class="toolbar-input"
                value={(selectedNode.data.fontSize as number) ?? 14}
                oninput={(e) => updateNodeData('fontSize', parseInt((e.target as HTMLInputElement).value) || 14)}
                min="8"
                max="72"
              />
            </div>
          </FixedTooltip>
          <div class="toolbar-divider"></div>
          <FixedTooltip text="Text alignment" position="top">
            <div class="toolbar-group">
              <button 
                class="mode-btn"
                class:active={(selectedNode.data.textAlign as string) === 'left' || !(selectedNode.data.textAlign as string)}
                onclick={() => updateNodeData('textAlign', 'left')}
                type="button"
              >
                <AlignLeft size={14} />
              </button>
              <button 
                class="mode-btn"
                class:active={(selectedNode.data.textAlign as string) === 'center'}
                onclick={() => updateNodeData('textAlign', 'center')}
                type="button"
              >
                <AlignCenter size={14} />
              </button>
              <button 
                class="mode-btn"
                class:active={(selectedNode.data.textAlign as string) === 'right'}
                onclick={() => updateNodeData('textAlign', 'right')}
                type="button"
              >
                <AlignRight size={14} />
              </button>
            </div>
          </FixedTooltip>
        </div>
        {/if}

        {#if selectedNode.parentId}
          <label class="checkbox-row">
            <input 
              type="checkbox" 
              checked={selectedNode.extent === 'parent'}
              onchange={(e) => updateNodeExtent((e.target as HTMLInputElement).checked)}
            />
            <span>Contain within Group</span>
          </label>
        {/if}

        <label class="checkbox-row">
          <input 
            type="checkbox" 
            checked={selectedNode.data.showHeader ?? false}
            onchange={(e) => updateNodeData('showHeader', (e.target as HTMLInputElement).checked)}
          />
          <span>Show Header</span>
        </label>
      </PropertyGroup>

      <!-- Layout & Position Section -->
      <PropertyGroup title="Layout" bind:open={nodeSettingsOpen}>
        <div class="field-with-lock">
          <div class="field-row">
            <div class="field">
              <span class="muted">X</span>
              <input 
                type="number" 
                value={Math.round(selectedNode.position.x)}
                oninput={(e) => updateNodePosition('x', parseInt((e.target as HTMLInputElement).value))}
                disabled={selectedNode.data.locked}
              />
            </div>
            <div class="field">
              <span class="muted">Y</span>
              <input 
                type="number" 
                value={Math.round(selectedNode.position.y)}
                oninput={(e) => updateNodePosition('y', parseInt((e.target as HTMLInputElement).value))}
                disabled={selectedNode.data.locked}
              />
            </div>
          </div>
          <button 
            class="lock-btn" 
            onclick={() => updateNodeData('locked', !selectedNode.data.locked)}
            title={selectedNode.data.locked ? 'Unlock position' : 'Lock position'}
          >
            {#if selectedNode.data.locked}
              <Lock size={14} />
            {:else}
              <Unlock size={14} />
            {/if}
          </button>
        </div>

        <div class="field-with-lock">
          <div class="field-row">
            <div class="field">
              <span class="muted">W</span>
              <input 
                type="number" 
                value={selectedNode.width || 200}
                oninput={(e) => updateNodeSize('width', parseInt((e.target as HTMLInputElement).value))}
                disabled={selectedNode.data.sizeLocked}
                min="50"
              />
            </div>
            <div class="field">
              <span class="muted">H</span>
              <input 
                type="number" 
                value={selectedNode.height || 100}
                oninput={(e) => updateNodeSize('height', parseInt((e.target as HTMLInputElement).value))}
                disabled={selectedNode.data.sizeLocked}
                min="50"
              />
            </div>
          </div>
          <button 
            class="lock-btn" 
            onclick={() => updateNodeData('sizeLocked', !selectedNode.data.sizeLocked)}
            title={selectedNode.data.sizeLocked ? 'Unlock size' : 'Lock size'}
          >
            {#if selectedNode.data.sizeLocked}
              <Lock size={14} />
            {:else}
              <Unlock size={14} />
            {/if}
          </button>
        </div>
      </PropertyGroup>

      <!-- Note-specific Options -->
      {#if selectedNode.type === 'note'}
        <PropertyGroup title="Note Options" bind:open={optionsOpen}>
          <div class="field">
            <span>Mode</span>
            <div class="mode-toggle">
              <button 
                class="mode-btn" 
                class:active={(selectedNode.data as any).viewMode !== 'view'}
                onclick={() => updateNodeData('viewMode', 'edit')}
              >
                <Pencil size={14} />
                <span>Edit</span>
              </button>
              <button 
                class="mode-btn"
                class:active={(selectedNode.data as any).viewMode === 'view'}
                onclick={() => updateNodeData('viewMode', 'view')}
              >
                <Eye size={14} />
                <span>View</span>
              </button>
            </div>
          </div>
        </PropertyGroup>
      {/if}

      <!-- Timestamp-specific Options -->
      {#if selectedNode.type === 'timestamp'}
        <PropertyGroup title="Display Options" bind:open={optionsOpen}>
          <!-- Custom Timestamp Picker -->
          <div class="input-group">
            <span class="input-label">Custom Date/Time</span>
            <input 
              type="datetime-local" 
              class="datetime-input nodrag"
              value={(selectedNode.data as any).customTimestamp ? new Date((selectedNode.data as any).customTimestamp).toISOString().slice(0, 16) : ''}
              onchange={(e) => {
                const value = (e.target as HTMLInputElement).value;
                updateNodeData('customTimestamp', value ? new Date(value).toISOString() : null);
              }}
            />
            <span class="input-hint">Leave empty for live time</span>
            {#if (selectedNode.data as any).customTimestamp}
              <button 
                class="clear-btn"
                onclick={() => updateNodeData('customTimestamp', null)}
              >
                Use Live Time
              </button>
            {/if}
          </div>

          <div class="section-divider"></div>

          <label class="checkbox-row">
            <input 
              type="checkbox" 
              checked={(selectedNode.data as any).showHeader ?? false}
              onchange={(e) => updateNodeData('showHeader', (e.target as HTMLInputElement).checked)}
            />
            <span>Show Title</span>
          </label>

          <label class="checkbox-row">
            <input 
              type="checkbox" 
              checked={(selectedNode.data as any).multiLine ?? false}
              onchange={(e) => updateNodeData('multiLine', (e.target as HTMLInputElement).checked)}
            />
            <span>Multi-line Display</span>
          </label>

          <div class="section-divider"></div>

          <div class="checkbox-group">
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showMonth ?? true}
                onchange={(e) => updateNodeData('showMonth', (e.target as HTMLInputElement).checked)}
              />
              <span>Month</span>
            </label>
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showDay ?? true}
                onchange={(e) => updateNodeData('showDay', (e.target as HTMLInputElement).checked)}
              />
              <span>Day</span>
            </label>
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showYear ?? false}
                onchange={(e) => updateNodeData('showYear', (e.target as HTMLInputElement).checked)}
              />
              <span>Year</span>
            </label>
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showDayOfWeek ?? false}
                onchange={(e) => updateNodeData('showDayOfWeek', (e.target as HTMLInputElement).checked)}
              />
              <span>Day of Week</span>
            </label>
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showHour ?? true}
                onchange={(e) => updateNodeData('showHour', (e.target as HTMLInputElement).checked)}
              />
              <span>Hour</span>
            </label>
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showMinute ?? true}
                onchange={(e) => updateNodeData('showMinute', (e.target as HTMLInputElement).checked)}
              />
              <span>Minute</span>
            </label>
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showSecond ?? false}
                onchange={(e) => updateNodeData('showSecond', (e.target as HTMLInputElement).checked)}
              />
              <span>Second</span>
            </label>
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).showMillisecond ?? false}
                onchange={(e) => updateNodeData('showMillisecond', (e.target as HTMLInputElement).checked)}
              />
              <span>Millisecond</span>
            </label>
          </div>

          <!-- Time Format -->
          <div class="checkbox-group" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={(selectedNode.data as any).use24HourFormat ?? false}
                onchange={(e) => updateNodeData('use24HourFormat', (e.target as HTMLInputElement).checked)}
              />
              <span>24-Hour Format (Military Time)</span>
            </label>
            <div class="hint" style="font-size: 10px; color: #666; margin-left: 22px;">
              {(selectedNode.data as any).use24HourFormat ? 'Shows 13:00, 14:30, etc.' : 'Shows 1:00 PM, 2:30 PM, etc.'}
            </div>
          </div>
        </PropertyGroup>
      {/if}

      <!-- Annotation-specific Options -->
      {#if selectedNode.type === 'annotation'}
        <PropertyGroup title="Annotation Options" bind:open={optionsOpen}>
          <!-- Text Color -->
          <div class="field">
            <span>Text Color</span>
            <ColorInput 
              value={(selectedNode.data as any).textColor || '#999999'}
              onchange={(color) => updateNodeData('textColor', color)}
            />
          </div>

          <div class="section-divider"></div>

          <!-- Arrow Position -->
          <div class="field">
            <span>Arrow Position</span>
            <select 
              class="select-input"
              value={(selectedNode.data as any).arrowPosition || 'bottom-left'}
              onchange={(e) => updateNodeData('arrowPosition', (e.target as HTMLSelectElement).value)}
            >
              <option value="none">No Arrow</option>
              <option value="top-left">Top Left ↖</option>
              <option value="top-right">Top Right ↗</option>
              <option value="bottom-left">Bottom Left ↙</option>
              <option value="bottom-right">Bottom Right ↘</option>
              <option value="left">Left ←</option>
              <option value="right">Right →</option>
            </select>
          </div>

          <!-- Arrow Rotation -->
          <div class="field">
            <span>Arrow Rotation</span>
            <select 
              class="select-input"
              value={(selectedNode.data as any).arrowRotation || 0}
              onchange={(e) => updateNodeData('arrowRotation', parseInt((e.target as HTMLSelectElement).value))}
            >
              <option value={0}>0°</option>
              <option value={45}>45°</option>
              <option value={90}>90°</option>
              <option value={135}>135°</option>
              <option value={180}>180°</option>
              <option value={225}>225°</option>
              <option value={270}>270°</option>
              <option value={315}>315°</option>
            </select>
          </div>

          <!-- Arrow Flip -->
          <div class="field">
            <span>Arrow Flip</span>
            <div class="mode-toggle">
              <button 
                class="mode-btn" 
                class:active={(selectedNode.data as any).arrowFlipX}
                onclick={() => updateNodeData('arrowFlipX', !(selectedNode.data as any).arrowFlipX)}
              >
                <span>Flip X</span>
              </button>
              <button 
                class="mode-btn"
                class:active={(selectedNode.data as any).arrowFlipY}
                onclick={() => updateNodeData('arrowFlipY', !(selectedNode.data as any).arrowFlipY)}
              >
                <span>Flip Y</span>
              </button>
            </div>
          </div>

          <div class="section-divider"></div>

          <!-- Font Style -->
          <div class="field">
            <span>Font Weight</span>
            <select 
              class="select-input"
              value={(selectedNode.data as any).fontWeight || '400'}
              onchange={(e) => updateNodeData('fontWeight', (e.target as HTMLSelectElement).value)}
            >
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi Bold</option>
              <option value="700">Bold</option>
            </select>
          </div>

          <div class="field">
            <span>Font Style</span>
            <div class="mode-toggle">
              <button 
                class="mode-btn" 
                class:active={(selectedNode.data as any).fontStyle !== 'italic'}
                onclick={() => updateNodeData('fontStyle', 'normal')}
              >
                <span>Normal</span>
              </button>
              <button 
                class="mode-btn"
                class:active={(selectedNode.data as any).fontStyle === 'italic'}
                onclick={() => updateNodeData('fontStyle', 'italic')}
              >
                <span style="font-style: italic;">Italic</span>
              </button>
            </div>
          </div>

          <!-- Text Align -->
          <div class="field">
            <span>Text Align</span>
            <div class="mode-toggle">
              <button 
                class="mode-btn" 
                class:active={(selectedNode.data as any).textAlign === 'left' || !(selectedNode.data as any).textAlign}
                onclick={() => updateNodeData('textAlign', 'left')}
              >
                <span>Left</span>
              </button>
              <button 
                class="mode-btn"
                class:active={(selectedNode.data as any).textAlign === 'center'}
                onclick={() => updateNodeData('textAlign', 'center')}
              >
                <span>Center</span>
              </button>
              <button 
                class="mode-btn"
                class:active={(selectedNode.data as any).textAlign === 'right'}
                onclick={() => updateNodeData('textAlign', 'right')}
              >
                <span>Right</span>
              </button>
            </div>
          </div>
        </PropertyGroup>
      {/if}

      <!-- Group-specific Options -->
      {#if selectedNode.type === 'group'}
        <PropertyGroup title="Group Options" bind:open={optionsOpen}>
          <!-- Label -->
          <div class="input-group">
            <span class="input-label">Label</span>
            <input 
              type="text" 
              class="text-input"
              value={(selectedNode.data as any).label || 'Group'}
              oninput={(e) => updateNodeData('label', (e.target as HTMLInputElement).value)}
              placeholder="Group label"
            />
          </div>

          <!-- Font Settings -->
          <div class="subsection-header">Label Settings</div>

          <div class="input-group">
            <span class="input-label">Font Size</span>
            <input 
              type="number" 
              class="text-input"
              value={(selectedNode.data as any).fontSize ?? 14}
              oninput={(e) => updateNodeData('fontSize', parseInt((e.target as HTMLInputElement).value) || 14)}
              min="10"
              max="32"
            />
          </div>

          <div class="input-group">
            <span class="input-label">Font Weight</span>
            <select 
              class="select-input"
              value={(selectedNode.data as any).fontWeight || 'semibold'}
              onchange={(e) => updateNodeData('fontWeight', (e.target as HTMLSelectElement).value)}
            >
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="semibold">Semibold</option>
              <option value="bold">Bold</option>
            </select>
          </div>

          <div class="input-group">
            <span class="input-label">Font Style</span>
            <select 
              class="select-input"
              value={(selectedNode.data as any).fontStyle || 'normal'}
              onchange={(e) => updateNodeData('fontStyle', (e.target as HTMLSelectElement).value)}
            >
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </div>

          <div class="section-divider"></div>

          <!-- Contained Child Nodes -->
          {#if true}
            {@const childNodes = workspace.getChildNodes(selectedNode.id)}
            <div class="input-group">
              <span class="input-label">Contained Nodes ({childNodes.length})</span>
              {#if childNodes.length > 0}
                <div class="child-nodes-list">
                  {#each childNodes as childNode (childNode.id)}
                    <div class="child-node-item">
                      <label class="child-node-checkbox">
                        <input 
                          type="checkbox" 
                          checked={childNode.extent === 'parent'}
                          onchange={(e) => workspace.setNodeContained(childNode.id, (e.target as HTMLInputElement).checked)}
                        />
                        <span class="child-node-label" title={String(childNode.data?.label || childNode.id)}>
                          {childNode.data?.label || childNode.type || childNode.id}
                        </span>
                      </label>
                    </div>
                  {/each}
                </div>
                <div class="info-text" style="margin-top: 6px; font-size: 10px;">
                  Checked nodes stay within group bounds
                </div>
              {:else}
                <div class="info-text">No child nodes</div>
              {/if}
            </div>

            <!-- Ungroup Button -->
            {#if childNodes.length > 0}
              <button 
                class="action-btn secondary"
                onclick={() => workspace.ungroupNode(selectedNode.id)}
                style="width: 100%; margin-top: 8px;"
              >
                <span>Ungroup Nodes</span>
              </button>
            {/if}
          {/if}
        </PropertyGroup>
      {/if}

      <!-- Quick Actions -->
      {#if selectedNode.type === 'hash' || selectedNode.type === 'credential' || selectedNode.type === 'domain'}
        <div class="section">
          <div class="section-header">Quick Actions</div>
          <div class="quick-actions">
            {#if selectedNode.type === 'hash'}
              <button 
                class="quick-action-btn"
                onclick={() => {
                  const hash = (selectedNode.data as any).hash;
                  if (hash) openExternal(`https://www.virustotal.com/gui/search/${encodeURIComponent(hash)}`);
                }}
              >
                <ExternalLink size={14} /> VirusTotal Lookup
              </button>
            {/if}
            {#if selectedNode.type === 'credential'}
              <button 
                class="quick-action-btn"
                onclick={() => {
                  const email = (selectedNode.data as any).email;
                  if (email) openExternal(`https://haveibeenpwned.com/account/${encodeURIComponent(email)}`);
                }}
              >
                <ExternalLink size={14} /> HIBP Check
              </button>
            {/if}
            {#if selectedNode.type === 'domain'}
              <button 
                class="quick-action-btn"
                onclick={() => {
                  const domain = (selectedNode.data as any).domain;
                  if (domain) openExternal(`https://who.is/whois/${encodeURIComponent(domain)}`);
                }}
              >
                <ExternalLink size={14} /> WHOIS Lookup
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="section">
        <div class="section-header">Actions</div>
        <div class="action-buttons">
          <button class="action-btn secondary" onclick={duplicateNode}>
            <Copy size={14} />
            <span>Duplicate</span>
          </button>
          <button class="action-btn danger" onclick={deleteNode}>
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <StickyNote size={40} strokeWidth={1} />
      <p>Select a node or edge to view its properties</p>
    </div>
  {/if}
</div>

<style>
  .properties-panel {
    width: 264px;
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

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 8px 0 12px;
    border-bottom: 1px solid var(--mf-border);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--mf-text);
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: var(--mf-accent-soft);
    color: var(--mf-accent);
  }

  .header-icon.edge {
    background: rgba(163, 113, 247, 0.16);
    color: #b48cf7;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--mf-radius);
    color: var(--mf-text-3);
    cursor: pointer;
  }

  .close-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 6px 12px;
    display: flex;
    flex-direction: column;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
    border-top: 1px solid var(--mf-border);
  }

  .section:first-child {
    border-top: none;
  }

  .section-header {
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 6px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--mf-text-3);
  }

  /* Notion-style property rows: label left, value right */
  .field,
  .input-group {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    align-items: center;
    column-gap: 6px;
    min-height: var(--mf-row);
    padding: 0 6px;
    border-radius: 4px;
  }

  .input-group > :nth-child(n + 3) {
    grid-column: 1 / -1;
  }

  .field:hover,
  .input-group:hover {
    background: var(--mf-hover);
  }

  .field > span,
  .input-label {
    font-size: 12px;
    color: var(--mf-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .field > span.muted {
    color: var(--mf-text-3);
  }

  .field input[type="text"],
  .field input[type="number"],
  .field select,
  .select-input,
  .text-input,
  .datetime-input {
    width: 100%;
    height: 24px;
    padding: 0 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    outline: none;
    box-sizing: border-box;
  }

  .field select,
  .select-input {
    cursor: pointer;
  }

  .field input:hover,
  .field select:hover,
  .select-input:hover,
  .text-input:hover,
  .datetime-input:hover {
    background: var(--mf-surface-2);
  }

  .field input:focus,
  .field select:focus,
  .select-input:focus,
  .text-input:focus,
  .datetime-input:focus {
    background: var(--mf-surface-2);
    border-color: var(--mf-accent);
  }

  .field input.readonly {
    font-family: var(--mf-font-mono);
    font-size: 10.5px;
    color: var(--mf-text-3);
    cursor: text;
  }

  .field input:disabled {
    color: var(--mf-text-3);
    cursor: not-allowed;
  }

  .field-block {
    grid-template-columns: 1fr;
    row-gap: 2px;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .field-block textarea {
    width: 100%;
    min-height: 56px;
    padding: 4px 6px;
    background: transparent;
    border: 1px solid var(--mf-border);
    border-radius: 4px;
    color: var(--mf-text);
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1.45;
    resize: vertical;
    outline: none;
  }

  .field-block textarea:focus {
    background: var(--mf-surface-2);
    border-color: var(--mf-accent);
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
  }

  .field-row .field {
    grid-template-columns: 14px minmax(0, 1fr);
    padding: 0 2px 0 6px;
  }

  .field-with-lock {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .field-with-lock .field-row {
    flex: 1;
  }

  .lock-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--mf-text-3);
    cursor: pointer;
    flex-shrink: 0;
  }

  .lock-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  /* Toggle rows: label left, switch right */
  .checkbox-row {
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: var(--mf-row);
    padding: 0 6px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--mf-text-2);
    cursor: pointer;
  }

  .checkbox-row:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .checkbox-row input[type="checkbox"],
  .child-node-checkbox input[type="checkbox"] {
    appearance: none;
    position: relative;
    width: 26px;
    height: 15px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--mf-active);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .checkbox-row input[type="checkbox"]::before,
  .child-node-checkbox input[type="checkbox"]::before {
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

  .checkbox-row input[type="checkbox"]:checked,
  .child-node-checkbox input[type="checkbox"]:checked {
    background: var(--mf-accent);
  }

  .checkbox-row input[type="checkbox"]:checked::before,
  .child-node-checkbox input[type="checkbox"]:checked::before {
    transform: translateX(11px);
    background: #fff;
  }

  .checkbox-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 2px;
  }

  .mode-toggle {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--mf-surface-2);
    border-radius: var(--mf-radius);
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 22px;
    padding: 0 6px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--mf-text-3);
    font-size: 11.5px;
    cursor: pointer;
  }

  .mode-btn:hover {
    color: var(--mf-text);
  }

  .mode-btn.active {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .quick-actions,
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .quick-action-btn,
  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: var(--mf-row);
    padding: 0 6px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--mf-text-2);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }

  .quick-action-btn :global(svg),
  .action-btn :global(svg) {
    color: var(--mf-text-3);
  }

  .quick-action-btn:hover,
  .action-btn:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .action-btn.danger,
  .action-btn.danger :global(svg) {
    color: var(--mf-danger);
  }

  .action-btn.danger:hover {
    background: var(--mf-danger-soft);
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--mf-text-3);
    text-align: center;
    padding: 32px;
    gap: 10px;
  }

  .empty-state p {
    margin: 0;
    font-size: 12.5px;
  }

  .section-divider {
    height: 1px;
    background: var(--mf-border);
    margin: 4px 6px;
  }

  .datetime-input::-webkit-calendar-picker-indicator {
    filter: invert(0.8);
    cursor: pointer;
  }

  .input-hint,
  .hint {
    font-size: 11px;
    color: var(--mf-text-3);
    padding: 0 6px;
  }

  .clear-btn {
    justify-self: start;
    height: 22px;
    padding: 0 8px;
    background: var(--mf-accent-soft);
    border: none;
    border-radius: 4px;
    color: var(--mf-accent);
    font-size: 11.5px;
    cursor: pointer;
  }

  .clear-btn:hover {
    filter: brightness(1.15);
  }

  .subsection-header {
    padding: 6px 6px 2px;
    font-size: 11px;
    color: var(--mf-text-3);
  }

  .child-nodes-list {
    grid-column: 1 / -1;
    max-height: 140px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .child-node-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    padding: 0 4px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--mf-text-2);
    cursor: pointer;
  }

  .child-node-checkbox:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .child-node-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .info-text {
    grid-column: 1 / -1;
    font-size: 11.5px;
    color: var(--mf-text-3);
    padding: 2px 6px;
  }

  /* Notion-like Toolbar Styles */
  .notion-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    min-height: var(--mf-row);
    padding: 0 6px;
    border-radius: 4px;
  }

  .notion-toolbar:hover {
    background: var(--mf-hover);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .toolbar-group.compact {
    gap: 3px;
  }

  .toolbar-label {
    font-size: 11px;
    color: var(--mf-text-3);
    min-width: 14px;
  }

  .toolbar-group :global(svg) {
    color: var(--mf-text-3);
    flex-shrink: 0;
  }

  .toolbar-divider {
    width: 1px;
    height: 14px;
    background: var(--mf-border-strong);
    margin: 0 5px;
  }

  .toolbar-input {
    width: 34px;
    height: 22px;
    padding: 0 4px;
    background: transparent;
    border: 1px solid var(--mf-border);
    border-radius: 4px;
    color: var(--mf-text);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    outline: none;
  }

  .toolbar-input:focus {
    border-color: var(--mf-accent);
  }

  .toolbar-input::-webkit-inner-spin-button,
  .toolbar-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .toolbar-input[type=number] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .toolbar-select {
    height: 22px;
    padding: 0 4px;
    background: transparent;
    border: 1px solid var(--mf-border);
    border-radius: 4px;
    color: var(--mf-text);
    font-size: 12px;
    outline: none;
    cursor: pointer;
    min-width: 34px;
  }

  .toolbar-select:focus {
    border-color: var(--mf-accent);
  }

  .properties-panel :global(option) {
    background: var(--mf-surface-2);
    color: var(--mf-text);
  }
</style>
