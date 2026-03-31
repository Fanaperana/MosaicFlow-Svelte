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
};