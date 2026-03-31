import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import GroupNode from "./GroupNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "group",
  label: "Group",
  description: "Group and organize nodes",
  category: "utility",
  iconName: "FolderOpen",
  component: GroupNode,
  defaultData: { title: "Group", label: "Group", childNodeIds: [] },
  dimensions: { minWidth: 200, minHeight: 200, defaultWidth: 400, defaultHeight: 300 },
  colors: { bg: "#3b82f6", border: "#3b82f6", icon: "📁" },
  quickAccess: true,
};