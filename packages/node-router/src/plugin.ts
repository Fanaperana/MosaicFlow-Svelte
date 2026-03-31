import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import RouterNode from "./RouterNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "router",
  label: "Router",
  description: "Network devices and routers",
  category: "data",
  iconName: "Router",
  component: RouterNode,
  defaultData: { title: "Router", name: "" },
  dimensions: { minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 },
  colors: { bg: "#2e1a2e", border: "#6a4a6a", icon: "📡" },
};