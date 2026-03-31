import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface CredentialNodeData extends BaseNodeData {
  username?: string;
  email?: string;
  platform?: string;
  source?: string;
  breached?: boolean;
  service?: string;
  password?: string;
  compromised?: boolean;
}
