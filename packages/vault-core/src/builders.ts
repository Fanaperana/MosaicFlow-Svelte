// Builders shared by seed scripts, importers and the MCP server.

import { DESIGN_GUIDE } from './schema';
import type { StoredEdge } from './types';

export type PaletteName = keyof typeof DESIGN_GUIDE.palette;

export function isPaletteName(name: string): name is PaletteName {
  return name in DESIGN_GUIDE.palette;
}

/** Card style (fill, border, text) from a design-guide palette entry. */
export function paletteCard(name: PaletteName, opts: { radius?: number; text?: boolean } = {}) {
  const p = DESIGN_GUIDE.palette[name];
  return {
    color: p.fill,
    borderColor: p.border,
    borderWidth: 1,
    borderRadius: opts.radius ?? 10,
    ...(opts.text ? { textColor: p.text } : {}),
  };
}

/** Group style: faint fill and heading in the palette colour. */
export function paletteGroup(name: PaletteName) {
  const p = DESIGN_GUIDE.palette[name];
  const hex = p.border.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { borderColor: p.border, color: `rgba(${r}, ${g}, ${b}, 0.06)`, labelColor: p.text };
}

export const paletteColor = (name: PaletteName) => DESIGN_GUIDE.palette[name].border;

export type EdgeMarker = 'none' | 'arrow' | 'arrowclosed';
export type EdgePath = 'bezier' | 'straight' | 'step' | 'smoothstep';
export type EdgeStroke = 'solid' | 'dashed' | 'dotted';
export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface EdgeLook {
  color: string;
  path?: EdgePath;
  stroke?: EdgeStroke;
  animated?: boolean;
  start?: EdgeMarker;
  end?: EdgeMarker;
  width?: number;
}

export function buildEdge(
  id: string,
  source: string,
  target: string,
  label: string,
  sourceHandle: string,
  targetHandle: string,
  look: EdgeLook
): StoredEdge {
  const pathType = look.path ?? 'bezier';
  return {
    id, source, target, sourceHandle, targetHandle, label,
    type: pathType === 'bezier' ? 'default' : pathType,
    animated: !!look.animated,
    data: {
      pathType,
      color: look.color,
      strokeWidth: look.width ?? 2,
      strokeStyle: look.stroke ?? 'solid',
      animated: !!look.animated,
      markerStart: look.start ?? 'none',
      markerEnd: look.end ?? 'arrowclosed',
      labelColor: look.color,
      labelBgColor: '#0d1117',
    },
  };
}

/** Handle sides facing each other, picked from the two rects' centres. */
export function facingSides(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): { source: Side; target: Side } {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2);
  const dy = b.y + b.height / 2 - (a.y + a.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' };
  return dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' };
}
