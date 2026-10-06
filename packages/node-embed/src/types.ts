import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface EmbedNodeData extends BaseNodeData {
  /** Wikilink-style reference to the embedded node: "Node title" or "Canvas name#Node title". */
  ref: string;
}
