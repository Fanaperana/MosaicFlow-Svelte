import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface ImageNodeData extends BaseNodeData {
  imageUrl?: string;
  imagePath?: string;
  caption?: string;
}
