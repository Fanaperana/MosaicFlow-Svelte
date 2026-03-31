import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface MapNodeData extends BaseNodeData {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  address?: string;
  label?: string;
}
