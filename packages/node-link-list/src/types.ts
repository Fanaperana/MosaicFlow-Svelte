import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface LinkItem {
  id: string;
  url: string;
  label: string;
  description?: string;
}

export interface LinkListNodeData extends BaseNodeData {
  links: LinkItem[];
}
