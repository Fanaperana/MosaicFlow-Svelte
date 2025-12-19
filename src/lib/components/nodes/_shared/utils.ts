/**
 * Node Shared Utilities
 * 
 * Common utilities used by all node components.
 * Eliminates duplicate code across nodes (DRY).
 */

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Convert hex color to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return hex;
}

/**
 * Darken a color by percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = Math.max(0, Math.floor(parseInt(result[1], 16) * (1 - percent / 100)));
    const g = Math.max(0, Math.floor(parseInt(result[2], 16) * (1 - percent / 100)));
    const b = Math.max(0, Math.floor(parseInt(result[3], 16) * (1 - percent / 100)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return hex;
}

/**
 * Lighten a color by percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = Math.min(255, Math.floor(parseInt(result[1], 16) + (255 - parseInt(result[1], 16)) * percent / 100));
    const g = Math.min(255, Math.floor(parseInt(result[2], 16) + (255 - parseInt(result[2], 16)) * percent / 100));
    const b = Math.min(255, Math.floor(parseInt(result[3], 16) + (255 - parseInt(result[3], 16)) * percent / 100));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return hex;
}

// ============================================================================
// STYLE EXTRACTORS
// ============================================================================

import type { BaseNodeData } from '$lib/types';

export interface NodeStyleProps {
  borderWidth: number;
  borderStyle: string;
  borderRadius: number;
  bgOpacity: number;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

/**
 * Extract style properties from node data
 * Used by all nodes to compute consistent styling
 */
export function getNodeStyles(data: BaseNodeData, defaultColor = '#1a1d21'): NodeStyleProps {
  const borderWidth = (data.borderWidth as number) ?? 1;
  const borderStyle = (data.borderStyle as string) ?? 'solid';
  const borderRadius = (data.borderRadius as number) ?? 4;
  const bgOpacity = (data.bgOpacity as number) ?? 1;
  const baseColor = data.color || defaultColor;
  
  return {
    borderWidth,
    borderStyle,
    borderRadius,
    bgOpacity,
    backgroundColor: hexToRgba(baseColor, bgOpacity),
    borderColor: data.borderColor || '#333',
    textColor: data.textColor || '#e0e0e0',
  };
}

/**
 * Generate inline style string from style props
 */
export function nodeStyleToString(styles: NodeStyleProps): string {
  return `
    background: ${styles.backgroundColor};
    border-color: ${styles.borderColor};
    border-width: ${styles.borderWidth}px;
    border-style: ${styles.borderStyle};
    border-radius: ${styles.borderRadius}px;
    color: ${styles.textColor};
  `.trim();
}

// ============================================================================
// NODE SIZE DEFAULTS
// ============================================================================

import type { NodeType } from '$lib/types';

export interface NodeDimensions {
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * Default dimensions for each node type
 */
export const NODE_DIMENSIONS: Record<NodeType, NodeDimensions> = {
  note: { minWidth: 200, minHeight: 120, defaultWidth: 280, defaultHeight: 200 },
  image: { minWidth: 150, minHeight: 150, defaultWidth: 300, defaultHeight: 250 },
  link: { minWidth: 200, minHeight: 100, defaultWidth: 250, defaultHeight: 140 },
  code: { minWidth: 300, minHeight: 200, defaultWidth: 400, defaultHeight: 300 },
  timestamp: { minWidth: 180, minHeight: 100, defaultWidth: 220, defaultHeight: 130 },
  person: { minWidth: 220, minHeight: 180, defaultWidth: 280, defaultHeight: 220 },
  organization: { minWidth: 220, minHeight: 150, defaultWidth: 280, defaultHeight: 180 },
  domain: { minWidth: 240, minHeight: 180, defaultWidth: 300, defaultHeight: 220 },
  hash: { minWidth: 240, minHeight: 150, defaultWidth: 300, defaultHeight: 180 },
  credential: { minWidth: 220, minHeight: 150, defaultWidth: 260, defaultHeight: 180 },
  socialPost: { minWidth: 250, minHeight: 180, defaultWidth: 320, defaultHeight: 250 },
  group: { minWidth: 200, minHeight: 150, defaultWidth: 400, defaultHeight: 300 },
  map: { minWidth: 250, minHeight: 200, defaultWidth: 350, defaultHeight: 280 },
  router: { minWidth: 200, minHeight: 150, defaultWidth: 260, defaultHeight: 180 },
  linkList: { minWidth: 220, minHeight: 150, defaultWidth: 280, defaultHeight: 200 },
  snapshot: { minWidth: 250, minHeight: 200, defaultWidth: 350, defaultHeight: 280 },
  action: { minWidth: 200, minHeight: 120, defaultWidth: 260, defaultHeight: 150 },
  iframe: { minWidth: 300, minHeight: 250, defaultWidth: 500, defaultHeight: 400 },
  annotation: { minWidth: 120, minHeight: 60, defaultWidth: 180, defaultHeight: 80 },
};

/**
 * Get dimensions for a node type
 */
export function getNodeDimensions(type: NodeType): NodeDimensions {
  return NODE_DIMENSIONS[type] ?? {
    minWidth: 150,
    minHeight: 80,
    defaultWidth: 200,
    defaultHeight: 120,
  };
}
