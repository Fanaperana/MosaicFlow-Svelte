/**
 * Spatial indexing using a simple quadtree for efficient node culling
 * Used to only render visible nodes at extreme zoom levels
 */

import type { MosaicNode } from '$lib/types';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuadTreeNode {
  bounds: Bounds;
  nodes: MosaicNode[];
  children: QuadTreeNode[] | null;
  depth: number;
}

const MAX_NODES_PER_QUAD = 10;
const MAX_DEPTH = 8;

export class SpatialIndex {
  private root: QuadTreeNode;

  constructor(bounds: Bounds = { x: -10000, y: -10000, width: 20000, height: 20000 }) {
    this.root = {
      bounds,
      nodes: [],
      children: null,
      depth: 0,
    };
  }

  /**
   * Insert a node into the quadtree
   */
  insert(node: MosaicNode): void {
    this.insertIntoNode(this.root, node);
  }

  private insertIntoNode(quadNode: QuadTreeNode, node: MosaicNode): void {
    // If this quad has children, insert into appropriate child
    if (quadNode.children) {
      const childIndex = this.getChildIndex(quadNode, node);
      if (childIndex !== -1) {
        this.insertIntoNode(quadNode.children[childIndex], node);
        return;
      }
    }

    // Add to this quad
    quadNode.nodes.push(node);

    // Split if necessary
    if (
      quadNode.nodes.length > MAX_NODES_PER_QUAD &&
      quadNode.depth < MAX_DEPTH &&
      !quadNode.children
    ) {
      this.split(quadNode);
    }
  }

  /**
   * Split a quad node into 4 children
   */
  private split(quadNode: QuadTreeNode): void {
    const { x, y, width, height } = quadNode.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    quadNode.children = [
      // Top-left
      { bounds: { x, y, width: halfWidth, height: halfHeight }, nodes: [], children: null, depth: quadNode.depth + 1 },
      // Top-right
      { bounds: { x: x + halfWidth, y, width: halfWidth, height: halfHeight }, nodes: [], children: null, depth: quadNode.depth + 1 },
      // Bottom-left
      { bounds: { x, y: y + halfHeight, width: halfWidth, height: halfHeight }, nodes: [], children: null, depth: quadNode.depth + 1 },
      // Bottom-right
      { bounds: { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight }, nodes: [], children: null, depth: quadNode.depth + 1 },
    ];

    // Redistribute nodes to children
    const nodesToRedistribute = [...quadNode.nodes];
    quadNode.nodes = [];

    for (const node of nodesToRedistribute) {
      const childIndex = this.getChildIndex(quadNode, node);
      if (childIndex !== -1) {
        this.insertIntoNode(quadNode.children[childIndex], node);
      } else {
        // Doesn't fit in any child, keep in parent
        quadNode.nodes.push(node);
      }
    }
  }

  /**
   * Determine which child quad a node belongs to
   * Returns -1 if it doesn't fit cleanly in one child
   */
  private getChildIndex(quadNode: QuadTreeNode, node: MosaicNode): number {
    if (!quadNode.children) return -1;

    const nodeWidth = node.width || 200;
    const nodeHeight = node.height || 100;
    const nodeBounds = {
      x: node.position.x,
      y: node.position.y,
      width: nodeWidth,
      height: nodeHeight,
    };

    for (let i = 0; i < 4; i++) {
      if (this.contains(quadNode.children[i].bounds, nodeBounds)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Check if bounds A completely contains bounds B
   */
  private contains(a: Bounds, b: Bounds): boolean {
    return (
      b.x >= a.x &&
      b.y >= a.y &&
      b.x + b.width <= a.x + a.width &&
      b.y + b.height <= a.y + a.height
    );
  }

  /**
   * Check if two bounds intersect
   */
  private intersects(a: Bounds, b: Bounds): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Query nodes that intersect with the given viewport bounds
   */
  query(viewportBounds: Bounds): MosaicNode[] {
    const result: MosaicNode[] = [];
    this.queryNode(this.root, viewportBounds, result);
    return result;
  }

  private queryNode(quadNode: QuadTreeNode, bounds: Bounds, result: MosaicNode[]): void {
    // Check if viewport intersects this quad
    if (!this.intersects(quadNode.bounds, bounds)) {
      return;
    }

    // Add all nodes in this quad that intersect viewport
    for (const node of quadNode.nodes) {
      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;
      const nodeBounds = {
        x: node.position.x,
        y: node.position.y,
        width: nodeWidth,
        height: nodeHeight,
      };

      if (this.intersects(nodeBounds, bounds)) {
        result.push(node);
      }
    }

    // Recursively query children
    if (quadNode.children) {
      for (const child of quadNode.children) {
        this.queryNode(child, bounds, result);
      }
    }
  }

  /**
   * Clear and rebuild the entire index
   */
  rebuild(nodes: MosaicNode[]): void {
    // Calculate bounds from nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const width = node.width || 200;
      const height = node.height || 100;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    }

    // Add padding
    const padding = 1000;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Reset root with new bounds
    this.root = {
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      nodes: [],
      children: null,
      depth: 0,
    };

    // Insert all nodes
    for (const node of nodes) {
      this.insert(node);
    }
  }

  /**
   * Get stats about the quadtree
   */
  getStats(): { totalNodes: number; maxDepth: number; quadCount: number } {
    let maxDepth = 0;
    let quadCount = 0;
    let totalNodes = 0;

    const traverse = (node: QuadTreeNode) => {
      quadCount++;
      maxDepth = Math.max(maxDepth, node.depth);
      totalNodes += node.nodes.length;

      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.root);

    return { totalNodes, maxDepth, quadCount };
  }
}
