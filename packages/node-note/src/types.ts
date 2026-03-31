import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface NoteNodeData extends BaseNodeData {
  content: string;
  isEditing?: boolean;
  viewMode?: "edit" | "view";
}
