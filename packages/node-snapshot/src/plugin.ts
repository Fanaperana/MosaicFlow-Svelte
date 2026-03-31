import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
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
};