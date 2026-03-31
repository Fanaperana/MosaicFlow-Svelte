import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import MapNode from "./MapNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "map",
  label: "Map",
  description: "Interactive map with markers",
  category: "utility",
  iconName: "MapPin",
  component: MapNode,
  defaultData: { title: "Map", latitude: 40.7128, longitude: -74.006, zoom: 12 },
  dimensions: { minWidth: 250, minHeight: 200, defaultWidth: 350, defaultHeight: 300 },
  colors: { bg: "#1a2e1a", border: "#4a6a4a", icon: "📍" },
};