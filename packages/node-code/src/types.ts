import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface CodeNodeData extends BaseNodeData {
  code: string;
  language: string;
}
