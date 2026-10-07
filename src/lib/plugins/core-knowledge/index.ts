/**
 * Core Knowledge Blocks Plugin
 *
 * Notion-style building blocks for a knowledge base: Checklist, Callout, Page link, Calendar and Timer.
 */

import type { PluginAPI, PluginModule, PluginNodeType } from '$lib/kernel/plugin-loader';
import ChecklistNode from '$lib/components/nodes/knowledge/ChecklistNode.svelte';
import CalloutNode from '$lib/components/nodes/knowledge/CalloutNode.svelte';
import PageNode from '$lib/components/nodes/knowledge/PageNode.svelte';
import CalendarNode from '$lib/components/nodes/knowledge/CalendarNode.svelte';
import TimerNode from '$lib/components/nodes/knowledge/TimerNode.svelte';

const knowledgeNodes: PluginNodeType[] = [
  {
    type: 'checklist',
    label: 'Checklist',
    description: 'Tasks with checkboxes and progress',
    category: 'content',
    iconName: 'ListChecks',
    keywords: ['todo', 'task', 'checkbox'],
    component: ChecklistNode,
    defaultData: { title: 'Checklist', items: [] },
    dimensions: { minWidth: 180, minHeight: 80, defaultWidth: 280, defaultHeight: 200 },
    colors: { bg: '#14231a', border: '#2f5a3a', icon: '✅' },
    knowledge: {
      purpose: 'A list of tasks that can be ticked off. Use for todos, next steps and acceptance criteria.',
      fields: {
        items: { type: 'object[]', description: 'Tasks of {id, text, done}' },
        hideDone: { type: 'boolean', description: 'Hide completed tasks' },
      },
    },
    quickAccess: true,
  },
  {
    type: 'callout',
    label: 'Callout',
    description: 'Highlighted tip, warning or key idea',
    category: 'content',
    iconName: 'Lightbulb',
    keywords: ['tip', 'warning', 'info', 'note', 'admonition', 'highlight'],
    component: CalloutNode,
    defaultData: { title: 'Callout', icon: '💡', tone: 'tip', content: '' },
    dimensions: { minWidth: 160, minHeight: 60, defaultWidth: 300, defaultHeight: 110 },
    colors: { bg: '#1a2414', border: '#3f6a2f', icon: '💡' },
    knowledge: {
      purpose: 'A short highlighted statement: a tip, warning, definition or key takeaway.',
      bodyField: 'content',
      fields: {
        content: { type: 'markdown', description: 'Callout text in markdown' },
        tone: { type: 'enum', values: ['note', 'info', 'tip', 'warning', 'danger'], description: 'Visual style' },
        icon: { type: 'string', description: 'Emoji shown on the left' },
      },
    },
  },
  {
    type: 'page',
    label: 'Page link',
    description: 'Link to another page of this vault',
    category: 'content',
    iconName: 'FileText',
    keywords: ['link to page', 'canvas', 'subpage', 'reference'],
    component: PageNode,
    defaultData: { title: 'Page', canvasId: '', page: '' },
    dimensions: { minWidth: 180, minHeight: 70, defaultWidth: 260, defaultHeight: 180 },
    colors: { bg: '#161b26', border: '#34405a', icon: '📄' },
    knowledge: {
      purpose: 'A link to another page (canvas) in the same vault, shown as a card with its outline.',
      fields: {
        page: { type: 'string', description: 'Name of the linked page' },
        canvasId: { type: 'string', description: 'Id of the linked page' },
      },
    },
  },
  {
    type: 'calendar',
    label: 'Calendar',
    description: 'Month view with events and reminders',
    category: 'utility',
    iconName: 'CalendarDays',
    keywords: ['event', 'schedule', 'agenda', 'date', 'reminder', 'notify', 'deadline'],
    component: CalendarNode,
    defaultData: { title: 'Calendar', events: [], view: 'month' },
    dimensions: { minWidth: 260, minHeight: 300, defaultWidth: 320, defaultHeight: 420 },
    colors: { bg: '#1b1726', border: '#46386a', icon: '📅' },
    knowledge: {
      purpose: 'A calendar of events. Events can repeat and send a reminder notification before they start.',
      fields: {
        events: {
          type: 'object[]',
          description: 'Events of {id, title, date: YYYY-MM-DD, time?: HH:MM, repeat?: none|daily|weekdays|weekly|monthly|yearly, remind?: minutes before or null, color?, notes?}',
        },
        view: { type: 'enum', values: ['month', 'agenda'], description: 'Month grid or upcoming list' },
      },
    },
    quickAccess: true,
  },
  {
    type: 'timer',
    label: 'Timer',
    description: 'Countdown, stopwatch and pomodoro',
    category: 'utility',
    iconName: 'Timer',
    keywords: ['countdown', 'stopwatch', 'pomodoro', 'focus', 'clock', 'alarm', 'lap'],
    component: TimerNode,
    defaultData: { title: 'Timer', mode: 'countdown', duration: 300_000 },
    dimensions: { minWidth: 220, minHeight: 260, defaultWidth: 260, defaultHeight: 320 },
    colors: { bg: '#1a1a24', border: '#3a3a5a', icon: '⏱️' },
    knowledge: {
      purpose: 'A timer: countdown, stopwatch with laps, or pomodoro focus/break cycles. Notifies when time is up.',
      fields: {
        mode: { type: 'enum', values: ['countdown', 'stopwatch', 'pomodoro'], description: 'Timer kind' },
        duration: { type: 'number', description: 'Countdown length in milliseconds' },
        work: { type: 'number', description: 'Pomodoro focus minutes' },
        short: { type: 'number', description: 'Pomodoro short break minutes' },
        long: { type: 'number', description: 'Pomodoro long break minutes' },
        rounds: { type: 'number', description: 'Focus sessions before a long break' },
      },
    },
    quickAccess: true,
  },
];

export const activate = (api: PluginAPI): void => {
  api.registerNodeTypes(knowledgeNodes);
};

const plugin: PluginModule = { activate };
export default plugin;
