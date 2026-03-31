import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import OrganizationNode from "./OrganizationNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "organization",
  label: "Organization",
  description: "Companies and groups",
  category: "entity",
  iconName: "Building2",
  component: OrganizationNode,
  defaultData: { title: "Organization", name: "" },
  dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 250, defaultHeight: 200 },
  colors: { bg: "#1a2e1a", border: "#4a6a4a", icon: "🏢" },
};