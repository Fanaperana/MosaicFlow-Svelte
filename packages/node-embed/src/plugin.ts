import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import EmbedNode from "./EmbedNode.svelte";

export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "embed",
  label: "Embed",
  description: "Live view of a node from another canvas",
  category: "utility",
  iconName: "Link2",
  component: EmbedNode,
  defaultData: { title: "Embed", ref: "" },
  dimensions: { minWidth: 220, minHeight: 120, defaultWidth: 340, defaultHeight: 240 },
  colors: { bg: "#1a1d2e", border: "#6366f1", icon: "🔗" },
  knowledge: {
    purpose: "Reuse a node that lives on another canvas without copying it; the embed always shows the original's current content.",
    bodyField: "notes",
    fields: {
      ref: { type: "string", description: 'Wikilink target: "Node title" or "Canvas name#Node title"', required: true },
      notes: { type: "markdown", description: "Why the node is embedded here" },
    },
  },
};
