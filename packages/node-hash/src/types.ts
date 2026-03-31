import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface HashNodeData extends BaseNodeData {
  hash: string;
  algorithm: "md5" | "sha1" | "sha256" | "sha512" | "other";
  filename?: string;
  threatLevel?: "unknown" | "safe" | "suspicious" | "malicious";
  virusTotalUrl?: string;
  type?: string;
  value?: string;
  status?: "clean" | "malicious" | "unknown";
  source?: string;
}
