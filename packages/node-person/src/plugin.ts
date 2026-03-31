import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import PersonNode from "./PersonNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "person",
  label: "Person",
  description: "Individual profiles and contacts",
  category: "entity",
  iconName: "User",
  component: PersonNode,
  defaultData: { title: "Person", name: "" },
  dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 250, defaultHeight: 200 },
  colors: { bg: "#2e1a2e", border: "#6a4a6a", icon: "👤" },
  quickAccess: true,
};