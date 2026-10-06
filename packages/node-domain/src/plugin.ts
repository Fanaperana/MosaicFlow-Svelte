import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import DomainNode from "./DomainNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "domain",
  label: "Domain",
  description: "Internet domains and DNS info",
  category: "data",
  iconName: "Globe",
  component: DomainNode,
  defaultData: { title: "Domain", domain: "" },
  dimensions: { minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 },
  colors: { bg: "#1a1a2e", border: "#4a4a6a", icon: "🌐" },
  knowledge: {
    purpose: "An internet domain name and its registration/DNS details.",
    fields: {
      domain: { type: "string", description: "Domain name, e.g. example.com", required: true },
      registrar: { type: "string", description: "Registrar" },
      ip: { type: "string", description: "Primary IP address" },
      ipAddresses: { type: "string[]", description: "All resolved IP addresses" },
      nameservers: { type: "string[]", description: "Nameservers" },
      createdDate: { type: "date", description: "Registration date" },
      expiryDate: { type: "date", description: "Expiry date" },
      notes: { type: "markdown", description: "Free-form notes" },
    },
  },
};