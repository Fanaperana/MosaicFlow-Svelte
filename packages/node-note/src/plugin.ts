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
  knowledge: {
    purpose: "Free-form markdown note for ideas, summaries and findings. Default choice for prose.",
    bodyField: "content",
    fields: {
      content: { type: "markdown", description: "Note body in markdown" },
    },
  },
  onLoad: (data) => ({ ...data, viewMode: "view" }),
  quickAccess: true,
};