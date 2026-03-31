import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import IframeNode from "./IframeNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "iframe",
  label: "Iframe",
  description: "Embed external webpages",
  category: "content",
  iconName: "LayoutGrid",
  component: IframeNode,
  defaultData: { title: "Embed", url: "" },
  dimensions: { minWidth: 300, minHeight: 250, defaultWidth: 500, defaultHeight: 400 },
  colors: { bg: "#2e1a1a", border: "#6a4a4a", icon: "🖥️" },
};