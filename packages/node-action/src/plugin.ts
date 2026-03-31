import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import ActionNode from "./ActionNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "action",
  label: "Action",
  description: "Tasks and action items",
  category: "utility",
  iconName: "CheckSquare",
  component: ActionNode,
  defaultData: { title: "Action", action: "", status: "pending" },
  dimensions: { minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 },
  colors: { bg: "#2e2e1a", border: "#6a6a4a", icon: "✅" },
};