import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface DomainNodeData extends BaseNodeData {
  domain: string;
  registrar?: string;
  createdDate?: string;
  expiryDate?: string;
  nameservers?: string[];
  ipAddresses?: string[];
  protocol?: "http" | "https";
  ip?: string;
  created?: string;
  expires?: string;
}
