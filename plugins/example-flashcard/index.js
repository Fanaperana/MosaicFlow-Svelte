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
}

export function deactivate() {}
