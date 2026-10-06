import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import SocialPostNode from "./SocialPostNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "socialPost",
  label: "Social Post",
  description: "Social media posts",
  category: "data",
  iconName: "MessageSquare",
  component: SocialPostNode,
  defaultData: { title: "Social Post", platform: "twitter", content: "" },
  dimensions: { minWidth: 200, minHeight: 150, defaultWidth: 280, defaultHeight: 220 },
  colors: { bg: "#1a2e2e", border: "#4a6a6a", icon: "💬" },
  knowledge: {
    purpose: "A captured social media post.",
    bodyField: "content",
    fields: {
      content: { type: "markdown", description: "Post text" },
      platform: { type: "string", description: "e.g. twitter, mastodon, reddit" },
      author: { type: "string", description: "Display name of the author" },
      handle: { type: "string", description: "Author handle" },
      postUrl: { type: "url", description: "Link to the post" },
      timestamp: { type: "date", description: "When it was posted" },
    },
  },
};