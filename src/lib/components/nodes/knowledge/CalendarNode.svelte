<!--
  Calendar: month grid with events, recurrence and reminders (reminders fire via services/reminders.ts,
  even when this page is not open).
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import { ChevronLeft, ChevronRight, Plus, Bell, BellOff, Repeat as RepeatIcon, Trash2, CalendarDays, ListTodo, X } from 'lucide-svelte';
  import NodeWrapper from '../_shared/NodeWrapper.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import type { BaseNodeData } from '$lib/types';
  import {
    type CalendarEvent, type Repeat, REPEAT_LABELS, REMIND_OPTIONS,
    ymd, parseDay, addDays, startOfDay, eventsOn, upcoming, formatTime,
  } from '$lib/utils/calendar';

  type CalendarData = BaseNodeData & { events?: CalendarEvent[]; weekStart?: 0 | 1; view?: 'month' | 'agenda' };
  let { data, selected, id }: NodeProps<Node<CalendarData, 'calendar'>> = $props();

  const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

  let events = $derived(data.events ?? []);
  let weekStart = $derived(data.weekStart ?? 1);
  let view = $derived(data.view ?? 'month');

  let now = $state(new Date());
  let month = $state(startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  let selectedDay = $state(startOfDay(new Date()));
  let draft = $state<CalendarEvent | null>(null);

  // Keep "today" right across midnight.
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(t);
  });

  let today = $derived(ymd(now));
  let weekdays = $derived(
    Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + ((i + weekStart) % 7)).toLocaleDateString([], { weekday: 'narrow' }))
  );
  let cells = $derived.by(() => {
    const offset = (month.getDay() - weekStart + 7) % 7;
    const first = addDays(month, -offset);
    return Array.from({ length: 42 }, (_, i) => {
      const day = addDays(first, i);
      return { day, key: ymd(day), inMonth: day.getMonth() === month.getMonth(), events: eventsOn(events, day) };
    });
  });
  let dayEvents = $derived(eventsOn(events, selectedDay));
  let agenda = $derived(upcoming(events, now, 30));

  function save(next: CalendarEvent[]) {
    workspace.updateNodeData(id, { events: next });
  }

  function shiftMonth(delta: number) {
    month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
  }

  function goToday() {
    const t = new Date();
    month = new Date(t.getFullYear(), t.getMonth(), 1);
    selectedDay = startOfDay(t);
  }

  function pickDay(day: Date) {
    selectedDay = day;
    if (day.getMonth() !== month.getMonth()) month = new Date(day.getFullYear(), day.getMonth(), 1);
  }

  function newEvent(day = selectedDay) {
    const t = new Date();
    const hour = Math.min(23, t.getHours() + 1);
    draft = {
      id: crypto.randomUUID(),
      title: '',
      date: ymd(day),
      time: `${String(hour).padStart(2, '0')}:00`,
      repeat: 'none',
      remind: 10,
      color: COLORS[events.length % COLORS.length],
    };
  }

  function editEvent(ev: CalendarEvent) {
    draft = { ...ev };
  }

  function commitDraft() {
    if (!draft) return;
    const ev = { ...draft, title: draft.title.trim() || 'Untitled event' };
    save(events.some((e) => e.id === ev.id) ? events.map((e) => (e.id === ev.id ? ev : e)) : [...events, ev]);
    selectedDay = parseDay(ev.date);
    draft = null;
  }

  function deleteEvent(eventId: string) {
    save(events.filter((e) => e.id !== eventId));
    draft = null;
  }

  function setView(v: 'month' | 'agenda') {
    workspace.updateNodeData(id, { view: v });
  }

  function remindLabel(ev: CalendarEvent): string {
    return REMIND_OPTIONS.find((o) => o.value === (ev.remind ?? null))?.label ?? `${ev.remind} min before`;
  }

  function dayLabel(day: Date): string {
    const key = ymd(day);
    if (key === today) return 'Today';
    if (key === ymd(addDays(now, 1))) return 'Tomorrow';
    return day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function onDraftKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') commitDraft();
    if (e.key === 'Escape') draft = null;
  }
</script>

<NodeWrapper {data} {selected} {id} nodeType="calendar">
  <div class="cal">
    <div class="cal-bar">
      <div class="seg nodrag">
        <button class:active={view === 'month'} onclick={() => setView('month')} title="Month"><CalendarDays size={13} /></button>
        <button class:active={view === 'agenda'} onclick={() => setView('agenda')} title="Upcoming"><ListTodo size={13} /></button>
      </div>
      {#if view === 'month'}
        <span class="month">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
        <div class="nav nodrag">
          <button onclick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={14} /></button>
          <button class="today-btn" onclick={goToday}>Today</button>
          <button onclick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={14} /></button>
        </div>
      {:else}
        <span class="month">Upcoming</span>
      {/if}
      <button class="add nodrag" onclick={() => newEvent()} title="New event"><Plus size={14} /></button>
    </div>

    {#if view === 'month'}
      <div class="grid nodrag">
        {#each weekdays as w, i (i)}
          <span class="wd">{w}</span>
        {/each}
        {#each cells as cell (cell.key)}
          <button
            class="day"
            class:out={!cell.inMonth}
            class:today={cell.key === today}
            class:picked={cell.key === ymd(selectedDay)}
            onclick={() => pickDay(cell.day)}
            ondblclick={(e) => { e.stopPropagation(); pickDay(cell.day); newEvent(cell.day); }}
            title={cell.events.map((e) => `${formatTime(e.time)} ${e.title}`).join('\n')}
          >
            <span class="num">{cell.day.getDate()}</span>
            {#if cell.events.length}
              <span class="dots">
                {#each cell.events.slice(0, 3) as ev (ev.id)}<i style="background: {ev.color ?? COLORS[0]}"></i>{/each}
              </span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="day-head">
        <span>{dayLabel(selectedDay)}</span>
        <span class="count">{dayEvents.length ? `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}</span>
      </div>
      <div class="list nodrag">
        {#each dayEvents as ev (ev.id)}
          <button class="ev" onclick={() => editEvent(ev)} style="--c: {ev.color ?? COLORS[0]}">
            <span class="ev-time">{formatTime(ev.time)}</span>
            <span class="ev-title">{ev.title}</span>
            {#if ev.repeat && ev.repeat !== 'none'}<span title={REPEAT_LABELS[ev.repeat]}><RepeatIcon size={11} /></span>{/if}
            {#if ev.remind != null}<span title={remindLabel(ev)}><Bell size={11} /></span>{/if}
          </button>
        {:else}
          <button class="empty" onclick={() => newEvent()}>No events — add one</button>
        {/each}
      </div>
    {:else}
      <div class="list agenda nodrag">
        {#each agenda as item, i (item.event.id + item.day.getTime())}
          {#if i === 0 || ymd(agenda[i - 1].day) !== ymd(item.day)}
            <div class="agenda-day">{dayLabel(item.day)}</div>
          {/if}
          <button class="ev" onclick={() => editEvent(item.event)} style="--c: {item.event.color ?? COLORS[0]}">
            <span class="ev-time">{formatTime(item.event.time)}</span>
            <span class="ev-title">{item.event.title}</span>
            {#if item.event.remind != null}<span title={remindLabel(item.event)}><Bell size={11} /></span>{/if}
          </button>
        {:else}
          <button class="empty" onclick={() => newEvent()}>Nothing planned in the next 90 days</button>
        {/each}
      </div>
    {/if}

    {#if draft}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="editor nodrag nowheel" onkeydown={onDraftKey}>
        <div class="ed-head">
          <span>{events.some((e) => e.id === draft?.id) ? 'Edit event' : 'New event'}</span>
          <button onclick={() => (draft = null)} aria-label="Close"><X size={13} /></button>
        </div>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="ed-title" placeholder="Event title" bind:value={draft.title} autofocus />
        <div class="ed-row">
          <input type="date" bind:value={draft.date} />
          <input type="time" bind:value={draft.time} title="Leave empty for all day" />
        </div>
        <div class="ed-row">
          <span class="ed-icon"><RepeatIcon size={12} /></span>
          <select bind:value={draft.repeat}>
            {#each Object.entries(REPEAT_LABELS) as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
        </div>
        <div class="ed-row">
          <span class="ed-icon">{#if draft.remind == null}<BellOff size={12} />{:else}<Bell size={12} />{/if}</span>
          <select bind:value={draft.remind}>
            {#each REMIND_OPTIONS as opt (opt.label)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        <div class="ed-colors">
          {#each COLORS as c (c)}
            <button class="swatch" class:on={draft.color === c} style="background: {c}" onclick={() => draft && (draft.color = c)} aria-label="Color {c}"></button>
          {/each}
        </div>
        <textarea placeholder="Notes" rows="2" bind:value={draft.notes}></textarea>
        <div class="ed-actions">
          {#if events.some((e) => e.id === draft?.id)}
            <button class="danger" onclick={() => draft && deleteEvent(draft.id)}><Trash2 size={12} /> Delete</button>
          {/if}
          <span class="spacer"></span>
          <button onclick={() => (draft = null)}>Cancel</button>
          <button class="primary" onclick={commitDraft}>Save</button>
        </div>
      </div>
    {/if}
  </div>
</NodeWrapper>

<style>
  .cal {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font-size: 12px;
    color: var(--mf-text-2);
  }

  .cal-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 6px;
  }

  .month {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--mf-text);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .seg {
    display: flex;
    padding: 2px;
    border-radius: 6px;
    background: var(--mf-active);
  }

  .seg button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 20px;
    border-radius: 4px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .seg button.active {
    background: var(--mf-surface-2);
    color: var(--mf-text);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .nav button,
  .add {
    display: grid;
    place-items: center;
    height: 22px;
    min-width: 22px;
    padding: 0 4px;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .nav button:hover,
  .add:hover {
    background: var(--mf-hover);
    color: var(--mf-text);
  }

  .today-btn {
    font-size: 11px;
  }

  .add {
    background: var(--mf-active);
    color: var(--mf-text-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .wd {
    padding: 2px 0;
    text-align: center;
    color: var(--mf-text-3);
    font-size: 10.5px;
  }

  .day {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 2px;
    height: 30px;
    padding-top: 3px;
    border-radius: 6px;
    background: transparent;
    color: var(--mf-text-2);
    font-variant-numeric: tabular-nums;
  }

  .day:hover {
    background: var(--mf-hover);
  }

  .day.out {
    color: var(--mf-text-3);
    opacity: 0.5;
  }

  .day.today .num {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    margin-top: -1px;
    border-radius: 50%;
    background: #8b5cf6;
    color: #fff;
    font-weight: 600;
  }

  .day.picked {
    background: var(--mf-active);
    color: var(--mf-text);
  }

  .num {
    font-size: 11.5px;
    line-height: 16px;
  }

  .dots {
    display: flex;
    gap: 2px;
  }

  .dots i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    padding: 8px 2px 4px;
    border-top: 1px solid var(--mf-border);
    margin-top: 6px;
    color: var(--mf-text);
    font-weight: 600;
  }

  .count {
    color: var(--mf-text-3);
    font-weight: 400;
  }

  .list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }

  .agenda-day {
    padding: 6px 2px 2px;
    color: var(--mf-text-3);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ev {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    padding: 0 8px;
    border-left: 3px solid var(--c);
    border-radius: 4px;
    background: color-mix(in srgb, var(--c) 10%, transparent);
    color: var(--mf-text-2);
    text-align: left;
  }

  .ev:hover {
    background: color-mix(in srgb, var(--c) 18%, transparent);
  }

  .ev-time {
    flex-shrink: 0;
    width: 58px;
    color: var(--mf-text-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .ev-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--mf-text);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .empty {
    padding: 8px 4px;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-3);
    text-align: left;
  }

  .empty:hover {
    background: var(--mf-hover);
    color: var(--mf-text-2);
  }

  .editor {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 2px;
    overflow-y: auto;
    background: var(--mf-surface, #16171c);
  }

  .ed-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--mf-text);
    font-weight: 600;
  }

  .ed-head button {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    background: transparent;
    color: var(--mf-text-3);
  }

  .editor input,
  .editor select,
  .editor textarea {
    min-width: 0;
    padding: 5px 7px;
    border: 1px solid var(--mf-border);
    border-radius: 6px;
    background: var(--mf-bg, #0e0f13);
    color: var(--mf-text);
    font: inherit;
    outline: none;
    color-scheme: dark;
  }

  .editor input:focus,
  .editor select:focus,
  .editor textarea:focus {
    border-color: #8b5cf6;
  }

  .ed-title {
    font-size: 13px;
    font-weight: 600;
  }

  .ed-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ed-row > input,
  .ed-row > select {
    flex: 1;
  }

  .ed-icon {
    display: grid;
    place-items: center;
    width: 18px;
    color: var(--mf-text-3);
  }

  .ed-colors {
    display: flex;
    gap: 6px;
  }

  .swatch {
    width: 16px;
    height: 16px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
  }

  .swatch.on {
    border-color: var(--mf-text);
  }

  textarea {
    resize: none;
  }

  .ed-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ed-actions .spacer {
    flex: 1;
  }

  .ed-actions button {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: var(--mf-active);
    color: var(--mf-text-2);
  }

  .ed-actions .primary {
    background: #7c3aed;
    color: #fff;
  }

  .ed-actions .danger {
    background: transparent;
    color: #f87171;
  }
</style>
