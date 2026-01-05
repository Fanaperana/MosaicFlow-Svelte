/**
 * Node Type Registry - Re-export from centralized registry
 * 
 * @deprecated Import directly from './node-registry' instead.
 * This file is kept for backwards compatibility.
 */

export {
  // Types
  type NodeCategory,
  type NodeDimensions,
  type NodeColors,
  type NodeDefinition,
  
  // Main exports
  NODE_DEFINITIONS,
  NODE_DEFINITIONS as NODE_REGISTRY, // Backwards compatibility alias
  NODE_DEFINITION_MAP,
  nodeTypes,
  NODE_CATEGORIES,
  
  // Helper functions
  getNodeDefinition,
  getNodesByCategory,
  getNodesGroupedByCategory,
  getQuickAccessNodes,
  getDefaultNodeData,
  getDefaultTitle,
  getNodeDimensions,
  getNodeColors,
  getIconName,
  getNodeLabel,
  getIconComponent,
  getIconByName,
  ICON_COMPONENTS,
} from './node-registry';
