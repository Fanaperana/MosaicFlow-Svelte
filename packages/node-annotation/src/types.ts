import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface AnnotationNodeData extends BaseNodeData {
  label: string;
  arrow?: string;
  arrowStyle?: string;
  arrowPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "left" | "right" | "none";
  arrowRotation?: number;
  arrowFlipX?: boolean;
  arrowFlipY?: boolean;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  content?: string;
  annotationType?: "note" | "info" | "warning" | "error" | "success";
  author?: string;
}
