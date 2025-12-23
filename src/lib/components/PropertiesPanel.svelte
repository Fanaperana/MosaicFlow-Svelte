<script lang="ts">
  import { workspace } from '$lib/stores/workspace.svelte';
  import type { NodeType, MosaicEdge, MarkerShape, EdgeStrokeStyle } from '$lib/types';
  import { NODE_TYPE_INFO } from '$lib/types';
  import { MarkerType } from '@xyflow/svelte';
  import { X, Copy, Trash2, StickyNote, Image, Link, Code, Clock, User, Building2, Globe, FileDigit, KeyRound, MessageSquare, Router, Camera, FolderOpen, MapPin, List, CheckSquare, ExternalLink, ChevronDown, ChevronRight, Lock, Unlock, Eye, Pencil } from 'lucide-svelte';

  interface Props {
    onClose: () => void;
  }
  
  let { onClose }: Props = $props();

  // Accordion states
  let nodeSettingsOpen = $state(false);
  let appearanceOpen = $state(true);
  let optionsOpen = $state(true);

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

  const iconMap: Record<string, typeof StickyNote> = {
    StickyNote, Image, Link, Code, Clock, User, Building2, Globe,
    FileDigit, KeyRound, MessageSquare, Router, Camera, FolderOpen, MapPin, List, CheckSquare,
  };

  function getIconComponent(iconName: string) {
    return iconMap[iconName] || StickyNote;
  }

  function getNodeTypeInfo(type: string) {
    return NODE_TYPE_INFO.find(info => info.type === type);
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
      workspace.updateEdge(selectedEdge.id, updates);
    }
  }

  function updateEdgeData(key: string, value: unknown) {
    if (selectedEdge) {
      const currentData = selectedEdge.data || {};
      workspace.updateEdge(selectedEdge.id, { 
        data: { ...currentData, [key]: value } 
      });
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
      const markerStart = getMarkerConfig(startMarker, color);
      const markerEnd = getMarkerConfig(endMarker, color);
      
      // Use updateEdgeWithRefresh for immediate visual update
      workspace.updateEdgeWithRefresh(selectedEdge.id, { markerStart, markerEnd });
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
      const newPosition = {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 50,
      };
      workspace.createNode(selectedNode.type as NodeType, newPosition, { ...selectedNode.data });
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
    
    // Update data fields
    if (updates.color !== undefined) updateEdgeData('color', color);
    if (updates.strokeWidth !== undefined) updateEdgeData('strokeWidth', width);
    if (updates.strokeStyle !== undefined) updateEdgeData('strokeStyle', strokeStyle);
    
    // Update style string
    updateEdge({ style: getEdgeStyleString(color, width, strokeStyle) });
    
    // Update marker colors if needed
    if (updates.color !== undefined) {
      applyMarkers(selectedEdge.data?.markerStart || 'none', selectedEdge.data?.markerEnd || 'none');
    }
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
    <h3>Properties</h3>
    <button class="close-btn" onclick={onClose}>
      <X size={16} />
    </button>
  </div>

  {#if selectedEdge}
    <!-- Edge Properties -->
    <div class="panel-content">
      <div class="node-badge edge-badge">
        <Link size={16} />
        <span>Edge</span>
      </div>

      <div class="section">
        <div class="section-header">General</div>
        
        <div class="field">
          <label>Label</label>
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
          <label>Edge Type</label>
          <select 
            value={selectedEdge.type || 'default'}
            onchange={(e) => {
              const edgeType = (e.target as HTMLSelectElement).value;
              // Map edge type to path type for GlowEdge
              const pathType = edgeType === 'default' ? 'bezier' : edgeType;
              // Use updateEdgeWithRefresh for immediate visual update
              workspace.updateEdgeWithRefresh(selectedEdge.id, { 
                type: edgeType as any,
                data: { ...selectedEdge.data, pathType }
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
          <label>Start Marker</label>
          <select 
            value={selectedEdge.data?.markerStart || 'none'}
            onchange={(e) => {
              const value = (e.target as HTMLSelectElement).value as 'none' | 'arrow' | 'arrowclosed';
              updateEdgeData('markerStart', value);
              applyMarkers(value, selectedEdge.data?.markerEnd || 'none');
            }}
          >
            <option value="none">None</option>
            <option value="arrow">Arrow</option>
            <option value="arrowclosed">Arrow (Filled)</option>
          </select>
        </div>

        <div class="field">
          <label>End Marker</label>
          <select 
            value={selectedEdge.data?.markerEnd || 'none'}
            onchange={(e) => {
              const value = (e.target as HTMLSelectElement).value as 'none' | 'arrow' | 'arrowclosed';
              updateEdgeData('markerEnd', value);
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
        
        <div class="field">
          <label>Edge Color</label>
          <div class="color-row">
            <input 
              type="color" 
              value={selectedEdge.data?.color || '#555555'}
              oninput={(e) => {
                updateEdgeAppearance({ color: (e.target as HTMLInputElement).value });
              }}
              class="color-picker"
            />
            <input 
              type="text" 
              value={selectedEdge.data?.color || '#555555'}
              oninput={(e) => {
                updateEdgeAppearance({ color: (e.target as HTMLInputElement).value });
              }}
              class="color-text"
            />
          </div>
        </div>

        <div class="field">
          <label>Stroke Width</label>
          <input 
            type="number" 
            value={selectedEdge.data?.strokeWidth || 2}
            oninput={(e) => {
              updateEdgeAppearance({ strokeWidth: parseInt((e.target as HTMLInputElement).value) || 2 });
            }}
            min="1"
            max="10"
          />
        </div>

        <div class="field">
          <label>Stroke Style</label>
          <select 
            value={selectedEdge.data?.strokeStyle || 'solid'}
            onchange={(e) => {
              updateEdgeAppearance({ strokeStyle: (e.target as HTMLSelectElement).value as EdgeStrokeStyle });
            }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>

        <div class="field">
          <label>Label Color</label>
          <div class="color-row">
            <input 
              type="color" 
              value={selectedEdge.data?.labelColor || '#ffffff'}
              oninput={(e) => updateEdgeData('labelColor', (e.target as HTMLInputElement).value)}
              class="color-picker"
            />
            <input 
              type="text" 
              value={selectedEdge.data?.labelColor || '#ffffff'}
              oninput={(e) => updateEdgeData('labelColor', (e.target as HTMLInputElement).value)}
              class="color-text"
            />
          </div>
        </div>

        <div class="field">
          <label>Label Background</label>
          <div class="color-row">
            <input 
              type="color" 
              value={selectedEdge.data?.labelBgColor || '#1a1d21'}
              oninput={(e) => updateEdgeData('labelBgColor', (e.target as HTMLInputElement).value)}
              class="color-picker"
            />
            <input 
              type="text" 
              value={selectedEdge.data?.labelBgColor || '#1a1d21'}
              oninput={(e) => updateEdgeData('labelBgColor', (e.target as HTMLInputElement).value)}
              class="color-text"
            />
          </div>
        </div>

        <div class="field">
          <label>Label Font Size</label>
          <input 
            type="number" 
            value={selectedEdge.data?.labelFontSize || 12}
            oninput={(e) => updateEdgeData('labelFontSize', parseInt((e.target as HTMLInputElement).value))}
            min="8"
            max="24"
          />
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
    {@const typeInfo = getNodeTypeInfo(selectedNode.type)}
    {@const IconComponent = typeInfo ? getIconComponent(typeInfo.icon) : StickyNote}
    
    <div class="panel-content">
      <!-- Node Type Badge -->
      <div class="node-badge">
        <IconComponent size={16} />
        <span>{typeInfo?.label || selectedNode.type}</span>
      </div>

      <!-- General Section -->
      <div class="section">
        <div class="section-header">General</div>
        
        <div class="field">
          <label>Title</label>
          <input 
            type="text" 
            value={selectedNode.data.title || ''}
            oninput={(e) => updateNodeData('title', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="field">
          <label class="muted">ID</label>
          <input 
            type="text" 
            value={selectedNode.id}
            readonly
            class="readonly"
          />
        </div>
      </div>

      <!-- Appearance Section (Accordion) -->
      <div class="section accordion">
        <button class="accordion-header" onclick={() => appearanceOpen = !appearanceOpen}>
          {#if appearanceOpen}
            <ChevronDown size={14} />
          {:else}
            <ChevronRight size={14} />
          {/if}
          <span>Appearance</span>
        </button>
        
        {#if appearanceOpen}
          <div class="accordion-content">
            <div class="field">
              <label>Background</label>
              <div class="color-row">
                <input 
                  type="color" 
                  value={selectedNode.data.color || '#1e1e1e'}
                  oninput={(e) => updateNodeData('color', (e.target as HTMLInputElement).value)}
                  class="color-picker"
                />
                <input 
                  type="text" 
                  value={selectedNode.data.color || '#1e1e1e'}
                  oninput={(e) => updateNodeData('color', (e.target as HTMLInputElement).value)}
                  class="color-text"
                />
              </div>
            </div>

            <div class="field">
              <label>Background Opacity</label>
              <div class="slider-row">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={((selectedNode.data.bgOpacity ?? 1) * 100)}
                  oninput={(e) => updateNodeData('bgOpacity', parseInt((e.target as HTMLInputElement).value) / 100)}
                  class="slider"
                />
                <span class="slider-value">{Math.round((selectedNode.data.bgOpacity ?? 1) * 100)}%</span>
              </div>
            </div>

            <div class="field">
              <label>Border Color</label>
              <div class="color-row">
                <input 
                  type="color" 
                  value={selectedNode.data.borderColor || '#333333'}
                  oninput={(e) => updateNodeData('borderColor', (e.target as HTMLInputElement).value)}
                  class="color-picker"
                />
                <input 
                  type="text" 
                  value={selectedNode.data.borderColor || '#333333'}
                  oninput={(e) => updateNodeData('borderColor', (e.target as HTMLInputElement).value)}
                  class="color-text"
                />
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label>Border Width</label>
                <input 
                  type="number" 
                  value={(selectedNode.data.borderWidth as number) ?? 1}
                  oninput={(e) => updateNodeData('borderWidth', parseInt((e.target as HTMLInputElement).value) || 1)}
                  min="0"
                  max="10"
                />
              </div>
              <div class="field">
                <label>Border Radius</label>
                <input 
                  type="number" 
                  value={(selectedNode.data.borderRadius as number) ?? 4}
                  oninput={(e) => updateNodeData('borderRadius', parseInt((e.target as HTMLInputElement).value) || 0)}
                  min="0"
                  max="50"
                />
              </div>
            </div>

            {#if selectedNode.parentId}
              <div class="field">
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={selectedNode.extent === 'parent'}
                    onchange={(e) => updateNodeExtent((e.target as HTMLInputElement).checked)}
                  />
                  <span>Contain within Group</span>
                </label>
              </div>
            {/if}

            <div class="field">
              <label>Border Style</label>
              <select 
                value={(selectedNode.data.borderStyle as string) || 'solid'}
                onchange={(e) => updateNodeData('borderStyle', (e.target as HTMLSelectElement).value)}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="none">None</option>
              </select>
            </div>

            {#if selectedNode.type !== 'image' && selectedNode.type !== 'annotation'}
            <div class="field">
              <label>Text Color</label>
              <div class="color-row">
                <input 
                  type="color" 
                  value={selectedNode.data.textColor || '#e0e0e0'}
                  oninput={(e) => updateNodeData('textColor', (e.target as HTMLInputElement).value)}
                  class="color-picker"
                />
                <input 
                  type="text" 
                  value={selectedNode.data.textColor || '#e0e0e0'}
                  oninput={(e) => updateNodeData('textColor', (e.target as HTMLInputElement).value)}
                  class="color-text"
                />
              </div>
            </div>
            {/if}

            <label class="checkbox-row">
              <input 
                type="checkbox" 
                checked={selectedNode.data.showHeader ?? false}
                onchange={(e) => updateNodeData('showHeader', (e.target as HTMLInputElement).checked)}
              />
              <span>Show Header</span>
            </label>
          </div>
        {/if}
      </div>

      <!-- Node Settings Section (Accordion) -->
      <div class="section accordion">
        <button class="accordion-header" onclick={() => nodeSettingsOpen = !nodeSettingsOpen}>
          {#if nodeSettingsOpen}
            <ChevronDown size={14} />
          {:else}
            <ChevronRight size={14} />
          {/if}
          <span>Node Settings</span>
        </button>
        
        {#if nodeSettingsOpen}
          <div class="accordion-content">
            <div class="field-with-lock">
              <div class="field-row">
                <div class="field">
                  <label class="muted">X</label>
                  <input 
                    type="number" 
                    value={Math.round(selectedNode.position.x)}
                    oninput={(e) => updateNodePosition('x', parseInt((e.target as HTMLInputElement).value))}
                    disabled={selectedNode.data.locked}
                  />
                </div>
                <div class="field">
                  <label class="muted">Y</label>
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
                  <label class="muted">Width</label>
                  <input 
                    type="number" 
                    value={selectedNode.width || 200}
                    oninput={(e) => updateNodeSize('width', parseInt((e.target as HTMLInputElement).value))}
                    disabled={selectedNode.data.sizeLocked}
                    min="50"
                  />
                </div>
                <div class="field">
                  <label class="muted">Height</label>
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
          </div>
        {/if}
      </div>

      <!-- Note-specific Options -->
      {#if selectedNode.type === 'note'}
        <div class="section accordion">
          <button class="accordion-header" onclick={() => optionsOpen = !optionsOpen}>
            {#if optionsOpen}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
            <span>Note Options</span>
          </button>
          
          {#if optionsOpen}
            <div class="accordion-content">
              <div class="field">
                <label>Mode</label>
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
            </div>
          {/if}
        </div>
      {/if}

      <!-- Timestamp-specific Options -->
      {#if selectedNode.type === 'timestamp'}
        <div class="section accordion">
          <button class="accordion-header" onclick={() => optionsOpen = !optionsOpen}>
            {#if optionsOpen}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
            <span>Display Options</span>
          </button>
          
          {#if optionsOpen}
            <div class="accordion-content">
              <!-- Custom Timestamp Picker -->
              <div class="input-group">
                <label class="input-label">Custom Date/Time</label>
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
          {/if}
        </div>
      {/if}

      <!-- Annotation-specific Options -->
      {#if selectedNode.type === 'annotation'}
        <div class="section accordion">
          <button class="accordion-header" onclick={() => optionsOpen = !optionsOpen}>
            {#if optionsOpen}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
            <span>Annotation Options</span>
          </button>
          
          {#if optionsOpen}
            <div class="accordion-content">
              <!-- Text Color -->
              <div class="field">
                <label>Text Color</label>
                <div class="color-row">
                  <input 
                    type="color" 
                    class="color-picker"
                    value={(selectedNode.data as any).textColor || '#999999'}
                    oninput={(e) => updateNodeData('textColor', (e.target as HTMLInputElement).value)}
                  />
                  <input 
                    type="text" 
                    class="color-text"
                    value={(selectedNode.data as any).textColor || '#999999'}
                    oninput={(e) => updateNodeData('textColor', (e.target as HTMLInputElement).value)}
                    placeholder="#999999"
                  />
                </div>
              </div>

              <div class="section-divider"></div>

              <!-- Arrow Position -->
              <div class="field">
                <label>Arrow Position</label>
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
                <label>Arrow Rotation</label>
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
                <label>Arrow Flip</label>
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
                <label>Font Weight</label>
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
                <label>Font Style</label>
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
                <label>Text Align</label>
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
            </div>
          {/if}
        </div>
      {/if}

      <!-- Group-specific Options -->
      {#if selectedNode.type === 'group'}
        <div class="section accordion">
          <button class="accordion-header" onclick={() => optionsOpen = !optionsOpen}>
            {#if optionsOpen}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
            <span>Group Options</span>
          </button>
          
          {#if optionsOpen}
            <div class="accordion-content">
              <!-- Label -->
              <div class="input-group">
                <label class="input-label">Label</label>
                <input 
                  type="text" 
                  class="text-input"
                  value={(selectedNode.data as any).label || 'Group'}
                  oninput={(e) => updateNodeData('label', (e.target as HTMLInputElement).value)}
                  placeholder="Group label"
                />
              </div>

              <div class="section-divider"></div>

              <!-- Font Settings -->
              <div class="subsection-header">Font Settings</div>
              
              <div class="input-group">
                <label class="input-label">Label Color</label>
                <div class="color-input-row">
                  <input 
                    type="color" 
                    class="color-input"
                    value={(selectedNode.data as any).labelColor || '#c4b5fd'}
                    oninput={(e) => updateNodeData('labelColor', (e.target as HTMLInputElement).value)}
                  />
                  <input 
                    type="text" 
                    class="color-text-input"
                    value={(selectedNode.data as any).labelColor || '#c4b5fd'}
                    oninput={(e) => updateNodeData('labelColor', (e.target as HTMLInputElement).value)}
                  />
                </div>
              </div>

              <div class="input-group">
                <label class="input-label">Font Size</label>
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
                <label class="input-label">Font Weight</label>
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
                <label class="input-label">Font Style</label>
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
                  <label class="input-label">Contained Nodes ({childNodes.length})</label>
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
            </div>
          {/if}
        </div>
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
                  if (hash) window.open(`https://www.virustotal.com/gui/search/${hash}`, '_blank');
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
                  if (email) window.open(`https://haveibeenpwned.com/account/${email}`, '_blank');
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
                  if (domain) window.open(`https://who.is/whois/${domain}`, '_blank');
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
    width: 280px;
    height: 100vh;
    background: #0d1117;
    border-left: 1px solid #21262d;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    color: #c9d1d9;
    font-family: 'Space Mono', monospace;
    font-size: 12px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 36px;
    border-bottom: 1px solid #21262d;
    background: #0d1117;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #f0f6fc;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #8b949e;
    cursor: pointer;
  }

  .close-btn:hover {
    background: #21262d;
    color: #f0f6fc;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .node-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(56, 139, 253, 0.15);
    border: 1px solid rgba(56, 139, 253, 0.4);
    border-radius: 4px;
    color: #58a6ff;
    font-weight: 500;
  }

  .edge-badge {
    background: rgba(163, 113, 247, 0.15);
    border-color: rgba(163, 113, 247, 0.4);
    color: #a371f7;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #8b949e;
    padding-bottom: 6px;
    border-bottom: 1px solid #21262d;
  }

  .accordion-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid #21262d;
    color: #8b949e;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    text-align: left;
  }

  .accordion-header:hover {
    color: #c9d1d9;
  }

  .accordion-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 10px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 11px;
    color: #c9d1d9;
  }

  .field label.muted {
    color: #8b949e;
  }

  .field input[type="text"],
  .field input[type="number"] {
    width: 100%;
    padding: 6px 10px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    outline: none;
    box-sizing: border-box;
  }

  .field input:focus {
    border-color: #58a6ff;
  }

  .field input.readonly,
  .field input:disabled {
    background: #0d1117;
    color: #8b949e;
    cursor: not-allowed;
  }

  .field-row {
    display: flex;
    gap: 8px;
  }

  .field-row .field {
    flex: 1;
    min-width: 0;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #c9d1d9;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
  }

  .field-with-lock {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .field-with-lock .field-row {
    flex: 1;
  }

  .lock-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #8b949e;
    cursor: pointer;
    flex-shrink: 0;
  }

  .lock-btn:hover {
    background: #21262d;
    color: #c9d1d9;
  }

  .color-row {
    display: flex;
    gap: 8px;
  }

  .color-picker {
    width: 32px;
    height: 28px;
    padding: 2px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .color-text {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    outline: none;
  }

  .color-text:focus {
    border-color: #58a6ff;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 11px;
  }

  .checkbox-row input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: #58a6ff;
    cursor: pointer;
  }

  .checkbox-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .mode-toggle {
    display: flex;
    gap: 4px;
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #8b949e;
    font-size: 11px;
    cursor: pointer;
  }

  .mode-btn:hover {
    background: #21262d;
    color: #c9d1d9;
  }

  .mode-btn.active {
    background: rgba(56, 139, 253, 0.15);
    border-color: #58a6ff;
    color: #58a6ff;
  }

  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .quick-action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 11px;
    cursor: pointer;
    text-align: left;
  }

  .quick-action-btn:hover {
    background: #21262d;
    border-color: #8b949e;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }

  .action-btn.secondary {
    background: #21262d;
    color: #c9d1d9;
  }

  .action-btn.secondary:hover {
    background: #30363d;
  }

  .action-btn.danger {
    background: rgba(248, 81, 73, 0.15);
    color: #f85149;
  }

  .action-btn.danger:hover {
    background: rgba(248, 81, 73, 0.25);
  }

  .action-btn.full-width {
    flex: none;
    width: 100%;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #484f58;
    text-align: center;
    padding: 32px;
    gap: 12px;
  }

  .empty-state p {
    margin: 0;
    font-size: 12px;
  }

  .field select {
    width: 100%;
    padding: 6px 10px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    outline: none;
    cursor: pointer;
  }

  .field select:focus {
    border-color: #58a6ff;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .slider {
    flex: 1;
    height: 4px;
    background: #30363d;
    border-radius: 2px;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #58a6ff;
    border-radius: 50%;
    cursor: pointer;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #58a6ff;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .slider-value {
    font-size: 11px;
    color: #8b949e;
    min-width: 36px;
    text-align: right;
  }

  .section-divider {
    height: 1px;
    background: #21262d;
    margin: 6px 0;
  }

  .datetime-input {
    width: 100%;
    padding: 6px 10px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    outline: none;
    margin-bottom: 4px;
  }

  .datetime-input:focus {
    border-color: #58a6ff;
  }

  .datetime-input::-webkit-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
  }

  .input-hint {
    font-size: 10px;
    color: #6e7681;
    display: block;
    margin-bottom: 6px;
  }

  .clear-btn {
    background: rgba(56, 139, 253, 0.15);
    border: none;
    border-radius: 4px;
    padding: 4px 10px;
    color: #58a6ff;
    font-size: 11px;
    cursor: pointer;
    margin-top: 4px;
  }

  .clear-btn:hover {
    background: rgba(56, 139, 253, 0.25);
  }

  .subsection-header {
    font-size: 10px;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    margin-top: 4px;
  }

  .child-nodes-list {
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid #30363d;
    border-radius: 4px;
    background: #0d1117;
  }

  .child-node-item {
    padding: 4px 8px;
    border-bottom: 1px solid #21262d;
  }

  .child-node-item:last-child {
    border-bottom: none;
  }

  .child-node-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 11px;
    color: #c9d1d9;
  }

  .child-node-checkbox input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: #58a6ff;
    cursor: pointer;
    flex-shrink: 0;
  }

  .child-node-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .info-text {
    font-size: 12px;
    color: #8b949e;
    padding: 6px 0;
  }

  .select-input {
    width: 100%;
    padding: 6px 10px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    outline: none;
    cursor: pointer;
  }

  .select-input:focus {
    border-color: #58a6ff;
  }
</style>
