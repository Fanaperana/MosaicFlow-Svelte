import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import SnapshotNode from "./SnapshotNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "snapshot",
  label: "Snapshot",
  description: "Web page snapshots",
  category: "data",
  iconName: "Camera",
  component: SnapshotNode,
  defaultData: { title: "Snapshot", url: "" },
  dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 300, defaultHeight: 250 },
  colors: { bg: "#1a2e1a", border: "#4a6a4a", icon: "📸" },
  knowledge: {
    purpose: "An archived capture of a web page at a point in time.",
    fields: {
      url: { type: "url", description: "Captured page URL", required: true },
      imageUrl: { type: "url", description: "Screenshot image" },
      capturedAt: { type: "date", description: "Capture time" },
      hash: { type: "string", description: "Content hash of the capture" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};