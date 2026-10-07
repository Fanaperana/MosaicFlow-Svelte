// Keyboard shortcuts: chord parsing, user overrides (stored in settings.json) and the global dispatcher.
// Every shortcut is a command in the command registry; plugins add theirs the same way.

import { commandRegistry, type CommandRegistration } from './registries/command-registry';
import { settings } from '$lib/stores/settings.svelte';

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

const CODE_KEYS: Record<string, string> = {
  Backslash: '\\', Slash: '/', Minus: '-', Equal: '=', Comma: ',', Period: '.',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Space: 'Space',
};

const DISPLAY: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', Delete: 'Del', Backspace: '⌫', Enter: '↵',
};

/** "Ctrl+Shift+O" style chord for a key event, or null for a bare modifier press. */
export function eventToChord(e: KeyboardEvent): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock'].includes(e.key)) return null;
  // Physical keys for letters/digits/punctuation so Shift+1 stays "Shift+1", not "!".
  let key: string;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (CODE_KEYS[e.code]) key = CODE_KEYS[e.code];
  else key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta'].filter(Boolean);
  return [...mods, key].join('+');
}

/** Normalises user/plugin input like "shift+ctrl+o" to "Ctrl+Shift+O". */
export function normalizeChord(chord: string): string {
  const parts = chord.split('+').map((p) => p.trim()).filter(Boolean);
  const key = parts.pop() ?? '';
  const mods = MODIFIERS.filter((m) => parts.some((p) => p.toLowerCase() === m.toLowerCase() || (m === 'Meta' && /^(cmd|mod)$/i.test(p))));
  return [...mods, key.length === 1 ? key.toUpperCase() : key].join('+');
}

/** Pieces to render as <kbd> chips. */
export function chordParts(chord: string): string[] {
  return chord.split('+').map((p) => DISPLAY[p] ?? p);
}

function defaultsOf(cmd: CommandRegistration): string[] {
  const raw = cmd.shortcut;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map(normalizeChord);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

class Keybindings {
  /** True while the settings page records a new chord, so nothing else fires. */
  recording = $state(false);
  /** Bumped when commands are added/removed so lists re-read the registry. */
  version = $state(0);

  constructor() {
    commandRegistry.subscribe(() => this.version++);
  }

  defaults(id: string): string[] {
    const cmd = commandRegistry.get(id);
    return cmd ? defaultsOf(cmd) : [];
  }

  get(id: string): string[] {
    return settings.current.keybindings[id] ?? this.defaults(id);
  }

  isCustom(id: string): boolean {
    return id in settings.current.keybindings;
  }

  /** First chord of a command, for tooltips ("" when unbound). */
  label(id: string): string {
    void this.version;
    const chord = this.get(id)[0];
    return chord ? chordParts(chord).join('+') : '';
  }

  commandsFor(chord: string, exceptId?: string): CommandRegistration[] {
    return commandRegistry.getAll().filter((c) => c.id !== exceptId && this.get(c.id).includes(chord));
  }

  set(id: string, chords: string[]) {
    const unique = [...new Set(chords.map(normalizeChord))];
    const next = { ...settings.current.keybindings };
    if (JSON.stringify(unique) === JSON.stringify(this.defaults(id))) delete next[id];
    else next[id] = unique;
    settings.setKeybindings(next);
  }

  /** Adds a chord to a command and removes it from any command that already used it. Returns those commands. */
  assign(id: string, chord: string): CommandRegistration[] {
    const taken = this.commandsFor(chord, id);
    for (const other of taken) this.set(other.id, this.get(other.id).filter((c) => c !== chord));
    this.set(id, [...this.get(id), chord]);
    return taken;
  }

  remove(id: string, chord: string) {
    this.set(id, this.get(id).filter((c) => c !== chord));
  }

  reset(id: string) {
    const { [id]: _custom, ...rest } = settings.current.keybindings;
    settings.setKeybindings(rest);
  }

  resetAll() {
    settings.setKeybindings({});
  }

  /** Handles a keydown; returns true when a command ran. */
  handle(e: KeyboardEvent, appView: string): boolean {
    if (this.recording || e.defaultPrevented) return false;
    const chord = eventToChord(e);
    if (!chord) return false;
    const typing = isTyping(e.target);
    const modal = !!document.querySelector('[aria-modal="true"]');
    const withModifier = /(^|\+)(Ctrl|Alt|Meta)\+/.test(chord);

    for (const cmd of this.commandsFor(chord)) {
      const context = cmd.context ?? 'canvas';
      if (context === 'canvas' && (typing || modal || appView !== 'canvas')) continue;
      if (context === 'global' && typing && !withModifier) continue;
      const enabled = typeof cmd.enabled === 'function' ? cmd.enabled() : cmd.enabled !== false;
      if (!enabled) continue;
      e.preventDefault();
      void commandRegistry.execute(cmd.id).catch((error) => console.error(error));
      return true;
    }
    return false;
  }
}

export const keybindings = new Keybindings();
