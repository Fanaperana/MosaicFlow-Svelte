import type { Node } from '@xyflow/svelte';

interface ResolveCollisionOptions {
  margin?: number;
  maxIterations?: number;
  overlapThreshold?: number;
}

interface NodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  type?: string;
  parentId?: string;
}

/**
 * Resolves overlapping nodes by moving them apart.
 * Uses a naive O(n²) algorithm that works well for typical canvas sizes (<100 nodes).
 * 
 * Skips:
 * - Group nodes (they contain other nodes)
 * - Child nodes (nodes with parentId - they are part of a subflow)
 */
export function resolveCollisions<T extends Node>(
  nodes: T[],
  options: ResolveCollisionOptions = {}
): T[] {
  const { margin = 15, maxIterations = 100, overlapThreshold = 0.5 } = options;

  if (nodes.length < 2) return nodes;

  // Create a mutable copy of node positions
  const bounds: Map<string, NodeBounds> = new Map();
  
  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? 200;
    const height = node.measured?.height ?? node.height ?? 100;
    
    bounds.set(node.id, {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width,
      height,
      centerX: node.position.x + width / 2,
      centerY: node.position.y + height / 2,
      type: node.type,
      parentId: node.parentId,
    });
  }

  const changedNodes = new Set<string>();
  let iterations = 0;
  let hasOverlap = true;

  while (hasOverlap && iterations < maxIterations) {
    hasOverlap = false;
    iterations++;

    const nodeIds = Array.from(bounds.keys());
    
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const nodeA = bounds.get(nodeIds[i])!;
        const nodeB = bounds.get(nodeIds[j])!;

        // Skip collision detection if either node is a group
        if (nodeA.type === 'group' || nodeB.type === 'group') continue;
        
        // Skip collision detection if either node has a parent (is inside a subflow)
        if (nodeA.parentId || nodeB.parentId) continue;

        // Check for overlap
        const overlapX = Math.max(0,
          Math.min(nodeA.x + nodeA.width + margin, nodeB.x + nodeB.width + margin) -
          Math.max(nodeA.x - margin, nodeB.x - margin)
        );
        const overlapY = Math.max(0,
          Math.min(nodeA.y + nodeA.height + margin, nodeB.y + nodeB.height + margin) -
          Math.max(nodeA.y - margin, nodeB.y - margin)
        );

        if (overlapX > 0 && overlapY > 0) {
          hasOverlap = true;

          // Calculate actual overlap amounts
          const actualOverlapX = (nodeA.width + nodeB.width) / 2 + margin - 
            Math.abs(nodeA.centerX - nodeB.centerX);
          const actualOverlapY = (nodeA.height + nodeB.height) / 2 + margin - 
            Math.abs(nodeA.centerY - nodeB.centerY);

          if (actualOverlapX <= 0 || actualOverlapY <= 0) continue;

          // Choose the axis with the smallest overlap to minimize movement
          if (actualOverlapX < actualOverlapY) {
            // Move along X axis
            const moveX = (actualOverlapX / 2) * overlapThreshold;
            if (nodeA.centerX < nodeB.centerX) {
              nodeA.x -= moveX;
              nodeA.centerX -= moveX;
              nodeB.x += moveX;
              nodeB.centerX += moveX;
            } else {
              nodeA.x += moveX;
              nodeA.centerX += moveX;
              nodeB.x -= moveX;
              nodeB.centerX -= moveX;
            }
          } else {
            // Move along Y axis
            const moveY = (actualOverlapY / 2) * overlapThreshold;
            if (nodeA.centerY < nodeB.centerY) {
              nodeA.y -= moveY;
              nodeA.centerY -= moveY;
              nodeB.y += moveY;
              nodeB.centerY += moveY;
            } else {
              nodeA.y += moveY;
              nodeA.centerY += moveY;
              nodeB.y -= moveY;
              nodeB.centerY -= moveY;
            }
          }

          changedNodes.add(nodeA.id);
          changedNodes.add(nodeB.id);
        }
      }
    }
  }

  // Only create new node objects for nodes that actually moved
  if (changedNodes.size === 0) return nodes;

  return nodes.map(node => {
    if (!changedNodes.has(node.id)) return node;
    
    const newBounds = bounds.get(node.id)!;
    return {
      ...node,
      position: {
        x: newBounds.x,
        y: newBounds.y,
      },
    };
  });
}

/**
 * Check if a new node position would overlap with existing nodes.
 * Returns a non-overlapping position by trying right, then down.
 * 
 * Skips:
 * - Group nodes (they contain other nodes)
 * - Child nodes (nodes with parentId - they are part of a subflow)
 */
export function findNonOverlappingPosition<T extends Node>(
  newPosition: { x: number; y: number },
  newNodeSize: { width: number; height: number },
  existingNodes: T[],
  margin = 20
): { x: number; y: number } {
  let position = { ...newPosition };
  let attempts = 0;
  const maxAttempts = 100;
  let lastCollisionNode: T | null = null;

  while (attempts < maxAttempts) {
    let hasCollision = false;
    
    for (const node of existingNodes) {
      // Skip collision check for group nodes
      if (node.type === 'group') continue;
      
      // Skip collision check for child nodes (nodes inside a subflow)
      if (node.parentId) continue;

      const nodeWidth = node.measured?.width ?? node.width ?? 200;
      const nodeHeight = node.measured?.height ?? node.height ?? 100;
      
      // Check if rectangles overlap
      const overlapsX = position.x < node.position.x + nodeWidth + margin && 
                        position.x + newNodeSize.width + margin > node.position.x;
      const overlapsY = position.y < node.position.y + nodeHeight + margin && 
                        position.y + newNodeSize.height + margin > node.position.y;
      
      if (overlapsX && overlapsY) {
        hasCollision = true;
        lastCollisionNode = node;
        
        // Calculate which direction has less overlap
        const overlapRight = (node.position.x + nodeWidth + margin) - position.x;
        const overlapDown = (node.position.y + nodeHeight + margin) - position.y;
        
        // Try moving right first, then down if we've tried right too many times
        if (attempts % 3 !== 2) {
          // Move right of the overlapping node
          position.x = node.position.x + nodeWidth + margin;
        } else {
          // Move below the overlapping node
          position.y = node.position.y + nodeHeight + margin;
          // Reset x to original position to try a new row
          position.x = newPosition.x;
        }
        break;
      }
    }
    
    if (!hasCollision) break;
    attempts++;
  }
  
  return position;
}
