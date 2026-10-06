import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import AnnotationNode from "./AnnotationNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "annotation",
  label: "Annotation",
  description: "Visual callouts and arrows",
  category: "utility",
  iconName: "MessageCircle",
  component: AnnotationNode,
  defaultData: { title: "Annotation", label: "Note", arrowPosition: "bottom-left", arrowRotation: 0, fontSize: 16 },
  dimensions: { minWidth: 100, minHeight: 60, defaultWidth: 200, defaultHeight: 120 },
  colors: { bg: "transparent", border: "transparent", icon: "💭" },
  knowledge: {
    purpose: "A visual callout with an arrow that comments on nearby nodes. Not for storing knowledge.",
    bodyField: "label",
    fields: {
      label: { type: "string", description: "Callout text" },
      arrowPosition: { type: "enum", values: ["top-left", "top-right", "bottom-left", "bottom-right", "left", "right", "none"], description: "Where the arrow points" },
    },
  },
};