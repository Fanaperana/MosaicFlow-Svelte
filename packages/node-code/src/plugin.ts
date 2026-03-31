import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import CodeNode from "./CodeNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "code",
  label: "Code Snippet",
  description: "Syntax-highlighted code blocks",
  category: "content",
  iconName: "Code",
  component: CodeNode,
  defaultData: { title: "Code", code: "", language: "javascript" },
  dimensions: { minWidth: 300, minHeight: 200, defaultWidth: 400, defaultHeight: 300 },
  colors: { bg: "#1a2e2e", border: "#4a6a6a", icon: "💻" },
};