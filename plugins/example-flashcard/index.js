/**
 * Example plugin: Flashcard node.
 *
 * A question on the front, the answer on the back; click to flip.
 * Plugins are plain ES modules: no build step and no framework required.
 * Draw into `container`, and keep the DOM in sync in `update(ctx)`.
 */

function renderFlashcard(container, ctx) {
  const card = document.createElement('div');
  card.className = 'mf-flashcard';
  card.innerHTML = `
    <div class="mf-flashcard__side mf-flashcard__front">
      <span class="mf-flashcard__label">Question</span>
      <textarea class="mf-flashcard__input nodrag nowheel" data-field="question" placeholder="Ask something…"></textarea>
    </div>
    <div class="mf-flashcard__side mf-flashcard__back">
      <span class="mf-flashcard__label">Answer</span>
      <div class="mf-flashcard__answer markdown-content"></div>
      <textarea class="mf-flashcard__input nodrag nowheel" data-field="answer" placeholder="Write the answer (markdown)…"></textarea>
    </div>
    <div class="mf-flashcard__bar">
      <button class="mf-flashcard__flip nodrag" type="button">Show answer</button>
      <span class="mf-flashcard__score"></span>
    </div>`;
  container.appendChild(card);

  const question = card.querySelector('[data-field="question"]');
  const answerInput = card.querySelector('[data-field="answer"]');
  const answerView = card.querySelector('.mf-flashcard__answer');
  const flip = card.querySelector('.mf-flashcard__flip');
  const score = card.querySelector('.mf-flashcard__score');
  let current = ctx;

  question.addEventListener('input', () => current.update({ question: question.value }));
  answerInput.addEventListener('input', () => current.update({ answer: answerInput.value }));
  flip.addEventListener('click', () => {
    const flipped = !current.data.flipped;
    current.update({ flipped, reviews: (current.data.reviews ?? 0) + (flipped ? 1 : 0) });
  });

  function sync(next) {
    current = next;
    const { data, selected } = next;
    // Don't overwrite what the user is typing.
    if (document.activeElement !== question) question.value = data.question ?? '';
    if (document.activeElement !== answerInput) answerInput.value = data.answer ?? '';
    // renderMarkdown sanitizes, so the result is safe to assign.
    answerView.innerHTML = next.renderMarkdown(data.answer || '_No answer yet_');
    card.classList.toggle('is-flipped', !!data.flipped);
    card.classList.toggle('is-editing', !!selected);
    flip.textContent = data.flipped ? 'Hide answer' : 'Show answer';
    score.textContent = data.reviews ? `Reviewed ${data.reviews}×` : '';
  }

  sync(ctx);
  return { update: sync, destroy: () => card.remove() };
}

/** Sidebar panel: steps through the page's flashcards, least-reviewed first. */
function reviewPanel(api) {
  return (container, ctx) => {
    const root = document.createElement('div');
    root.className = 'mf-review';
    root.innerHTML = `
      <p class="mf-review__status"></p>
      <div class="mf-review__card">
        <p class="mf-review__question"></p>
        <div class="mf-review__answer markdown-content"></div>
      </div>
      <div class="mf-review__actions">
        <button type="button" data-action="reveal">Show answer</button>
        <button type="button" data-action="next">Got it → next</button>
        <button type="button" data-action="locate">Show on canvas</button>
      </div>`;
    container.appendChild(root);

    const status = root.querySelector('.mf-review__status');
    const card = root.querySelector('.mf-review__card');
    const question = root.querySelector('.mf-review__question');
    const answer = root.querySelector('.mf-review__answer');
    const actions = root.querySelector('.mf-review__actions');
    let current = ctx;
    let queue = [];
    let index = 0;
    let revealed = false;

    function render(next) {
      current = next;
      const cards = api.workspace.getNodes().filter((n) => n.type === 'flashcard' && n.data.question);
      // Keep the order stable while reviewing; re-sort only when cards are added or removed.
      if (cards.length !== queue.length || cards.some((c) => !queue.includes(c.id))) {
        queue = [...cards].sort((a, b) => (a.data.reviews ?? 0) - (b.data.reviews ?? 0)).map((c) => c.id);
        index = 0;
        revealed = false;
      }
      const node = cards.find((c) => c.id === queue[index]);
      card.hidden = actions.hidden = !node;
      if (!node) {
        status.textContent = current.page ? 'No flashcards with a question on this page.' : 'Open a page to review.';
        return;
      }
      status.textContent = `Card ${index + 1} of ${queue.length} · reviewed ${node.data.reviews ?? 0}×`;
      question.textContent = node.data.question;
      answer.hidden = !revealed;
      // renderMarkdown sanitizes, so the result is safe to assign.
      answer.innerHTML = revealed ? current.renderMarkdown(node.data.answer || '_No answer yet_') : '';
    }

    actions.addEventListener('click', (e) => {
      const action = e.target.closest('button')?.dataset.action;
      const id = queue[index];
      if (!id) return;
      if (action === 'reveal') revealed = !revealed;
      if (action === 'locate') api.workspace.select([id]);
      if (action === 'next') {
        const node = api.workspace.getNodes().find((n) => n.id === id);
        index = (index + 1) % queue.length;
        revealed = false;
        if (node) api.workspace.updateNodeData(id, { reviews: (node.data.reviews ?? 0) + 1 });
      }
      render(current);
    });

    render(ctx);
    return { update: render, destroy: () => root.remove() };
  };
}

export function activate(api) {
  api.registerNodeTypes([
    {
      type: 'flashcard',
      label: 'Flashcard',
      description: 'Question and answer card for studying',
      iconName: 'Lightbulb',
      keywords: ['quiz', 'study', 'question', 'answer', 'anki'],
      render: renderFlashcard,
      defaultData: { title: 'Flashcard', question: '', answer: '', flipped: false, reviews: 0 },
      dimensions: { minWidth: 200, minHeight: 140, defaultWidth: 280, defaultHeight: 200 },
      colors: { bg: '#1d1a2e', border: '#5a4a8a', icon: '🃏' },
      knowledge: {
        purpose: 'A study card with a question and its answer.',
        bodyField: 'answer',
        fields: {
          question: { type: 'string', description: 'Front of the card' },
          answer: { type: 'markdown', description: 'Back of the card' },
        },
      },
    },
  ]);

  // Templates appear in the command palette (Ctrl+P) as "Insert template: …".
  api.registerTemplates([
    {
      id: 'study-set',
      name: 'Study set',
      description: 'A topic note linked to three flashcards',
      content: {
        nodes: [
          { key: 'topic', type: 'note', x: 0, y: 0, data: { title: 'Topic', content: 'What are you studying?' } },
          ...[0, 1, 2].map((i) => ({
            key: `card${i}`,
            type: 'flashcard',
            x: 380,
            y: i * 230 - 230,
            data: { title: `Card ${i + 1}`, question: '', answer: '', flipped: false, reviews: 0 },
          })),
        ],
        edges: [0, 1, 2].map((i) => ({ from: 'topic', to: `card${i}`, fromSide: 'right', toSide: 'left' })),
      },
    },
  ]);

  // Layouts appear as "Arrange: …". They get the selected (or all) nodes and return new positions.
  api.registerLayouts([
    {
      id: 'deck',
      name: 'Flashcard deck (rows of 4)',
      arrange: ({ nodes }) => {
        const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
        const left = Math.min(...nodes.map((n) => n.x));
        const top = Math.min(...nodes.map((n) => n.y));
        return Object.fromEntries(
          sorted.map((n, i) => [n.id, { x: left + (i % 4) * 310, y: top + Math.floor(i / 4) * 230 }]),
        );
      },
    },
  ]);

  // Panels get a ribbon button and a "Toggle panel: …" entry in the command palette.
  api.registerPanels([
    {
      id: 'review',
      label: 'Flashcard review',
      description: 'Study the flashcards on this page',
      iconName: 'Lightbulb',
      render: reviewPanel(api),
    },
  ]);

  api.registerCommands([
    {
      id: 'reset-reviews',
      label: 'Flashcards: reset review counts on this page',
      category: 'Flashcards',
      handler: () => {
        const cards = api.workspace.getNodes().filter((n) => n.type === 'flashcard');
        for (const card of cards) api.workspace.updateNodeData(card.id, { reviews: 0, flipped: false });
        api.ui.notify(`Reset ${cards.length} flashcard${cards.length === 1 ? '' : 's'}`, 'success');
      },
    },
  ]);
}

export function deactivate() {}
