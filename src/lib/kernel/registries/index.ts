/**
 * Kernel Registries
 * 
 * Re-exports all registries for convenience.
 */

export { nodeRegistry, type NodeTypeRegistration, type NodeCategory, type NodeDimensions, type NodeColors } from './node-registry';
export { panelRegistry, type PanelRegistration, type PanelContext, type PanelRenderer } from './panel-registry';
export { commandRegistry, type CommandRegistration } from './command-registry';
export { templateRegistry, layoutRegistry, type TemplateRegistration, type LayoutRegistration } from './contribution-registry';
