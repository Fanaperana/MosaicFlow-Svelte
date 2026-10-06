import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import LinkListNode from "./LinkListNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "linkList",
  label: "Link List",
  description: "Collection of bookmarks",
  category: "utility",
  iconName: "List",
  component: LinkListNode,
  defaultData: { title: "Links", links: [] },
  dimensions: { minWidth: 200, minHeight: 100, defaultWidth: 280, defaultHeight: 200 },
  colors: { bg: "#2e1a2e", border: "#6a4a6a", icon: "📋" },
  knowledge: {
    purpose: "A curated list of several related links. Use a Link node for a single source.",
    fields: {
      links: { type: "object[]", description: "Items of {id, url, label, description?}" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};