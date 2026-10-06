import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
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
  knowledge: {
    purpose: "A geographic location shown on an interactive map.",
    fields: {
      latitude: { type: "number", description: "Latitude in decimal degrees", required: true },
      longitude: { type: "number", description: "Longitude in decimal degrees", required: true },
      zoom: { type: "number", description: "Map zoom level (1-20)" },
      address: { type: "string", description: "Human-readable address" },
      label: { type: "string", description: "Marker label" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};