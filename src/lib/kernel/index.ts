/**
 * MosaicFlow Kernel Module
 * 
 * Main entry point for the kernel system on the frontend.
 */

// Types
export type {
  PluginManifest,
  PluginType,
  PluginCapability,
  PluginPermission,
  PluginDependency,
  FrontendEntry,
  BackendEntry,
  PluginState,
  PluginInfo,
  KernelRequest,
  KernelResponse,
  EventTopic,
  KernelEvent,
} from './types';

// Client
export { kernel, kernelInvoke, kernelInvokeOrThrow } from './client';

// Registries
export { 
  nodeRegistry, 
  type NodeTypeRegistration, 
  type NodeCategory, 
  type NodeDimensions, 
  type NodeColors 
} from './registries/node-registry';
export { panelRegistry, type PanelRegistration, type PanelLocation } from './registries/panel-registry';
export { commandRegistry, type CommandRegistration } from './registries/command-registry';

// Plugin loader
export { pluginLoader, type LoadedPlugin, type PluginAPI, type PluginModule } from './plugin-loader';
