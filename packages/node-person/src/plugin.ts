import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import PersonNode from "./PersonNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "person",
  label: "Person",
  description: "Individual profiles and contacts",
  category: "entity",
  iconName: "User",
  component: PersonNode,
  defaultData: { title: "Person", name: "" },
  dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 250, defaultHeight: 200 },
  colors: { bg: "#2e1a2e", border: "#6a4a6a", icon: "👤" },
  knowledge: {
    purpose: "A real individual. Link them to organizations, accounts, posts and events with edges.",
    fields: {
      name: { type: "string", description: "Full name", required: true },
      aliases: { type: "string[]", description: "Nicknames or handles" },
      email: { type: "string", description: "Email address" },
      phone: { type: "string", description: "Phone number" },
      organization: { type: "string", description: "Employer or affiliation" },
      role: { type: "string", description: "Job title or role" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
  quickAccess: true,
};