import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface ActionNodeData extends BaseNodeData {
  action: string;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  assignee?: string;
}
