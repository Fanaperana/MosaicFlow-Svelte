import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface SocialPostNodeData extends BaseNodeData {
  platform: string;
  author?: string;
  content: string;
  postUrl?: string;
  timestamp?: string;
  engagement?: { likes?: number; shares?: number; comments?: number };
  url?: string;
  avatar?: string;
  handle?: string;
  likes?: number;
  reposts?: number;
  replies?: number;
}
