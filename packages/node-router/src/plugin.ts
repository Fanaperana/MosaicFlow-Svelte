import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
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
  knowledge: {
    purpose: "A network device such as a router, server or host.",
    fields: {
      name: { type: "string", description: "Device name", required: true },
      ip: { type: "string", description: "IP address" },
      mac: { type: "string", description: "MAC address" },
      vendor: { type: "string", description: "Manufacturer" },
      model: { type: "string", description: "Model" },
      status: { type: "enum", values: ["online", "offline", "unknown"], description: "Reachability" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};