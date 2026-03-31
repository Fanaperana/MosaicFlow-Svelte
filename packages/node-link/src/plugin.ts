import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import LinkNode from "./LinkNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "link",
  label: "Link",
  description: "Web URLs with descriptions",
  category: "content",
  iconName: "Link",
  component: LinkNode,
  defaultData: { title: "Link", url: "", description: "" },
  dimensions: { minWidth: 200, minHeight: 100, defaultWidth: 250, defaultHeight: 140 },
  colors: { bg: "#2e1a1a", border: "#6a4a4a", icon: "🔗" },
  quickAccess: true,
};