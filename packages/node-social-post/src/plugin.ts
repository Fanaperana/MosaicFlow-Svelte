import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import SocialPostNode from "./SocialPostNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "socialPost",
  label: "Social Post",
  description: "Social media posts",
  category: "data",
  iconName: "MessageSquare",
  component: SocialPostNode,
  defaultData: { title: "Social Post", platform: "twitter", content: "" },
  dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 280, defaultHeight: 220 },
  colors: { bg: "#1a2e2e", border: "#4a6a6a", icon: "💬" },
};