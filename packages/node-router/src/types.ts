import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface RouterNodeData extends BaseNodeData {
  name: string;
  ipAddress?: string;
  macAddress?: string;
  manufacturer?: string;
  model?: string;
  ip?: string;
  mac?: string;
  vendor?: string;
  status?: "online" | "offline" | "unknown";
  ports?: number[];
}
