/**
 * Base node data interface.
 * All node-specific data interfaces should extend this.
 */
export interface BaseNodeData {
  title: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderRadius?: number;
  bgOpacity?: number;
  textColor?: string;
  notes?: string;
  showHeader?: boolean;
  locked?: boolean;
  sizeLocked?: boolean;
  [key: string]: unknown;
}

// Node type identifier - open to allow plugin-defined types
export type NodeType = string;
