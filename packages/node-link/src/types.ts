import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface LinkNodeData extends BaseNodeData {
  url: string;
  description?: string;
  favicon?: string;
}
