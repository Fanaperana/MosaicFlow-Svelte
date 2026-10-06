import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import HashNode from "./HashNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "hash",
  label: "Hash",
  description: "File hashes and checksums",
  category: "data",
  iconName: "FileDigit",
  component: HashNode,
  defaultData: { title: "Hash", hash: "", algorithm: "sha256" },
  dimensions: { minWidth: 200, minHeight: 100, defaultWidth: 280, defaultHeight: 160 },
  colors: { bg: "#2e1a1a", border: "#6a4a4a", icon: "#️⃣" },
  knowledge: {
    purpose: "A file hash or checksum, e.g. a malware sample indicator.",
    fields: {
      hash: { type: "string", description: "Hash value", required: true },
      algorithm: { type: "enum", values: ["md5", "sha1", "sha256", "sha512", "other"], description: "Hash algorithm" },
      filename: { type: "string", description: "Associated file name" },
      threatLevel: { type: "enum", values: ["unknown", "safe", "suspicious", "malicious"], description: "Assessment" },
      source: { type: "string", description: "Where the hash came from" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};