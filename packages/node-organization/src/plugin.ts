import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import OrganizationNode from "./OrganizationNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "organization",
  label: "Organization",
  description: "Companies and groups",
  category: "entity",
  iconName: "Building2",
  component: OrganizationNode,
  defaultData: { title: "Organization", name: "" },
  dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 250, defaultHeight: 200 },
  colors: { bg: "#1a2e1a", border: "#4a6a4a", icon: "🏢" },
  knowledge: {
    purpose: "A company, institution or group of people.",
    fields: {
      name: { type: "string", description: "Organization name", required: true },
      type: { type: "string", description: "Kind of organization, e.g. company, NGO, agency" },
      website: { type: "url", description: "Official website" },
      industry: { type: "string", description: "Industry or sector" },
      location: { type: "string", description: "Headquarters location" },
      size: { type: "string", description: "Approximate size" },
      description: { type: "string", description: "One-line summary" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};