import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface SimpleTextNodeData extends BaseNodeData {
  content: string;
  textAlign?: string;
}
