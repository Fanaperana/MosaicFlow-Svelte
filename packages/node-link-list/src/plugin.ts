import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
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
};