import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface PersonNodeData extends BaseNodeData {
  name: string;
  email?: string;
  phone?: string;
  aliases?: string[];
  avatar?: string;
  organization?: string;
  role?: string;
}
