import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface GroupNodeData extends BaseNodeData {
  label?: string;
  childNodeIds?: string[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "medium" | "semibold" | "bold";
  fontStyle?: "normal" | "italic";
  labelColor?: string;
  collapsed?: boolean;
  groupColor?: string;
  groupBgColor?: string;
  groupBgOpacity?: number;
  description?: string;
}
