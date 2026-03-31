const fs = require("fs");
const path = require("path");

const nodes = [
  // Content
  { pkg: "node-note", type: "note", component: "NoteNode", label: "Note", desc: "Markdown-supported text notes", category: "content", icon: "StickyNote",
    defaultData: '{ title: "New Note", content: "", viewMode: "edit" }',
    dims: "{ minWidth: 120, minHeight: 60, defaultWidth: 280, defaultHeight: 200 }",
    colors: '{ bg: "#1a1a2e", border: "#4a4a6a", icon: "📝" }', quickAccess: true,
    dataInterface: 'export interface NoteNodeData extends BaseNodeData {\n  content: string;\n  isEditing?: boolean;\n  viewMode?: "edit" | "view";\n}'
  },
  { pkg: "node-simple-text", type: "simpleText", component: "SimpleTextNode", label: "Simple Text", desc: "Plain text without formatting", category: "content", icon: "Type",
    defaultData: '{ title: "Text", content: "", bgOpacity: 0, borderWidth: 0 }',
    dims: "{ minWidth: 120, minHeight: 60, defaultWidth: 200, defaultHeight: 100 }",
    colors: '{ bg: "#1a1a2e", border: "#4a4a6a", icon: "📄" }', quickAccess: false,
    dataInterface: 'export interface SimpleTextNodeData extends BaseNodeData {\n  content: string;\n  textAlign?: string;\n}'
  },
  { pkg: "node-image", type: "image", component: "ImageNode", label: "Image", desc: "Display images with drag-and-drop support", category: "content", icon: "Image",
    defaultData: '{ title: "Image", imageUrl: "", caption: "" }',
    dims: "{ minWidth: 150, minHeight: 150, defaultWidth: 300, defaultHeight: 250 }",
    colors: '{ bg: "#1a2e1a", border: "#4a6a4a", icon: "🖼️" }', quickAccess: true,
    dataInterface: 'export interface ImageNodeData extends BaseNodeData {\n  imageUrl?: string;\n  imagePath?: string;\n  caption?: string;\n}'
  },
  { pkg: "node-link", type: "link", component: "LinkNode", label: "Link", desc: "Web URLs with descriptions", category: "content", icon: "Link",
    defaultData: '{ title: "Link", url: "", description: "" }',
    dims: "{ minWidth: 200, minHeight: 100, defaultWidth: 250, defaultHeight: 140 }",
    colors: '{ bg: "#2e1a1a", border: "#6a4a4a", icon: "🔗" }', quickAccess: true,
    dataInterface: 'export interface LinkNodeData extends BaseNodeData {\n  url: string;\n  description?: string;\n  favicon?: string;\n}'
  },
  { pkg: "node-code", type: "code", component: "CodeNode", label: "Code Snippet", desc: "Syntax-highlighted code blocks", category: "content", icon: "Code",
    defaultData: '{ title: "Code", code: "", language: "javascript" }',
    dims: "{ minWidth: 300, minHeight: 200, defaultWidth: 400, defaultHeight: 300 }",
    colors: '{ bg: "#1a2e2e", border: "#4a6a6a", icon: "💻" }', quickAccess: false,
    dataInterface: 'export interface CodeNodeData extends BaseNodeData {\n  code: string;\n  language: string;\n}'
  },
  { pkg: "node-iframe", type: "iframe", component: "IframeNode", label: "Iframe", desc: "Embed external webpages", category: "content", icon: "LayoutGrid",
    defaultData: '{ title: "Embed", url: "" }',
    dims: "{ minWidth: 300, minHeight: 250, defaultWidth: 500, defaultHeight: 400 }",
    colors: '{ bg: "#2e1a1a", border: "#6a4a4a", icon: "🖥️" }', quickAccess: false,
    dataInterface: 'export interface IframeNodeData extends BaseNodeData {\n  url: string;\n  allowFullscreen?: boolean;\n  sandbox?: string;\n}'
  },
  // Entity
  { pkg: "node-person", type: "person", component: "PersonNode", label: "Person", desc: "Individual profiles and contacts", category: "entity", icon: "User",
    defaultData: '{ title: "Person", name: "" }',
    dims: "{ minWidth: 200, minHeight: 150, defaultWidth: 250, defaultHeight: 200 }",
    colors: '{ bg: "#2e1a2e", border: "#6a4a6a", icon: "👤" }', quickAccess: true,
    dataInterface: 'export interface PersonNodeData extends BaseNodeData {\n  name: string;\n  email?: string;\n  phone?: string;\n  aliases?: string[];\n  avatar?: string;\n  organization?: string;\n  role?: string;\n}'
  },
  { pkg: "node-organization", type: "organization", component: "OrganizationNode", label: "Organization", desc: "Companies and groups", category: "entity", icon: "Building2",
    defaultData: '{ title: "Organization", name: "" }',
    dims: "{ minWidth: 200, minHeight: 150, defaultWidth: 250, defaultHeight: 200 }",
    colors: '{ bg: "#1a2e1a", border: "#4a6a4a", icon: "🏢" }', quickAccess: false,
    dataInterface: 'export interface OrganizationNodeData extends BaseNodeData {\n  name: string;\n  type?: string;\n  website?: string;\n  description?: string;\n  logo?: string;\n  industry?: string;\n  location?: string;\n  size?: string;\n}'
  },
  { pkg: "node-timestamp", type: "timestamp", component: "TimestampNode", label: "Timestamp", desc: "Date and time markers", category: "entity", icon: "Clock",
    defaultData: '{ title: "Timestamp", datetime: new Date().toISOString(), format: "datetime", useCurrentTime: true, showMonth: true, showYear: true, showDayOfWeek: true, showDay: true, showHour: true, showMinute: true, showSecond: false, showMillisecond: false, use24HourFormat: false, multiLine: false }',
    dims: "{ minWidth: 120, minHeight: 50, defaultWidth: 200, defaultHeight: 70 }",
    colors: '{ bg: "#2e2e1a", border: "#6a6a4a", icon: "🕐" }', quickAccess: false,
    dataInterface: 'export interface TimestampNodeData extends BaseNodeData {\n  datetime: string;\n  format?: "date" | "time" | "datetime" | "relative";\n  timezone?: string;\n  textColor?: string;\n  showMonth?: boolean;\n  showYear?: boolean;\n  showDayOfWeek?: boolean;\n  showDay?: boolean;\n  showHour?: boolean;\n  showMinute?: boolean;\n  showSecond?: boolean;\n  showMillisecond?: boolean;\n  useCurrentTime?: boolean;\n  multiLine?: boolean;\n  use24HourFormat?: boolean;\n  customTimestamp?: string;\n  date?: string;\n  time?: string;\n  label?: string;\n}'
  },
  // Data
  { pkg: "node-domain", type: "domain", component: "DomainNode", label: "Domain", desc: "Internet domains and DNS info", category: "data", icon: "Globe",
    defaultData: '{ title: "Domain", domain: "" }',
    dims: "{ minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 }",
    colors: '{ bg: "#1a1a2e", border: "#4a4a6a", icon: "🌐" }', quickAccess: false,
    dataInterface: 'export interface DomainNodeData extends BaseNodeData {\n  domain: string;\n  registrar?: string;\n  createdDate?: string;\n  expiryDate?: string;\n  nameservers?: string[];\n  ipAddresses?: string[];\n  protocol?: "http" | "https";\n  ip?: string;\n  created?: string;\n  expires?: string;\n}'
  },
  { pkg: "node-hash", type: "hash", component: "HashNode", label: "Hash", desc: "File hashes and checksums", category: "data", icon: "FileDigit",
    defaultData: '{ title: "Hash", hash: "", algorithm: "sha256" }',
    dims: "{ minWidth: 200, minHeight: 100, defaultWidth: 280, defaultHeight: 160 }",
    colors: '{ bg: "#2e1a1a", border: "#6a4a4a", icon: "#️⃣" }', quickAccess: false,
    dataInterface: 'export interface HashNodeData extends BaseNodeData {\n  hash: string;\n  algorithm: "md5" | "sha1" | "sha256" | "sha512" | "other";\n  filename?: string;\n  threatLevel?: "unknown" | "safe" | "suspicious" | "malicious";\n  virusTotalUrl?: string;\n  type?: string;\n  value?: string;\n  status?: "clean" | "malicious" | "unknown";\n  source?: string;\n}'
  },
  { pkg: "node-credential", type: "credential", component: "CredentialNode", label: "Credential", desc: "Usernames and credentials", category: "data", icon: "KeyRound",
    defaultData: '{ title: "Credential", username: "", platform: "" }',
    dims: "{ minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 }",
    colors: '{ bg: "#2e2e1a", border: "#6a6a4a", icon: "🔑" }', quickAccess: false,
    dataInterface: 'export interface CredentialNodeData extends BaseNodeData {\n  username?: string;\n  email?: string;\n  platform?: string;\n  source?: string;\n  breached?: boolean;\n  service?: string;\n  password?: string;\n  compromised?: boolean;\n}'
  },
  { pkg: "node-social-post", type: "socialPost", component: "SocialPostNode", label: "Social Post", desc: "Social media posts", category: "data", icon: "MessageSquare",
    defaultData: '{ title: "Social Post", platform: "twitter", content: "" }',
    dims: "{ minWidth: 200, minHeight: 150, defaultWidth: 280, defaultHeight: 220 }",
    colors: '{ bg: "#1a2e2e", border: "#4a6a6a", icon: "💬" }', quickAccess: false,
    dataInterface: 'export interface SocialPostNodeData extends BaseNodeData {\n  platform: string;\n  author?: string;\n  content: string;\n  postUrl?: string;\n  timestamp?: string;\n  engagement?: { likes?: number; shares?: number; comments?: number };\n  url?: string;\n  avatar?: string;\n  handle?: string;\n  likes?: number;\n  reposts?: number;\n  replies?: number;\n}'
  },
  { pkg: "node-router", type: "router", component: "RouterNode", label: "Router", desc: "Network devices and routers", category: "data", icon: "Router",
    defaultData: '{ title: "Router", name: "" }',
    dims: "{ minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 }",
    colors: '{ bg: "#2e1a2e", border: "#6a4a6a", icon: "📡" }', quickAccess: false,
    dataInterface: 'export interface RouterNodeData extends BaseNodeData {\n  name: string;\n  ipAddress?: string;\n  macAddress?: string;\n  manufacturer?: string;\n  model?: string;\n  ip?: string;\n  mac?: string;\n  vendor?: string;\n  status?: "online" | "offline" | "unknown";\n  ports?: number[];\n}'
  },
  { pkg: "node-snapshot", type: "snapshot", component: "SnapshotNode", label: "Snapshot", desc: "Web page snapshots", category: "data", icon: "Camera",
    defaultData: '{ title: "Snapshot", url: "" }',
    dims: "{ minWidth: 200, minHeight: 150, defaultWidth: 300, defaultHeight: 250 }",
    colors: '{ bg: "#1a2e1a", border: "#4a6a4a", icon: "📸" }', quickAccess: false,
    dataInterface: 'export interface SnapshotNodeData extends BaseNodeData {\n  url: string;\n  screenshotPath?: string;\n  capturedAt?: string;\n  htmlPath?: string;\n  imageUrl?: string;\n  sourceUrl?: string;\n  timestamp?: string;\n  hash?: string;\n}'
  },
  // Utility
  { pkg: "node-group", type: "group", component: "GroupNode", label: "Group", desc: "Group and organize nodes", category: "utility", icon: "FolderOpen",
    defaultData: '{ title: "Group", label: "Group", childNodeIds: [] }',
    dims: "{ minWidth: 200, minHeight: 200, defaultWidth: 400, defaultHeight: 300 }",
    colors: '{ bg: "#3b82f6", border: "#3b82f6", icon: "📁" }', quickAccess: true,
    dataInterface: 'export interface GroupNodeData extends BaseNodeData {\n  label?: string;\n  childNodeIds?: string[];\n  fontSize?: number;\n  fontFamily?: string;\n  fontWeight?: "normal" | "medium" | "semibold" | "bold";\n  fontStyle?: "normal" | "italic";\n  labelColor?: string;\n  collapsed?: boolean;\n  groupColor?: string;\n  groupBgColor?: string;\n  groupBgOpacity?: number;\n  description?: string;\n}'
  },
  { pkg: "node-map", type: "map", component: "MapNode", label: "Map", desc: "Interactive map with markers", category: "utility", icon: "MapPin",
    defaultData: '{ title: "Map", latitude: 40.7128, longitude: -74.006, zoom: 12 }',
    dims: "{ minWidth: 250, minHeight: 200, defaultWidth: 350, defaultHeight: 300 }",
    colors: '{ bg: "#1a2e1a", border: "#4a6a4a", icon: "📍" }', quickAccess: false,
    dataInterface: 'export interface MapNodeData extends BaseNodeData {\n  latitude?: number;\n  longitude?: number;\n  zoom?: number;\n  address?: string;\n  label?: string;\n}'
  },
  { pkg: "node-link-list", type: "linkList", component: "LinkListNode", label: "Link List", desc: "Collection of bookmarks", category: "utility", icon: "List",
    defaultData: '{ title: "Links", links: [] }',
    dims: "{ minWidth: 200, minHeight: 100, defaultWidth: 280, defaultHeight: 200 }",
    colors: '{ bg: "#2e1a2e", border: "#6a4a6a", icon: "📋" }', quickAccess: false,
    dataInterface: 'export interface LinkItem {\n  id: string;\n  url: string;\n  label: string;\n  description?: string;\n}\n\nexport interface LinkListNodeData extends BaseNodeData {\n  links: LinkItem[];\n}'
  },
  { pkg: "node-action", type: "action", component: "ActionNode", label: "Action", desc: "Tasks and action items", category: "utility", icon: "CheckSquare",
    defaultData: '{ title: "Action", action: "", status: "pending" }',
    dims: "{ minWidth: 200, minHeight: 120, defaultWidth: 250, defaultHeight: 180 }",
    colors: '{ bg: "#2e2e1a", border: "#6a6a4a", icon: "✅" }', quickAccess: false,
    dataInterface: 'export interface ActionNodeData extends BaseNodeData {\n  action: string;\n  status: "pending" | "in-progress" | "completed" | "cancelled";\n  dueDate?: string;\n  priority?: "low" | "medium" | "high";\n  assignee?: string;\n}'
  },
  { pkg: "node-annotation", type: "annotation", component: "AnnotationNode", label: "Annotation", desc: "Visual callouts and arrows", category: "utility", icon: "MessageCircle",
    defaultData: '{ title: "Annotation", label: "Note", arrowPosition: "bottom-left", arrowRotation: 0, fontSize: 16 }',
    dims: "{ minWidth: 100, minHeight: 60, defaultWidth: 200, defaultHeight: 120 }",
    colors: '{ bg: "transparent", border: "transparent", icon: "💭" }', quickAccess: false,
    dataInterface: 'export interface AnnotationNodeData extends BaseNodeData {\n  label: string;\n  arrow?: string;\n  arrowStyle?: string;\n  arrowPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "left" | "right" | "none";\n  arrowRotation?: number;\n  arrowFlipX?: boolean;\n  arrowFlipY?: boolean;\n  fontSize?: number;\n  fontWeight?: string;\n  fontStyle?: "normal" | "italic";\n  textAlign?: "left" | "center" | "right";\n  content?: string;\n  annotationType?: "note" | "info" | "warning" | "error" | "success";\n  author?: string;\n}'
  },
];

for (const n of nodes) {
  const dir = path.join("packages", n.pkg);

  // package.json
  const pkgJson = {
    name: `@mosaicflow/${n.pkg}`,
    version: "0.1.0",
    description: n.desc,
    type: "module",
    svelte: "./src/index.ts",
    main: "./src/index.ts",
    types: "./src/index.ts",
    exports: {
      ".": "./src/index.ts",
      "./types": "./src/types.ts",
      "./plugin": "./src/plugin.ts"
    },
    peerDependencies: {
      "@mosaicflow/node-sdk": "workspace:*",
      "@xyflow/svelte": "^1.5.0",
      "lucide-svelte": ">=0.400.0",
      "svelte": "^5.0.0"
    }
  };
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n");

  // src/types.ts
  const typesContent = `import type { BaseNodeData } from "@mosaicflow/node-sdk/types";\n\n${n.dataInterface}\n`;
  fs.writeFileSync(path.join(dir, "src/types.ts"), typesContent);

  // src/plugin.ts
  const pluginContent = [
    `import type { NodeTypeRegistration } from "$lib/kernel/registries/node-registry";`,
    `import ${n.component} from "./${n.component}.svelte";`,
    ``,
    `export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {`,
    `  type: "${n.type}",`,
    `  label: "${n.label}",`,
    `  description: "${n.desc}",`,
    `  category: "${n.category}",`,
    `  iconName: "${n.icon}",`,
    `  component: ${n.component},`,
    `  defaultData: ${n.defaultData},`,
    `  dimensions: ${n.dims},`,
    `  colors: ${n.colors},`,
    n.quickAccess ? `  quickAccess: true,` : null,
    `};`,
    ``
  ].filter(Boolean).join("\n");
  fs.writeFileSync(path.join(dir, "src/plugin.ts"), pluginContent);

  // src/index.ts
  const indexContent = [
    `export { default as ${n.component} } from "./${n.component}.svelte";`,
    `export type * from "./types";`,
    `export { metadata } from "./plugin";`,
    ``
  ].join("\n");
  fs.writeFileSync(path.join(dir, "src/index.ts"), indexContent);
}

console.log(`Generated ${nodes.length} node packages`);
