import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";
import CredentialNode from "./CredentialNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "credential",
  label: "Credential",
  description: "Usernames and credentials",
  category: "data",
  iconName: "KeyRound",
  component: CredentialNode,
  defaultData: { title: "Credential", username: "", platform: "" },
  dimensions: { minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 },
  colors: { bg: "#2e2e1a", border: "#6a6a4a", icon: "🔑" },
};