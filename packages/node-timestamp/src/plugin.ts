import type { NodeTypeRegistration } from "@mosaicflow/node-sdk/registry";
import TimestampNode from "./TimestampNode.svelte";
export const metadata: Omit<NodeTypeRegistration, "pluginId"> = {
  type: "timestamp",
  label: "Timestamp",
  description: "Date and time markers",
  category: "entity",
  iconName: "Clock",
  component: TimestampNode,
  defaultData: { title: "Timestamp", datetime: new Date().toISOString(), format: "datetime", useCurrentTime: true, showMonth: true, showYear: true, showDayOfWeek: true, showDay: true, showHour: true, showMinute: true, showSecond: false, showMillisecond: false, use24HourFormat: false, multiLine: false },
  dimensions: { minWidth: 120, minHeight: 50, defaultWidth: 200, defaultHeight: 70 },
  colors: { bg: "#2e2e1a", border: "#6a6a4a", icon: "🕐" },
};