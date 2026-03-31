import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface SnapshotNodeData extends BaseNodeData {
  url: string;
  screenshotPath?: string;
  capturedAt?: string;
  htmlPath?: string;
  imageUrl?: string;
  sourceUrl?: string;
  timestamp?: string;
  hash?: string;
}
