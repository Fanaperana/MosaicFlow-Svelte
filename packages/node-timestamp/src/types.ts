import type { BaseNodeData } from "@mosaicflow/node-sdk/types";

export interface TimestampNodeData extends BaseNodeData {
  datetime: string;
  format?: "date" | "time" | "datetime" | "relative";
  timezone?: string;
  textColor?: string;
  showMonth?: boolean;
  showYear?: boolean;
  showDayOfWeek?: boolean;
  showDay?: boolean;
  showHour?: boolean;
  showMinute?: boolean;
  showSecond?: boolean;
  showMillisecond?: boolean;
  useCurrentTime?: boolean;
  multiLine?: boolean;
  use24HourFormat?: boolean;
  customTimestamp?: string;
  date?: string;
  time?: string;
  label?: string;
}
