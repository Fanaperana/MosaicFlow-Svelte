/**
 * Kernel Registries
 * 
 * Re-exports all registries for convenience.
 */

export { nodeRegistry, type NodeTypeRegistration, type NodeCategory, type NodeDimensions, type NodeColors } from './node-registry';
export { panelRegistry, type PanelRegistration, type PanelLocation } from './panel-registry';
export { commandRegistry, type CommandRegistration } from './command-registry';
