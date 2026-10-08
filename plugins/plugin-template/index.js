/**
 * My Plugin: a MosaicFlow plugin starter.
 *
 * It shows one of everything a plugin can add. Keep what you need and delete the rest:
 *   1. a node type       (a block in the "/" insert menu)
 *   2. a sidebar panel   (ribbon button + right-hand panel)
 *   3. a command         (command palette Ctrl+P, optional shortcut)
 *   4. a template        ("Insert template: …" in the palette)
 *   5. a layout          ("Arrange: …" in the palette)
 *   6. settings          (Settings → Plugins)
 *
 * After editing, open Plugins (puzzle icon) → Rescan. No build step and no restart needed.
 * Full reference: docs/PLUGIN_API.md
 */

/** @param {import('./mosaicflow').PluginAPI} api */
export function activate(api) {
  // ---------------------------------------------------------------------------
  // 6. Settings: register first so the other parts can read them.
  // ---------------------------------------------------------------------------
  api.settings.register([
    { key: 'greeting', label: 'Greeting', description: 'Shown on new cards', type: 'text', default: 'Hello' },
    { key: 'showCount', label: 'Show click counter', type: 'toggle', default: true },
  ]);

  // ---------------------------------------------------------------------------
  // 1. Node type
  // ---------------------------------------------------------------------------
  api.registerNodeTypes([
    {
      type: 'my-plugin-card', // stored in the vault files: never rename it after release
      label: 'My Plugin card',
      description: 'A starter block from My Plugin',
      keywords: ['starter', 'example'],
      iconName: 'Puzzle',
      defaultData: { title: 'My Plugin card', text: '', clicks: 0 },
      dimensions: { minWidth: 180, minHeight: 120, defaultWidth: 260, defaultHeight: 170 },
      colors: { bg: '#1a1d2e', border: '#4a5a8a', icon: '🧩' },
      knowledge: {
        purpose: 'A starter card with a short text and a click counter.',
        bodyField: 'text', // saved as the Markdown body of the node file
        fields: {
          text: { type: 'markdown', description: 'The card text' },
          clicks: { type: 'number', description: 'How many times the button was clicked' },
        },
      },
      render: renderCard(api),
    },
  ]);

  // ---------------------------------------------------------------------------
  // 2. Sidebar panel
  // ---------------------------------------------------------------------------
  api.registerPanels([
    {
      id: 'outline',
      label: 'My Plugin outline',
      description: 'Every node on this page',
      iconName: 'List',
      render: renderOutline(api),
    },
  ]);

  // ---------------------------------------------------------------------------
  // 3. Command
  // ---------------------------------------------------------------------------
  api.registerCommands([
    {
      id: 'count-nodes',
      label: 'My Plugin: count nodes on this page',
      // shortcut: 'Ctrl+Alt+M',   // optional default; users can change it
      handler: () => {
        const count = api.workspace.getNodes().length;
        api.ui.notify(`This page has ${count} node${count === 1 ? '' : 's'}`, 'info');
      },
    },
  ]);

  // ---------------------------------------------------------------------------
  // 4. Template
  // ---------------------------------------------------------------------------
  api.registerTemplates([
    {
      id: 'starter',
      name: 'My Plugin starter',
      description: 'A note linked to two cards',
      // A function, so the greeting setting is read when the template is inserted.
      content: () => ({
        nodes: [
          { key: 'note', type: 'note', x: 0, y: 0, data: { title: 'Start here', content: 'Notes go here.' } },
          { key: 'a', type: 'my-plugin-card', x: 380, y: -100, data: { title: 'Card A', text: api.settings.get('greeting') } },
          { key: 'b', type: 'my-plugin-card', x: 380, y: 120, data: { title: 'Card B', text: api.settings.get('greeting') } },
        ],
        edges: [
          { from: 'note', to: 'a', fromSide: 'right', toSide: 'left' },
          { from: 'note', to: 'b', label: 'see also', fromSide: 'right', toSide: 'left' },
        ],
      }),
    },
  ]);

  // ---------------------------------------------------------------------------
  // 5. Layout
  // ---------------------------------------------------------------------------
  api.registerLayouts([
    {
      id: 'column',
      name: 'Single column',
      description: 'Stack nodes top to bottom',
      arrange: ({ nodes }) => {
        const x = Math.min(...nodes.map((n) => n.x));
        let y = Math.min(...nodes.map((n) => n.y));
        const positions = {};
        for (const n of [...nodes].sort((a, b) => a.y - b.y)) {
          positions[n.id] = { x, y };
          y += n.height + 40;
        }
        return positions;
      },
    },
  ]);
}

/** Optional: stop timers and listeners you started yourself. Everything registered above is removed for you. */
export function deactivate() {}

// -----------------------------------------------------------------------------
// Renderers. Framework-free: draw into `container`, keep it in sync in `update`.
// Use textContent for user data; only renderMarkdown() output is safe for innerHTML.
// -----------------------------------------------------------------------------

/** @param {import('./mosaicflow').PluginAPI} api */
function renderCard(api) {
  /** @type {import('./mosaicflow').NodeType['render']} */
  return (container, ctx) => {
    const root = document.createElement('div');
    root.className = 'my-plugin-card';

    const text = document.createElement('textarea');
    // nodrag/nowheel: typing, selecting and scrolling here won't drag or zoom the canvas.
    text.className = 'my-plugin-card__text nodrag nowheel';
    text.placeholder = 'Write something…';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'my-plugin-card__button nodrag';

    root.append(text, button);
    container.appendChild(root);

    let current = ctx;
    text.addEventListener('input', () => current.update({ text: text.value }));
    button.addEventListener('click', () => current.update({ clicks: (current.data.clicks ?? 0) + 1 }));

    const sync = (next) => {
      current = next;
      // Don't overwrite what the user is typing.
      if (document.activeElement !== text) text.value = next.data.text ?? '';
      button.textContent = api.settings.get('showCount') ? `Clicked ${next.data.clicks ?? 0}×` : 'Click';
    };

    // Re-render when the user changes a setting.
    const stop = api.settings.onChange(() => sync(current));
    sync(ctx);
    return {
      update: sync,
      destroy: () => {
        stop();
        root.remove();
      },
    };
  };
}

/** @param {import('./mosaicflow').PluginAPI} api */
function renderOutline(api) {
  /** @type {import('./mosaicflow').Panel['render']} */
  return (container, ctx) => {
    const list = document.createElement('ul');
    list.className = 'my-plugin-outline';
    container.appendChild(list);

    const draw = (next) => {
      if (!next.page) {
        list.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Open a page.' }));
        return;
      }
      const nodes = api.workspace.getNodes().sort((a, b) => a.y - b.y || a.x - b.x);
      list.replaceChildren(
        ...nodes.map((n) => {
          const item = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = String(n.data.title || n.type);
          button.addEventListener('click', () => api.workspace.select([n.id]));
          item.appendChild(button);
          return item;
        }),
      );
    };

    draw(ctx);
    return { update: draw, destroy: () => list.remove() };
  };
}
