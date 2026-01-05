/**
 * SVG Exporter - Generates SVG from graph model data
 * 
 * This creates pure SVG without foreignObject/HTML, which can be
 * rendered by resvg in Rust at any resolution.
 * 
 * The key insight: we export from the DATA model, not the DOM.
 * This means LOD/virtualization doesn't affect export quality.
 */

import type { Node, Edge } from '@xyflow/svelte';
import type { MosaicNodeData, NodeType } from '$lib/types';

// Node visual config
const NODE_COLORS: Record<NodeType, { bg: string; border: string; icon: string }> = {
  note: { bg: '#1a1a2e', border: '#4a4a6a', icon: '📝' },
  image: { bg: '#1a2e1a', border: '#4a6a4a', icon: '🖼️' },
  link: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🔗' },
  code: { bg: '#1a2e2e', border: '#4a6a6a', icon: '💻' },
  timestamp: { bg: '#2e2e1a', border: '#6a6a4a', icon: '⏰' },
  person: { bg: '#2e1a2e', border: '#6a4a6a', icon: '👤' },
  organization: { bg: '#1a1a2e', border: '#4a4a6a', icon: '🏢' },
  domain: { bg: '#1a2e1a', border: '#4a6a4a', icon: '🌐' },
  hash: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🔐' },
  credential: { bg: '#2e2e1a', border: '#6a6a4a', icon: '🔑' },
  socialPost: { bg: '#1a2e2e', border: '#4a6a6a', icon: '💬' },
  group: { bg: '#252530', border: '#4a4a5a', icon: '📁' },
  map: { bg: '#1a2e2e', border: '#4a6a6a', icon: '🗺️' },
  router: { bg: '#2e1a2e', border: '#6a4a6a', icon: '📡' },
  linkList: { bg: '#1a1a2e', border: '#4a4a6a', icon: '📋' },
  snapshot: { bg: '#2e2e1a', border: '#6a6a4a', icon: '📸' },
  action: { bg: '#1a2e1a', border: '#4a6a4a', icon: '✅' },
  iframe: { bg: '#2e1a1a', border: '#6a4a4a', icon: '🖥️' },
  annotation: { bg: '#2e2e2e', border: '#5a5a5a', icon: '💭' },
};

// Default node dimensions
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 120;
const HEADER_HEIGHT = 32;
const PADDING = 12;
const BORDER_RADIUS = 8;

interface ExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculate the bounding box of all nodes
 */
function calculateBounds(nodes: Node[]): ExportBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;
    const width = node.measured?.width || node.width || DEFAULT_WIDTH;
    const height = node.measured?.height || node.height || DEFAULT_HEIGHT;
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  
  // Add padding around content
  const padding = 50;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Escape text for XML/SVG
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Truncate text to fit within a width (approximate)
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}

/**
 * Wrap text into multiple lines
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.slice(0, 6); // Max 6 lines
}

/**
 * Generate SVG for a single node
 */
function generateNodeSvg(
  node: Node<MosaicNodeData>,
  offsetX: number,
  offsetY: number
): string {
  const x = node.position.x - offsetX;
  const y = node.position.y - offsetY;
  const width = node.measured?.width || node.width || DEFAULT_WIDTH;
  const height = node.measured?.height || node.height || DEFAULT_HEIGHT;
  const data = node.data as MosaicNodeData;
  const nodeType = (node.type || 'note') as NodeType;
  
  // Get colors
  const colors = NODE_COLORS[nodeType] || NODE_COLORS.note;
  const bgColor = data.color || colors.bg;
  const borderColor = data.borderColor || colors.border;
  
  const parts: string[] = [];
  
  // Node background with rounded corners
  parts.push(`
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="${height}"
      rx="${BORDER_RADIUS}"
      ry="${BORDER_RADIUS}"
      fill="${bgColor}"
      stroke="${borderColor}"
      stroke-width="1.5"
    />
  `);
  
  // Header background
  parts.push(`
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="${HEADER_HEIGHT}"
      rx="${BORDER_RADIUS}"
      ry="${BORDER_RADIUS}"
      fill="${borderColor}"
      opacity="0.3"
    />
    <rect
      x="${x}"
      y="${y + BORDER_RADIUS}"
      width="${width}"
      height="${HEADER_HEIGHT - BORDER_RADIUS}"
      fill="${borderColor}"
      opacity="0.3"
    />
  `);
  
  // Header icon and title
  const title = data.title || nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
  const icon = colors.icon;
  const maxTitleChars = Math.floor((width - 50) / 8);
  
  parts.push(`
    <text
      x="${x + PADDING}"
      y="${y + HEADER_HEIGHT / 2 + 5}"
      font-family="system-ui, -apple-system, sans-serif"
      font-size="14"
      fill="#ffffff"
    >${icon} ${escapeXml(truncateText(title, maxTitleChars))}</text>
  `);
  
  // Content area - render based on node type
  const contentY = y + HEADER_HEIGHT + PADDING;
  const contentWidth = width - PADDING * 2;
  const contentHeight = height - HEADER_HEIGHT - PADDING * 2;
  const maxCharsPerLine = Math.floor(contentWidth / 7);
  
  parts.push(generateNodeContent(nodeType, data, x + PADDING, contentY, contentWidth, contentHeight, maxCharsPerLine));
  
  return parts.join('\n');
}

/**
 * Generate content SVG for a specific node type
 */
function generateNodeContent(
  nodeType: NodeType,
  data: MosaicNodeData,
  x: number,
  y: number,
  width: number,
  height: number,
  maxCharsPerLine: number
): string {
  const parts: string[] = [];
  const lineHeight = 16;
  
  switch (nodeType) {
    case 'note': {
      const noteData = data as { content?: string };
      if (noteData.content) {
        const lines = wrapText(noteData.content, maxCharsPerLine);
        lines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 1) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="12"
              fill="#e0e0e0"
            >${escapeXml(line)}</text>
          `);
        });
      }
      break;
    }
    
    case 'person': {
      const personData = data as { name?: string; email?: string; role?: string; organization?: string };
      const fields = [
        personData.name && `Name: ${personData.name}`,
        personData.email && `Email: ${personData.email}`,
        personData.role && `Role: ${personData.role}`,
        personData.organization && `Org: ${personData.organization}`,
      ].filter(Boolean);
      
      fields.slice(0, 5).forEach((field, i) => {
        parts.push(`
          <text
            x="${x}"
            y="${y + (i + 1) * lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#e0e0e0"
          >${escapeXml(truncateText(field as string, maxCharsPerLine))}</text>
        `);
      });
      break;
    }
    
    case 'organization': {
      const orgData = data as { name?: string; type?: string; website?: string; industry?: string };
      const fields = [
        orgData.name && `Name: ${orgData.name}`,
        orgData.type && `Type: ${orgData.type}`,
        orgData.industry && `Industry: ${orgData.industry}`,
        orgData.website && `Web: ${orgData.website}`,
      ].filter(Boolean);
      
      fields.slice(0, 5).forEach((field, i) => {
        parts.push(`
          <text
            x="${x}"
            y="${y + (i + 1) * lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#e0e0e0"
          >${escapeXml(truncateText(field as string, maxCharsPerLine))}</text>
        `);
      });
      break;
    }
    
    case 'domain': {
      const domainData = data as { domain?: string; ip?: string; registrar?: string };
      const fields = [
        domainData.domain && `Domain: ${domainData.domain}`,
        domainData.ip && `IP: ${domainData.ip}`,
        domainData.registrar && `Registrar: ${domainData.registrar}`,
      ].filter(Boolean);
      
      fields.slice(0, 4).forEach((field, i) => {
        parts.push(`
          <text
            x="${x}"
            y="${y + (i + 1) * lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#e0e0e0"
          >${escapeXml(truncateText(field as string, maxCharsPerLine))}</text>
        `);
      });
      break;
    }
    
    case 'hash': {
      const hashData = data as { hash?: string; algorithm?: string; threatLevel?: string };
      parts.push(`
        <text
          x="${x}"
          y="${y + lineHeight}"
          font-family="monospace"
          font-size="10"
          fill="#a0a0a0"
        >${escapeXml(truncateText(hashData.hash || '', maxCharsPerLine + 5))}</text>
      `);
      if (hashData.algorithm) {
        parts.push(`
          <text
            x="${x}"
            y="${y + lineHeight * 2.5}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#e0e0e0"
          >Algorithm: ${escapeXml(hashData.algorithm.toUpperCase())}</text>
        `);
      }
      if (hashData.threatLevel) {
        const threatColor = hashData.threatLevel === 'malicious' ? '#ff6b6b' : 
                           hashData.threatLevel === 'suspicious' ? '#ffc107' : '#4caf50';
        parts.push(`
          <text
            x="${x}"
            y="${y + lineHeight * 3.5}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="${threatColor}"
          >Threat: ${escapeXml(hashData.threatLevel)}</text>
        `);
      }
      break;
    }
    
    case 'credential': {
      const credData = data as { username?: string; email?: string; platform?: string; compromised?: boolean };
      const fields = [
        credData.username && `User: ${credData.username}`,
        credData.email && `Email: ${credData.email}`,
        credData.platform && `Platform: ${credData.platform}`,
      ].filter(Boolean);
      
      fields.slice(0, 4).forEach((field, i) => {
        parts.push(`
          <text
            x="${x}"
            y="${y + (i + 1) * lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#e0e0e0"
          >${escapeXml(truncateText(field as string, maxCharsPerLine))}</text>
        `);
      });
      
      if (credData.compromised !== undefined) {
        const statusColor = credData.compromised ? '#ff6b6b' : '#4caf50';
        const statusText = credData.compromised ? '⚠️ Compromised' : '✓ Secure';
        parts.push(`
          <text
            x="${x}"
            y="${y + (fields.length + 1) * lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="${statusColor}"
          >${statusText}</text>
        `);
      }
      break;
    }
    
    case 'link': {
      const linkData = data as { url?: string; description?: string };
      if (linkData.url) {
        parts.push(`
          <text
            x="${x}"
            y="${y + lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#6b9fff"
          >${escapeXml(truncateText(linkData.url, maxCharsPerLine))}</text>
        `);
      }
      if (linkData.description) {
        const lines = wrapText(linkData.description, maxCharsPerLine);
        lines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 2.5) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="11"
              fill="#a0a0a0"
            >${escapeXml(line)}</text>
          `);
        });
      }
      break;
    }
    
    case 'code': {
      const codeData = data as { code?: string; language?: string };
      if (codeData.language) {
        parts.push(`
          <text
            x="${x}"
            y="${y + lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="10"
            fill="#888"
          >${escapeXml(codeData.language)}</text>
        `);
      }
      if (codeData.code) {
        const codeLines = codeData.code.split('\n').slice(0, 5);
        codeLines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 2) * lineHeight}"
              font-family="monospace"
              font-size="10"
              fill="#c0c0c0"
            >${escapeXml(truncateText(line, maxCharsPerLine))}</text>
          `);
        });
      }
      break;
    }
    
    case 'image': {
      const imageData = data as { caption?: string; imageUrl?: string };
      // For images, we show a placeholder with caption
      parts.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${width}"
          height="${Math.min(height - 30, 80)}"
          fill="#333"
          rx="4"
          ry="4"
        />
        <text
          x="${x + width / 2}"
          y="${y + Math.min(height - 30, 80) / 2 + 5}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="24"
          fill="#666"
          text-anchor="middle"
        >🖼️</text>
      `);
      if (imageData.caption) {
        parts.push(`
          <text
            x="${x}"
            y="${y + Math.min(height - 30, 80) + 16}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#a0a0a0"
          >${escapeXml(truncateText(imageData.caption, maxCharsPerLine))}</text>
        `);
      }
      break;
    }
    
    case 'socialPost': {
      const postData = data as { platform?: string; author?: string; content?: string };
      if (postData.platform || postData.author) {
        parts.push(`
          <text
            x="${x}"
            y="${y + lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="10"
            fill="#888"
          >${escapeXml([postData.platform, postData.author].filter(Boolean).join(' • '))}</text>
        `);
      }
      if (postData.content) {
        const lines = wrapText(postData.content, maxCharsPerLine);
        lines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 2) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="11"
              fill="#e0e0e0"
            >${escapeXml(line)}</text>
          `);
        });
      }
      break;
    }
    
    case 'timestamp': {
      const tsData = data as { datetime?: string; format?: string };
      if (tsData.datetime) {
        try {
          const date = new Date(tsData.datetime);
          parts.push(`
            <text
              x="${x + width / 2}"
              y="${y + height / 2}"
              font-family="monospace"
              font-size="14"
              fill="#ffc107"
              text-anchor="middle"
            >${escapeXml(date.toLocaleString())}</text>
          `);
        } catch {
          parts.push(`
            <text
              x="${x}"
              y="${y + lineHeight}"
              font-family="monospace"
              font-size="12"
              fill="#ffc107"
            >${escapeXml(tsData.datetime)}</text>
          `);
        }
      }
      break;
    }
    
    case 'action': {
      const actionData = data as { action?: string; status?: string; priority?: string };
      if (actionData.action) {
        const lines = wrapText(actionData.action, maxCharsPerLine);
        lines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 1) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="12"
              fill="#e0e0e0"
            >${escapeXml(line)}</text>
          `);
        });
      }
      if (actionData.status) {
        const statusColors: Record<string, string> = {
          pending: '#888',
          'in-progress': '#ffc107',
          completed: '#4caf50',
          cancelled: '#ff6b6b',
        };
        parts.push(`
          <text
            x="${x}"
            y="${y + height - 10}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="10"
            fill="${statusColors[actionData.status] || '#888'}"
          >Status: ${escapeXml(actionData.status)}</text>
        `);
      }
      break;
    }
    
    case 'group': {
      const groupData = data as { label?: string; description?: string };
      if (groupData.label) {
        parts.push(`
          <text
            x="${x}"
            y="${y + lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="14"
            font-weight="bold"
            fill="#ffffff"
          >${escapeXml(truncateText(groupData.label, maxCharsPerLine))}</text>
        `);
      }
      if (groupData.description) {
        const lines = wrapText(groupData.description, maxCharsPerLine);
        lines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 2.5) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="11"
              fill="#a0a0a0"
            >${escapeXml(line)}</text>
          `);
        });
      }
      break;
    }
    
    case 'map': {
      const mapData = data as { latitude?: number; longitude?: number; address?: string };
      // Map placeholder
      parts.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${width}"
          height="${Math.min(height - 20, 60)}"
          fill="#1a3a4a"
          rx="4"
          ry="4"
        />
        <text
          x="${x + width / 2}"
          y="${y + Math.min(height - 20, 60) / 2 + 5}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="24"
          fill="#4a8a9a"
          text-anchor="middle"
        >🗺️</text>
      `);
      if (mapData.latitude !== undefined && mapData.longitude !== undefined) {
        parts.push(`
          <text
            x="${x}"
            y="${y + Math.min(height - 20, 60) + 14}"
            font-family="monospace"
            font-size="10"
            fill="#6b9fff"
          >${mapData.latitude.toFixed(4)}, ${mapData.longitude.toFixed(4)}</text>
        `);
      }
      break;
    }
    
    case 'router': {
      const routerData = data as { name?: string; ip?: string; mac?: string; status?: string };
      const fields = [
        routerData.name && `Name: ${routerData.name}`,
        routerData.ip && `IP: ${routerData.ip}`,
        routerData.mac && `MAC: ${routerData.mac}`,
      ].filter(Boolean);
      
      fields.slice(0, 4).forEach((field, i) => {
        parts.push(`
          <text
            x="${x}"
            y="${y + (i + 1) * lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="#e0e0e0"
          >${escapeXml(truncateText(field as string, maxCharsPerLine))}</text>
        `);
      });
      
      if (routerData.status) {
        const statusColor = routerData.status === 'online' ? '#4caf50' : 
                           routerData.status === 'offline' ? '#ff6b6b' : '#888';
        parts.push(`
          <text
            x="${x}"
            y="${y + (fields.length + 1) * lineHeight}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            fill="${statusColor}"
          >● ${escapeXml(routerData.status)}</text>
        `);
      }
      break;
    }
    
    case 'linkList': {
      const listData = data as { links?: Array<{ label?: string; url?: string }> };
      if (listData.links) {
        listData.links.slice(0, 5).forEach((link, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 1) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="11"
              fill="#6b9fff"
            >• ${escapeXml(truncateText(link.label || link.url || '', maxCharsPerLine - 2))}</text>
          `);
        });
        if (listData.links.length > 5) {
          parts.push(`
            <text
              x="${x}"
              y="${y + 6 * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="10"
              fill="#888"
            >+${listData.links.length - 5} more</text>
          `);
        }
      }
      break;
    }
    
    case 'snapshot': {
      const snapData = data as { url?: string; capturedAt?: string };
      // Snapshot placeholder
      parts.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${width}"
          height="${Math.min(height - 30, 70)}"
          fill="#333"
          rx="4"
          ry="4"
        />
        <text
          x="${x + width / 2}"
          y="${y + Math.min(height - 30, 70) / 2 + 5}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="24"
          fill="#666"
          text-anchor="middle"
        >📸</text>
      `);
      if (snapData.url) {
        parts.push(`
          <text
            x="${x}"
            y="${y + Math.min(height - 30, 70) + 14}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="10"
            fill="#6b9fff"
          >${escapeXml(truncateText(snapData.url, maxCharsPerLine))}</text>
        `);
      }
      break;
    }
    
    case 'annotation': {
      const annoData = data as { label?: string; content?: string };
      const content = annoData.content || annoData.label || '';
      if (content) {
        const lines = wrapText(content, maxCharsPerLine);
        lines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 1) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="12"
              font-style="italic"
              fill="#c0c0c0"
            >${escapeXml(line)}</text>
          `);
        });
      }
      break;
    }
    
    case 'iframe': {
      const iframeData = data as { url?: string };
      parts.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${width}"
          height="${height - 20}"
          fill="#1a1a2a"
          rx="4"
          ry="4"
          stroke="#3a3a4a"
          stroke-width="1"
        />
        <text
          x="${x + width / 2}"
          y="${y + (height - 20) / 2}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="16"
          fill="#5a5a6a"
          text-anchor="middle"
        >🖥️ Embedded Content</text>
      `);
      if (iframeData.url) {
        parts.push(`
          <text
            x="${x}"
            y="${y + height - 5}"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="9"
            fill="#6b9fff"
          >${escapeXml(truncateText(iframeData.url, maxCharsPerLine))}</text>
        `);
      }
      break;
    }
    
    default:
      // Generic content display
      if (data.notes) {
        const lines = wrapText(data.notes, maxCharsPerLine);
        lines.forEach((line, i) => {
          parts.push(`
            <text
              x="${x}"
              y="${y + (i + 1) * lineHeight}"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="11"
              fill="#a0a0a0"
            >${escapeXml(line)}</text>
          `);
        });
      }
  }
  
  return parts.join('\n');
}

/**
 * Generate SVG for an edge
 */
function generateEdgeSvg(
  edge: Edge,
  nodes: Node[],
  offsetX: number,
  offsetY: number
): string {
  // Find source and target nodes
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  if (!sourceNode || !targetNode) return '';
  
  // Calculate connection points (center of nodes for simplicity)
  const sourceWidth = sourceNode.measured?.width || sourceNode.width || DEFAULT_WIDTH;
  const sourceHeight = sourceNode.measured?.height || sourceNode.height || DEFAULT_HEIGHT;
  const targetWidth = targetNode.measured?.width || targetNode.width || DEFAULT_WIDTH;
  const targetHeight = targetNode.measured?.height || targetNode.height || DEFAULT_HEIGHT;
  
  const sourceX = sourceNode.position.x - offsetX + sourceWidth / 2;
  const sourceY = sourceNode.position.y - offsetY + sourceHeight / 2;
  const targetX = targetNode.position.x - offsetX + targetWidth / 2;
  const targetY = targetNode.position.y - offsetY + targetHeight / 2;
  
  // Calculate edge connection points on node borders
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);
  
  // Adjust start/end points to node edges
  const startX = sourceX + Math.cos(angle) * (sourceWidth / 2);
  const startY = sourceY + Math.sin(angle) * (sourceHeight / 2);
  const endX = targetX - Math.cos(angle) * (targetWidth / 2);
  const endY = targetY - Math.sin(angle) * (targetHeight / 2);
  
  // Create bezier curve for smooth edges
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const curvature = 0.25;
  const ctrlX1 = startX + (midX - startX) * curvature;
  const ctrlY1 = startY;
  const ctrlX2 = endX - (endX - midX) * curvature;
  const ctrlY2 = endY;
  
  const edgeColor = (edge.style as { stroke?: string })?.stroke || '#555';
  const edgeWidth = (edge.style as { strokeWidth?: number })?.strokeWidth || 2;
  
  // Edge path
  const path = `M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`;
  
  let svg = `
    <path
      d="${path}"
      fill="none"
      stroke="${edgeColor}"
      stroke-width="${edgeWidth}"
      stroke-linecap="round"
    />
  `;
  
  // Add arrowhead if animated or marked
  if (edge.animated || edge.markerEnd) {
    const arrowSize = 8;
    const arrowAngle = Math.atan2(endY - ctrlY2, endX - ctrlX2);
    const arrowX1 = endX - arrowSize * Math.cos(arrowAngle - Math.PI / 6);
    const arrowY1 = endY - arrowSize * Math.sin(arrowAngle - Math.PI / 6);
    const arrowX2 = endX - arrowSize * Math.cos(arrowAngle + Math.PI / 6);
    const arrowY2 = endY - arrowSize * Math.sin(arrowAngle + Math.PI / 6);
    
    svg += `
      <polygon
        points="${endX},${endY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}"
        fill="${edgeColor}"
      />
    `;
  }
  
  // Edge label
  if (edge.label) {
    svg += `
      <rect
        x="${midX - 30}"
        y="${midY - 10}"
        width="60"
        height="20"
        rx="4"
        ry="4"
        fill="#1a1a1a"
        stroke="${edgeColor}"
        stroke-width="1"
      />
      <text
        x="${midX}"
        y="${midY + 4}"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="10"
        fill="#e0e0e0"
        text-anchor="middle"
      >${escapeXml(String(edge.label))}</text>
    `;
  }
  
  return svg;
}

/**
 * Main export function: Generate complete SVG from graph model
 */
export function generateCanvasSvg(nodes: Node[], edges: Edge[]): { svg: string; width: number; height: number } {
  if (nodes.length === 0) {
    return { svg: '', width: 0, height: 0 };
  }
  
  const bounds = calculateBounds(nodes);
  
  // Build SVG content
  const parts: string[] = [];
  
  // SVG header
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  width="${bounds.width}" 
  height="${bounds.height}"
  viewBox="0 0 ${bounds.width} ${bounds.height}"
>
  <!-- Background -->
  <rect x="0" y="0" width="${bounds.width}" height="${bounds.height}" fill="#0a0a0a"/>
  
  <!-- Edges (rendered first, below nodes) -->
  <g id="edges">
`);
  
  // Generate edges
  for (const edge of edges) {
    parts.push(generateEdgeSvg(edge, nodes, bounds.minX, bounds.minY));
  }
  
  parts.push(`  </g>
  
  <!-- Nodes -->
  <g id="nodes">
`);
  
  // Generate nodes
  for (const node of nodes) {
    parts.push(generateNodeSvg(node as Node<MosaicNodeData>, bounds.minX, bounds.minY));
  }
  
  parts.push(`  </g>
</svg>`);
  
  return {
    svg: parts.join('\n'),
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * Export canvas as SVG string (for saving as .svg file)
 */
export function exportToSvgString(nodes: Node[], edges: Edge[]): string {
  const { svg } = generateCanvasSvg(nodes, edges);
  return svg;
}
