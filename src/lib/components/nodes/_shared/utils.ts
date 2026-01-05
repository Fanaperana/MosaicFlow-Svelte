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
// NODE SIZE DEFAULTS - Re-exported from centralized registry
// ============================================================================

// Re-export from centralized registry for backwards compatibility
export { 
  type NodeDimensions,
  getNodeDimensions,
} from '../node-registry';
