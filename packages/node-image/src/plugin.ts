import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import ImageNode from "./ImageNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "image",
  label: "Image",
  description: "Display images with drag-and-drop support",
  category: "content",
  iconName: "Image",
  component: ImageNode,
  defaultData: { title: "Image", imageUrl: "", caption: "" },
  dimensions: { minWidth: 150, minHeight: 150, defaultWidth: 300, defaultHeight: 250 },
  colors: { bg: "#1a2e1a", border: "#4a6a4a", icon: "🖼️" },
  quickAccess: true,
};