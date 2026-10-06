import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
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
  knowledge: {
    purpose: "An online account or username on a platform.",
    fields: {
      username: { type: "string", description: "Username or handle" },
      email: { type: "string", description: "Account email" },
      platform: { type: "string", description: "Platform or service name" },
      source: { type: "string", description: "Where the account was found" },
      breached: { type: "boolean", description: "Appears in a known breach" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};