import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
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
  knowledge: {
    purpose: "A task or follow-up action.",
    bodyField: "action",
    fields: {
      action: { type: "markdown", description: "What needs to be done", required: true },
      status: { type: "enum", values: ["pending", "in-progress", "completed", "cancelled"], description: "Progress" },
      priority: { type: "enum", values: ["low", "medium", "high"], description: "Priority" },
      dueDate: { type: "date", description: "Due date" },
      assignee: { type: "string", description: "Who is responsible" },
      notes: { type: "string", description: "Extra notes" },
    },
  },
};