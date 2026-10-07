// Reminders: calendar events and finished timers anywhere in the vault notify via the OS, a toast and a chime.

import { toast } from 'svelte-sonner';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { knowledge } from '$lib/stores/knowledge.svelte';
import { openNode } from '$lib/services/navigation';
import { remindersBetween, formatTime, type CalendarEvent } from '$lib/utils/calendar';

const FIRED_KEY = 'mosaicflow:reminders-fired';
const CHECK_MS = 5_000;
/** Reminders missed while the app was closed are still shown if they are this recent. */
const CATCH_UP_MS = 10 * 60_000;

let fired: Record<string, number> = load();

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function remember(key: string) {
  const weekAgo = Date.now() - 7 * 86_400_000;
  fired = Object.fromEntries(Object.entries(fired).filter(([, t]) => t > weekAgo));
  fired[key] = Date.now();
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
}

let audio: AudioContext | null = null;

/** A short three-note chime. */
export function chime() {
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    [880, 1175, 1568].forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    // Audio is best effort.
  }
}

async function osNotify(title: string, body: string) {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title, body });
  } catch (error) {
    console.warn('[reminders] OS notification failed:', error);
  }
}

export interface ReminderTarget {
  canvasId: string;
  nodeId: string;
}

/** Notifies once per key (a remembered key never fires again). */
export function notifyOnce(key: string, title: string, body: string, target?: ReminderTarget, sound = true): boolean {
  if (fired[key]) return false;
  remember(key);
  if (sound) chime();
  void osNotify(title, body);
  toast(title, {
    description: body,
    duration: 15_000,
    action: target ? { label: 'Open', onClick: () => openNode(target.canvasId, target.nodeId) } : undefined,
  });
  return true;
}

let lastCheck = 0;

function check() {
  const now = Date.now();
  const from = lastCheck || now - CATCH_UP_MS;
  lastCheck = now;
  for (const node of knowledge.index.nodes) {
    if (node.type === 'calendar') {
      const events = Array.isArray(node.data.events) ? (node.data.events as CalendarEvent[]) : [];
      for (const { event, day, at } of remindersBetween(events, from, now)) {
        const when = event.remind ? `${formatTime(event.time)} · in ${event.remind >= 60 ? `${event.remind / 60} h` : `${event.remind} min`}` : formatTime(event.time);
        notifyOnce(
          `cal:${node.id}:${event.id}:${day.toDateString()}:${at}`,
          event.title || 'Event',
          `${when}${node.title ? ` — ${node.title}` : ''}`,
          { canvasId: node.canvasId, nodeId: node.id }
        );
      }
    } else if (node.type === 'timer') {
      const d = node.data as { running?: boolean; endsAt?: number; mode?: string; title?: string; sound?: boolean };
      if (d.running && d.mode !== 'stopwatch' && typeof d.endsAt === 'number' && d.endsAt <= now && d.endsAt > now - CATCH_UP_MS) {
        notifyOnce(timerKey(node.id, d.endsAt), `${d.title || 'Timer'} finished`, 'Time is up.', { canvasId: node.canvasId, nodeId: node.id }, d.sound !== false);
      }
    }
  }
}

export function timerKey(nodeId: string, endsAt: number): string {
  return `timer:${nodeId}:${endsAt}`;
}

/** Starts the background check; returns a stop function. */
export function startReminders(): () => void {
  lastCheck = 0;
  const handle = setInterval(check, CHECK_MS);
  setTimeout(check, 1500);
  return () => clearInterval(handle);
}
