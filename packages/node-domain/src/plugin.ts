import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import DomainNode from "./DomainNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "domain",
  label: "Domain",
  description: "Internet domains and DNS info",
  category: "data",
  iconName: "Globe",
  component: DomainNode,
  defaultData: { title: "Domain", domain: "" },
  dimensions: { minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 },
  colors: { bg: "#1a1a2e", border: "#4a4a6a", icon: "🌐" },
};