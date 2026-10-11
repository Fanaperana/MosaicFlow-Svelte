// Node colour presets: fill, border and text applied in one click (Properties → Appearance, or the
// command palette "Style: …"). Built-ins follow the design-guide palette; users can save their own.

import { DESIGN_GUIDE } from '@mosaicflow/vault-core';
import { commandRegistry } from '$lib/kernel/registries/command-registry';
import { nodeRegistry } from '$lib/kernel/registries/node-registry';
import { workspace } from './workspace.svelte';
import type { MosaicNodeData } from '$lib/types';

export interface NodePreset {
  id: string;
  name: string;
  fill: string;
  border: string;
  text: string;
  custom?: boolean;
}

const STORAGE_KEY = 'mosaicflow:node-presets';
const PLUGIN_ID = 'core.node-presets';

const BUILTIN: NodePreset[] = [
  { id: 'default', name: 'Default', fill: '#1e1e1e', border: '#333333', text: '#e0e0e0' },
  ...Object.entries(DESIGN_GUIDE.palette).map(([id, p]) => ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    fill: p.fill,
    border: p.border,
    text: p.text,
  })),
];

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadCustom(): NodePreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((p) => p && typeof p.id === 'string' && typeof p.fill === 'string' && typeof p.border === 'string' && typeof p.text === 'string')
          .map((p) => ({ id: p.id, name: String(p.name ?? 'Custom'), fill: p.fill, border: p.border, text: p.text, custom: true }))
      : [];
  } catch {
    return [];
  }
}

class NodePresets {
  custom = $state<NodePreset[]>(loadCustom());
  all = $derived([...BUILTIN, ...this.custom]);

  /** The look a preset gives one node type: groups get a faint fill and a coloured heading. */
  dataFor(type: string, preset: NodePreset): Partial<MosaicNodeData> {
    if (nodeRegistry.isContainer(type)) return { color: rgba(preset.border, 0.06), borderColor: preset.border, labelColor: preset.text };
    if (type === 'simpleText') return { textColor: preset.text };
    if (type === 'image') return { borderColor: preset.border };
    return { color: preset.fill, borderColor: preset.border, textColor: preset.text };
  }

  apply(preset: NodePreset, nodeIds: string[] = workspace.selectedNodeIds) {
    if (!nodeIds.length || workspace.locked) return;
    workspace.saveToHistory();
    for (const id of nodeIds) {
      const node = workspace.getNode(id);
      if (node) workspace.updateNodeData(id, this.dataFor(node.type, preset));
    }
  }

  /** Whether a node currently wears this preset. */
  matches(preset: NodePreset, data: Record<string, unknown>): boolean {
    const eq = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
    return eq(data.borderColor, preset.border) && (eq(data.color, preset.fill) || eq(data.labelColor, preset.text));
  }

  save(from: { fill: string; border: string; text: string }, name?: string) {
    const preset: NodePreset = { id: `custom-${crypto.randomUUID()}`, name: name?.trim() || `Custom ${this.custom.length + 1}`, ...from, custom: true };
    this.custom = [...this.custom, preset];
    this.persist();
  }

  remove(id: string) {
    this.custom = this.custom.filter((p) => p.id !== id);
    this.persist();
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.custom.map(({ custom: _custom, ...p }) => p)));
    this.registerCommands();
  }

  /** "Style: <preset>" commands in the command palette, applied to the selected nodes. */
  registerCommands() {
    commandRegistry.unregisterByPlugin(PLUGIN_ID);
    for (const preset of this.all) {
      commandRegistry.register({
        id: `style.preset.${preset.id}`,
        label: `Style: ${preset.name}`,
        description: 'Apply this fill, border and text colour to the selected nodes',
        category: 'Style',
        pluginId: PLUGIN_ID,
        enabled: () => workspace.selectedNodeIds.length > 0 && !workspace.locked,
        handler: () => this.apply(preset),
      });
    }
  }
}

export const nodePresets = new NodePresets();
