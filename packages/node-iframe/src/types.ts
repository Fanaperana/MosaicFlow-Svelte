import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface IframeNodeData extends BaseNodeData {
  url: string;
  allowFullscreen?: boolean;
  sandbox?: string;
}
