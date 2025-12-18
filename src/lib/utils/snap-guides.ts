// Snap alignment guides utility for MosaicFlow
// Calculates alignment guides when dragging nodes to show visual indicators

import type { Node } from '@xyflow/svelte';

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
  start: number; // start of the line
  end: number; // end of the line
  alignType: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
}

export interface NodeBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

// Default node dimensions when measured dimensions are not available
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;

/**
 * Get the bounds of a node
 */
export function getNodeBounds(node: Node): NodeBounds {
  const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
  
  return {
    left: node.position.x,
    right: node.position.x + width,
    top: node.position.y,
    bottom: node.position.y + height,
    centerX: node.position.x + width / 2,
    centerY: node.position.y + height / 2,
    width,
    height,
  };
}

/**
 * Calculate snap guides for a dragging node relative to other nodes
 * @param draggingNode The node being dragged
 * @param otherNodes Other nodes to align against
 * @param threshold Distance threshold to show guides (default 5px)
 * @returns Array of snap guides to render
 */
export function calculateSnapGuides(
  draggingNode: Node,
  otherNodes: Node[],
  threshold: number = 5
): SnapGuide[] {
  const guides: SnapGuide[] = [];
  const dragBounds = getNodeBounds(draggingNode);

  // Collect all potential alignment positions from other nodes
  const verticalAlignments: { position: number; type: 'left' | 'center' | 'right'; nodeBounds: NodeBounds }[] = [];
  const horizontalAlignments: { position: number; type: 'top' | 'middle' | 'bottom'; nodeBounds: NodeBounds }[] = [];

  for (const node of otherNodes) {
    if (node.id === draggingNode.id) continue;
    
    const bounds = getNodeBounds(node);
    
    // Vertical alignments (x positions)
    verticalAlignments.push(
      { position: bounds.left, type: 'left', nodeBounds: bounds },
      { position: bounds.centerX, type: 'center', nodeBounds: bounds },
      { position: bounds.right, type: 'right', nodeBounds: bounds }
    );
    
    // Horizontal alignments (y positions)
    horizontalAlignments.push(
      { position: bounds.top, type: 'top', nodeBounds: bounds },
      { position: bounds.centerY, type: 'middle', nodeBounds: bounds },
      { position: bounds.bottom, type: 'bottom', nodeBounds: bounds }
    );
  }

  // Check vertical alignments (left, center, right of dragging node)
  const dragVerticalPositions = [
    { position: dragBounds.left, type: 'left' as const },
    { position: dragBounds.centerX, type: 'center' as const },
    { position: dragBounds.right, type: 'right' as const },
  ];

  for (const dragPos of dragVerticalPositions) {
    for (const alignment of verticalAlignments) {
      const distance = Math.abs(dragPos.position - alignment.position);
      
      if (distance <= threshold) {
        // Calculate line extent (from top of higher node to bottom of lower node)
        const minY = Math.min(dragBounds.top, alignment.nodeBounds.top) - 20;
        const maxY = Math.max(dragBounds.bottom, alignment.nodeBounds.bottom) + 20;
        
        // Check if we already have a guide at this position
        const existingGuide = guides.find(
          g => g.type === 'vertical' && Math.abs(g.position - alignment.position) < 1
        );
        
        if (existingGuide) {
          // Extend existing guide
          existingGuide.start = Math.min(existingGuide.start, minY);
          existingGuide.end = Math.max(existingGuide.end, maxY);
        } else {
          guides.push({
            type: 'vertical',
            position: alignment.position,
            start: minY,
            end: maxY,
            alignType: alignment.type,
          });
        }
      }
    }
  }

  // Check horizontal alignments (top, middle, bottom of dragging node)
  const dragHorizontalPositions = [
    { position: dragBounds.top, type: 'top' as const },
    { position: dragBounds.centerY, type: 'middle' as const },
    { position: dragBounds.bottom, type: 'bottom' as const },
  ];

  for (const dragPos of dragHorizontalPositions) {
    for (const alignment of horizontalAlignments) {
      const distance = Math.abs(dragPos.position - alignment.position);
      
      if (distance <= threshold) {
        // Calculate line extent (from left of leftmost node to right of rightmost node)
        const minX = Math.min(dragBounds.left, alignment.nodeBounds.left) - 20;
        const maxX = Math.max(dragBounds.right, alignment.nodeBounds.right) + 20;
        
        // Check if we already have a guide at this position
        const existingGuide = guides.find(
          g => g.type === 'horizontal' && Math.abs(g.position - alignment.position) < 1
        );
        
        if (existingGuide) {
          // Extend existing guide
          existingGuide.start = Math.min(existingGuide.start, minX);
          existingGuide.end = Math.max(existingGuide.end, maxX);
        } else {
          guides.push({
            type: 'horizontal',
            position: alignment.position,
            start: minX,
            end: maxX,
            alignType: alignment.type,
          });
        }
      }
    }
  }

  return guides;
}

/**
 * Calculate snap guides for multiple dragging nodes (selection)
 */
export function calculateSelectionSnapGuides(
  draggingNodes: Node[],
  allNodes: Node[],
  threshold: number = 5
): SnapGuide[] {
  if (draggingNodes.length === 0) return [];
  
  // Get IDs of dragging nodes for exclusion
  const draggingIds = new Set(draggingNodes.map(n => n.id));
  const otherNodes = allNodes.filter(n => !draggingIds.has(n.id));
  
  // Calculate combined bounds of selection
  const selectionBounds = getSelectionBounds(draggingNodes);
  
  // Create a virtual node representing the selection
  const virtualNode: Node = {
    id: '__selection__',
    position: { x: selectionBounds.left, y: selectionBounds.top },
    data: {},
    measured: {
      width: selectionBounds.width,
      height: selectionBounds.height,
    },
  };
  
  return calculateSnapGuides(virtualNode, otherNodes, threshold);
}

/**
 * Get the combined bounds of multiple nodes
 */
export function getSelectionBounds(nodes: Node[]): NodeBounds {
  if (nodes.length === 0) {
    return { left: 0, right: 0, top: 0, bottom: 0, centerX: 0, centerY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (const node of nodes) {
    const bounds = getNodeBounds(node);
    minX = Math.min(minX, bounds.left);
    minY = Math.min(minY, bounds.top);
    maxX = Math.max(maxX, bounds.right);
    maxY = Math.max(maxY, bounds.bottom);
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  return {
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    width,
    height,
  };
}
