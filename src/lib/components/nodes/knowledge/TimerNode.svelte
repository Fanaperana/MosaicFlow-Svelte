<!--
  Timer: countdown, stopwatch with laps, and pomodoro cycles. State is stored as timestamps (endsAt / startedAt)
  so timers keep running across page switches and restarts; services/reminders.ts notifies when one ends off-screen.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import { Play, Pause, RotateCcw, Plus, Flag, SkipForward, Settings2, Volume2, VolumeX, Timer, Hourglass, Coffee } from 'lucide-svelte';
  import NodeWrapper from '../_shared/NodeWrapper.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import type { BaseNodeData } from '$lib/types';
  import { notifyOnce, timerKey } from '$lib/services/reminders';
  import { vaultStore } from '$lib/stores/vault.svelte';

  type Mode = 'countdown' | 'stopwatch' | 'pomodoro';
  type Phase = 'work' | 'short' | 'long';
  type TimerData = BaseNodeData & {
    mode?: Mode;
    duration?: number;
    running?: boolean;
    endsAt?: number;
    remaining?: number;
    startedAt?: number;
    elapsed?: number;
    laps?: number[];
    phase?: Phase;
    completed?: number;
    work?: number;
    short?: number;
    long?: number;
    rounds?: number;
    autoStart?: boolean;
    sound?: boolean;
  };
  let { data, selected, id }: NodeProps<Node<TimerData, 'timer'>> = $props();

  const PRESETS = [1, 3, 5, 10, 15, 25, 45, 60];
  const PHASE_LABEL: Record<Phase, string> = { work: 'Focus', short: 'Short break', long: 'Long break' };

  let now = $state(Date.now());
  let showSettings = $state(false);
  let editing = $state(false);
  let customText = $state('');
  let flash = $state(false);

  let mode = $derived(data.mode ?? 'countdown');
  let running = $derived(!!data.running);
  let phase = $derived(data.phase ?? 'work');
  let rounds = $derived(Math.max(1, data.rounds ?? 4));
  let completed = $derived(data.completed ?? 0);
  let sound = $derived(data.sound !== false);

  function phaseMs(p: Phase): number {
    const minutes = p === 'work' ? data.work ?? 25 : p === 'short' ? data.short ?? 5 : data.long ?? 15;
    return Math.max(1, minutes) * 60_000;
  }

  let total = $derived(mode === 'pomodoro' ? phaseMs(phase) : Math.max(1000, data.duration ?? 5 * 60_000));
  let remaining = $derived(running && data.endsAt ? Math.max(0, data.endsAt - now) : data.remaining ?? total);
  let elapsed = $derived((data.elapsed ?? 0) + (running && data.startedAt ? now - data.startedAt : 0));
  let progress = $derived(mode === 'stopwatch' ? (elapsed % 60_000) / 60_000 : 1 - remaining / total);
  let idle = $derived(!running && (mode === 'stopwatch' ? elapsed === 0 : remaining === total));
  let laps = $derived(data.laps ?? []);

  // Tick while running; slower when idle so "now" stays fresh.
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), running ? (mode === 'stopwatch' ? 50 : 250) : 1000);
    return () => clearInterval(t);
  });

  // Finish detection (also catches timers that ended while the page was closed).
  let finishedAt = 0;
  $effect(() => {
    if (running && mode !== 'stopwatch' && data.endsAt && data.endsAt <= now && data.endsAt !== finishedAt) {
      finishedAt = data.endsAt;
      finish(data.endsAt);
    }
  });

  function save(patch: Partial<TimerData>) {
    workspace.updateNodeData(id, patch);
  }

  function finish(endsAt: number, notify = true) {
    const canvasId = vaultStore.currentCanvas?.id ?? '';
    const title = data.title || 'Timer';
    if (mode === 'pomodoro') {
      const wasWork = phase === 'work';
      const done = wasWork ? completed + 1 : completed;
      const next: Phase = wasWork ? (done % rounds === 0 ? 'long' : 'short') : 'work';
      if (notify) notifyOnce(timerKey(id, endsAt), wasWork ? `${title}: focus done` : `${title}: break over`,
        wasWork ? `Time for a ${next === 'long' ? 'long' : 'short'} break.` : 'Back to focus.', { canvasId, nodeId: id }, sound);
      const auto = data.autoStart !== false && (notify || running);
      save({ phase: next, completed: done, remaining: undefined, running: auto, endsAt: auto ? Date.now() + phaseMs(next) : undefined });
    } else {
      notifyOnce(timerKey(id, endsAt), `${title} finished`, 'Time is up.', { canvasId, nodeId: id }, sound);
      save({ running: false, endsAt: undefined, remaining: 0 });
    }
    if (notify) {
      flash = true;
      setTimeout(() => (flash = false), 2400);
    }
  }

  function start() {
    const t = Date.now();
    if (mode === 'stopwatch') save({ running: true, startedAt: t });
    else save({ running: true, endsAt: t + (remaining > 0 ? remaining : total), remaining: undefined });
  }

  function pause() {
    const t = Date.now();
    if (mode === 'stopwatch') save({ running: false, elapsed: (data.elapsed ?? 0) + (t - (data.startedAt ?? t)), startedAt: undefined });
    else save({ running: false, remaining: Math.max(0, (data.endsAt ?? t) - t), endsAt: undefined });
  }

  function reset() {
    save({
      running: false, endsAt: undefined, remaining: undefined, startedAt: undefined, elapsed: 0, laps: [],
      ...(mode === 'pomodoro' ? { phase: 'work' as Phase, completed: 0 } : {}),
    });
  }

  function setMode(m: Mode) {
    if (m === mode) return;
    save({ mode: m, running: false, endsAt: undefined, remaining: undefined, startedAt: undefined, elapsed: 0, laps: [], phase: 'work', completed: 0 });
  }

  function addMinute() {
    if (running && data.endsAt) save({ endsAt: data.endsAt + 60_000 });
    else save({ remaining: remaining + 60_000, ...(mode === 'countdown' && idle ? { duration: total + 60_000, remaining: undefined } : {}) });
  }

  function setPreset(minutes: number) {
    save({ duration: minutes * 60_000, remaining: undefined, running: false, endsAt: undefined });
  }

  function lap() {
    save({ laps: [...laps, elapsed] });
  }

  function skipPhase() {
    finish(Date.now(), false);
  }

  /** Accepts "90" (minutes), "5:30" (m:ss) or "1:05:00" (h:mm:ss). */
  function parseDuration(text: string): number | null {
    const parts = text.trim().split(':').map((p) => Number(p));
    if (!parts.length || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
    const ms = parts.length === 1 ? parts[0] * 60_000
      : parts.length === 2 ? (parts[0] * 60 + parts[1]) * 1000
      : (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    return ms >= 1000 ? ms : null;
  }

  function beginEdit() {
    if (mode !== 'countdown' || running) return;
    customText = fmt(total);
    editing = true;
  }

  function commitEdit() {
    const ms = parseDuration(customText);
    if (ms) save({ duration: ms, remaining: undefined });
    editing = false;
  }

  function fmt(ms: number, centis = false): string {
    const t = Math.max(0, centis ? ms : Math.ceil(ms / 1000) * 1000);
    const h = Math.floor(t / 3_600_000);
    const m = Math.floor((t % 3_600_000) / 60_000);
    const s = Math.floor((t % 60_000) / 1000);
    const base = h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return centis ? `${base}.${String(Math.floor((t % 1000) / 10)).padStart(2, '0')}` : base;
  }

  const R = 52;
  const C = 2 * Math.PI * R;
  let accent = $derived(mode === 'pomodoro' ? (phase === 'work' ? '#ef4444' : '#22c55e') : mode === 'stopwatch' ? '#3b82f6' : '#8b5cf6');
</script>

<NodeWrapper {data} {selected} {id} nodeType="timer">
  <div class="timer" class:flash>
    <div class="tabs nodrag">
      <button class:active={mode === 'countdown'} onclick={() => setMode('countdown')}><Hourglass size={12} />Timer</button>
      <button class:active={mode === 'stopwatch'} onclick={() => setMode('stopwatch')}><Timer size={12} />Stopwatch</button>
      <button class:active={mode === 'pomodoro'} onclick={() => setMode('pomodoro')}><Coffee size={12} />Pomodoro</button>
    </div>

    <div class="dial">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={R} class="track" />
        <circle
          cx="60" cy="60" r={R}
          class="bar"
          class:running
          style="stroke: {accent}; stroke-dasharray: {C}; stroke-dashoffset: {C * (1 - Math.min(1, Math.max(0, progress)))}"
        />
      </svg>
      <div class="readout">
        {#if mode === 'pomodoro'}
          <span class="phase" style="color: {accent}">{PHASE_LABEL[phase]}</span>
        {/if}
        {#if editing}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="time-input nodrag"
            bind:value={customText}
            autofocus
            onblur={commitEdit}
            onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') editing = false; }}
          />
        {:else}
          <button class="time nodrag" class:editable={mode === 'countdown' && !running} onclick={beginEdit}
            title={mode === 'countdown' && !running ? 'Click to set a custom time' : undefined}>
            {mode === 'stopwatch' ? fmt(elapsed, true) : fmt(remaining)}
          </button>
        {/if}
        {#if mode === 'pomodoro'}
          <span class="rounds">
            {#each Array.from({ length: rounds }) as _, i (i)}
              <i class:done={i < completed % rounds || (completed > 0 && completed % rounds === 0 && phase === 'long')}></i>
            {/each}
          </span>
        {:else if mode === 'countdown' && !running && remaining === 0}
          <span class="phase done">Done</span>
        {/if}
      </div>
    </div>

    <div class="controls nodrag">
      <button class="ctl" onclick={reset} disabled={idle} title="Reset"><RotateCcw size={14} /></button>
      {#if running}
        <button class="ctl main" style="background: {accent}" onclick={pause} title="Pause"><Pause size={18} /></button>
      {:else}
        <button class="ctl main" style="background: {accent}" onclick={start} title="Start"><Play size={18} /></button>
      {/if}
      {#if mode === 'stopwatch'}
        <button class="ctl" onclick={lap} disabled={!running} title="Lap"><Flag size={14} /></button>
      {:else if mode === 'pomodoro'}
        <button class="ctl" onclick={skipPhase} title="Skip to next phase"><SkipForward size={14} /></button>
      {:else}
        <button class="ctl" onclick={addMinute} title="Add 1 minute"><Plus size={14} /><span class="ctl-text">1m</span></button>
      {/if}
    </div>

    {#if mode === 'countdown' && !running}
      <div class="presets nodrag">
        {#each PRESETS as m (m)}
          <button class:active={total === m * 60_000} onclick={() => setPreset(m)}>{m >= 60 ? `${m / 60}h` : `${m}m`}</button>
        {/each}
      </div>
    {/if}

    {#if mode === 'stopwatch' && laps.length}
      <div class="laps nodrag nowheel">
        {#each [...laps].reverse() as at, i (i)}
          {@const n = laps.length - i}
          <div class="lap">
            <span>Lap {n}</span>
            <span class="split">+{fmt(at - (laps[n - 2] ?? 0), true)}</span>
            <span>{fmt(at, true)}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="footer nodrag">
      <button onclick={() => save({ sound: !sound })} title={sound ? 'Sound on' : 'Sound off'}>
        {#if sound}<Volume2 size={13} />{:else}<VolumeX size={13} />{/if}
      </button>
      {#if mode === 'pomodoro'}
        <span class="meta">{completed} focus session{completed === 1 ? '' : 's'}</span>
        <button class:active={showSettings} onclick={() => (showSettings = !showSettings)} title="Pomodoro settings"><Settings2 size={13} /></button>
      {/if}
    </div>

    {#if mode === 'pomodoro' && showSettings}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="settings nodrag" onkeydown={(e) => e.stopPropagation()}>
        <label>Focus <input type="number" min="1" max="180" value={data.work ?? 25} onchange={(e) => save({ work: +(e.target as HTMLInputElement).value || 25 })} /> min</label>
        <label>Short break <input type="number" min="1" max="60" value={data.short ?? 5} onchange={(e) => save({ short: +(e.target as HTMLInputElement).value || 5 })} /> min</label>
        <label>Long break <input type="number" min="1" max="120" value={data.long ?? 15} onchange={(e) => save({ long: +(e.target as HTMLInputElement).value || 15 })} /> min</label>
        <label>Long break every <input type="number" min="1" max="12" value={rounds} onchange={(e) => save({ rounds: +(e.target as HTMLInputElement).value || 4 })} /> rounds</label>
        <label class="check"><input type="checkbox" checked={data.autoStart !== false} onchange={(e) => save({ autoStart: (e.target as HTMLInputElement).checked })} /> Start next phase automatically</label>
      </div>
    {/if}
  </div>
</NodeWrapper>

<style>
  .timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    height: 100%;
    min-height: 0;
    font-size: 12px;
    color: var(--mf-text-2);
    border-radius: 8px;
    transition: box-shadow 0.3s;
  }

  .timer.flash {
    animation: flash 0.6s ease-in-out 4;
  }

  @keyframes flash {
    50% { box-shadow: inset 0 0 0 2px #f59e0b, 0 0 24px rgba(245, 158, 11, 0.35); }
  }

  .tabs {
    display: flex;
    width: 100%;
    padding: 2px;
    border-radius: 7px;
    background: var(--mf-active);
  }

  .tabs button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 22px;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-3);
    font-size: 11px;
  }

  .tabs button.active {
    background: var(--mf-surface-2);
    color: var(--mf-text);
  }

  .dial {
    position: relative;
    width: 132px;
    height: 132px;
    flex-shrink: 0;
  }

  svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .track {
    fill: none;
    stroke: var(--mf-active);
    stroke-width: 6;
  }

  .bar {
    fill: none;
    stroke-width: 6;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.25s linear;
  }

  .readout {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .time {
    padding: 0 4px;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text);
    font-size: 24px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    cursor: default;
  }

  .time.editable {
    cursor: text;
  }

  .time.editable:hover {
    background: var(--mf-hover);
  }

  .time-input {
    width: 96px;
    padding: 2px 4px;
    border: 1px solid #8b5cf6;
    border-radius: 5px;
    background: var(--mf-bg, #0e0f13);
    color: var(--mf-text);
    font-size: 20px;
    font-weight: 600;
    text-align: center;
    outline: none;
  }

  .phase {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .phase.done {
    color: #f59e0b;
  }

  .rounds {
    display: flex;
    gap: 4px;
  }

  .rounds i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--mf-active);
  }

  .rounds i.done {
    background: #ef4444;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ctl {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--mf-active);
    color: var(--mf-text-2);
  }

  .ctl:hover:not(:disabled) {
    color: var(--mf-text);
    filter: brightness(1.2);
  }

  .ctl:disabled {
    opacity: 0.4;
  }

  .ctl.main {
    width: 44px;
    height: 44px;
    color: #fff;
  }

  .ctl-text {
    font-size: 10px;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }

  .presets button {
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    background: var(--mf-active);
    color: var(--mf-text-3);
    font-size: 11px;
  }

  .presets button:hover,
  .presets button.active {
    color: var(--mf-text);
  }

  .presets button.active {
    background: color-mix(in srgb, #8b5cf6 35%, transparent);
  }

  .laps {
    width: 100%;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .lap {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    padding: 3px 4px;
    border-bottom: 1px solid var(--mf-border);
    font-variant-numeric: tabular-nums;
  }

  .split {
    color: var(--mf-text-3);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin-top: auto;
  }

  .footer button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 22px;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .footer button:hover,
  .footer button.active {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .meta {
    flex: 1;
    text-align: center;
    color: var(--mf-text-3);
    font-size: 11px;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    padding: 8px;
    border-radius: 7px;
    background: var(--mf-active);
  }

  .settings label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .settings input[type='number'] {
    width: 48px;
    margin-left: auto;
    padding: 2px 4px;
    border: 1px solid var(--mf-border);
    border-radius: 4px;
    background: var(--mf-bg, #0e0f13);
    color: var(--mf-text);
    font: inherit;
    color-scheme: dark;
  }

  .settings .check input {
    accent-color: #ef4444;
  }
</style>
