import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import NoteNode from "./NoteNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "note",
  label: "Note",
  description: "Markdown-supported text notes",
  category: "content",
  iconName: "StickyNote",
  component: NoteNode,
  defaultData: { title: "New Note", content: "", viewMode: "edit" },
  dimensions: { minWidth: 120, minHeight: 60, defaultWidth: 280, defaultHeight: 200 },
  colors: { bg: "#1a1a2e", border: "#4a4a6a", icon: "📝" },
  quickAccess: true,
};