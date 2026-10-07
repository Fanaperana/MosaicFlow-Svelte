// Calendar events: dates, recurrence and reminder times (shared by the Calendar node and the reminder service).

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface CalendarEvent {
  id: string;
  title: string;
  /** First occurrence, YYYY-MM-DD (local). */
  date: string;
  /** HH:MM (local); empty for all-day events. */
  time?: string;
  repeat?: Repeat;
  /** Minutes before the start to notify; null/undefined = no reminder. */
  remind?: number | null;
  color?: string;
  notes?: string;
}

export const REPEAT_LABELS: Record<Repeat, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

export const REMIND_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At start' },
  { value: 5, label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

/** All-day events remind relative to this time of day. */
const ALL_DAY_HOUR = 9;
const DAY = 86_400_000;

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function occursOn(ev: CalendarEvent, day: Date): boolean {
  const start = parseDay(ev.date);
  const d = startOfDay(day);
  if (d < start) return false;
  switch (ev.repeat ?? 'none') {
    case 'none': return d.getTime() === start.getTime();
    case 'daily': return true;
    case 'weekdays': return d.getDay() !== 0 && d.getDay() !== 6;
    case 'weekly': return d.getDay() === start.getDay();
    case 'monthly': return d.getDate() === start.getDate();
    case 'yearly': return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
  }
}

/** Start time of the occurrence on `day` (all-day events start at 00:00). */
export function startOn(ev: CalendarEvent, day: Date): Date {
  const [h, m] = (ev.time || '00:00').split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0);
}

/** When the reminder for the occurrence on `day` fires, or null without a reminder. */
export function reminderOn(ev: CalendarEvent, day: Date): Date | null {
  if (ev.remind == null) return null;
  const base = ev.time ? startOn(ev, day) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), ALL_DAY_HOUR);
  return new Date(base.getTime() - ev.remind * 60_000);
}

export function eventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => occursOn(e, day))
    .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title));
}

/** Reminders that fall in (from, to]. */
export function remindersBetween(events: CalendarEvent[], from: number, to: number): { event: CalendarEvent; day: Date; at: number }[] {
  const out: { event: CalendarEvent; day: Date; at: number }[] = [];
  for (const ev of events) {
    if (ev.remind == null) continue;
    // A reminder can be up to `remind` minutes (plus the all-day offset) before its day starts.
    const lead = ev.remind * 60_000 + DAY;
    for (let day = startOfDay(new Date(from)); day.getTime() <= to + lead; day = addDays(day, 1)) {
      if (!occursOn(ev, day)) continue;
      const at = reminderOn(ev, day)!.getTime();
      if (at > from && at <= to) out.push({ event: ev, day, at });
    }
  }
  return out;
}

/** Next occurrences from `from`, soonest first. */
export function upcoming(events: CalendarEvent[], from: Date, limit = 20, days = 90): { event: CalendarEvent; day: Date; start: Date }[] {
  const out: { event: CalendarEvent; day: Date; start: Date }[] = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const day = addDays(startOfDay(from), i);
    for (const event of eventsOn(events, day)) {
      const start = startOn(event, day);
      if (event.time && start < from) continue;
      out.push({ event, day, start });
    }
  }
  return out.slice(0, limit);
}

export function formatTime(time: string | undefined): string {
  if (!time) return 'All day';
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
