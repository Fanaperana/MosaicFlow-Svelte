import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import GroupNode from "./GroupNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "group",
  label: "Group",
  description: "Group and organize nodes",
  category: "utility",
  iconName: "FolderOpen",
  component: GroupNode,
  defaultData: { title: "Group", label: "Group" },
  dimensions: { minWidth: 200, minHeight: 200, defaultWidth: 400, defaultHeight: 300 },
  colors: { bg: "#3b82f6", border: "#3b82f6", icon: "📁" },
  capabilities: { container: true, connectable: false },
  knowledge: {
    purpose: "Container for related nodes (a topic, case or cluster). Children set layout.parent to the group id and use coordinates relative to the group.",
    bodyField: "description",
    fields: {
      label: { type: "string", description: "Group heading" },
      description: { type: "markdown", description: "What the group is about" },
    },
  },
  quickAccess: true,
};