import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface OrganizationNodeData extends BaseNodeData {
  name: string;
  type?: string;
  website?: string;
  description?: string;
  logo?: string;
  industry?: string;
  location?: string;
  size?: string;
}
