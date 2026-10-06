import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import SimpleTextNode from "./SimpleTextNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "simpleText",
  label: "Simple Text",
  description: "Plain text without formatting",
  category: "content",
  iconName: "Type",
  component: SimpleTextNode,
  defaultData: { title: "Text", content: "", bgOpacity: 0, borderWidth: 0 },
  dimensions: { minWidth: 120, minHeight: 60, defaultWidth: 200, defaultHeight: 100 },
  colors: { bg: "#1a1a2e", border: "#4a4a6a", icon: "📄" },
  knowledge: {
    purpose: "Short plain-text label or heading placed directly on the canvas without a card.",
    bodyField: "content",
    fields: {
      content: { type: "string", description: "Plain text" },
    },
  },
};