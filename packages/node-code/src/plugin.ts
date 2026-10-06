import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
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
  knowledge: {
    purpose: "Source code, commands or config snippets.",
    bodyField: "code",
    bodyLanguageField: "language",
    fields: {
      code: { type: "string", description: "The code" },
      language: { type: "string", description: "Language id, e.g. javascript, python, bash" },
    },
  },
};