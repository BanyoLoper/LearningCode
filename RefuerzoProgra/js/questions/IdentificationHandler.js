/**
 * IdentificationHandler — Renders and validates identification questions.
 * Shows a code snippet and asks the user to identify a highlighted term.
 * Implements a 3-hint system before revealing the answer.
 */
export class IdentificationHandler {
  render(question, container, onSubmit) {
    const highlightedCode = this.#highlightTarget(question.code, question.target);

    container.innerHTML = `
      <div class="question-badge id-badge">Identificación</div>
      <p class="question-preamble">${question.preamble}</p>
      <pre class="code-block"><code>${highlightedCode}</code></pre>
      <p class="question-text">${question.question}</p>
      <div class="input-row">
        <input
          type="text"
          class="answer-input"
          placeholder="Escribe tu respuesta aquí..."
          autocomplete="off"
          spellcheck="false"
        >
        <button class="btn-submit">Verificar</button>
      </div>
      <div class="hints-container"></div>
      <div class="attempts-counter" data-attempts="0" data-max="${question.hints.length}"></div>
    `;

    const input = container.querySelector('.answer-input');
    const btn = container.querySelector('.btn-submit');

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn.click();
    });

    btn.addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) return;
      btn.disabled = true;
      onSubmit(value);
      btn.disabled = false;
    });
  }

  /** Shows a hint (hintIndex = 0, 1, 2). */
  showHint(container, question, hintIndex) {
    const hintsEl = container.querySelector('.hints-container');
    const counter = container.querySelector('.attempts-counter');
    const attempts = hintIndex + 1;

    counter.dataset.attempts = attempts;
    counter.textContent = `Intento ${attempts} de ${question.hints.length + 1}`;

    const hint = document.createElement('div');
    hint.className = 'hint-item';
    hint.innerHTML = `<span class="hint-number">💡 Pista ${hintIndex + 1}:</span> ${question.hints[hintIndex]}`;
    hintsEl.appendChild(hint);

    const input = container.querySelector('.answer-input');
    input.value = '';
    input.focus();
    input.classList.add('input-shake');
    setTimeout(() => input.classList.remove('input-shake'), 400);
  }

  showResult(container, question, userAnswer, correct) {
    const inputRow = container.querySelector('.input-row');
    if (inputRow) inputRow.remove();

    const feedback = document.createElement('div');
    feedback.className = `question-feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}`;
    feedback.innerHTML = `
      <span class="feedback-icon">${correct ? '✓' : '✗'}</span>
      <span>${correct
        ? `¡Correcto! La respuesta es: <strong>${question.acceptedAnswers[0]}</strong>`
        : `La respuesta era: <strong>${question.acceptedAnswers[0]}</strong>`
      }</span>
      <div class="explanation-text">${question.explanation}</div>
    `;
    container.appendChild(feedback);
  }

  validate(answer, question) {
    const normalized = answer.trim().toLowerCase();
    const correct = question.acceptedAnswers.some(a => a.toLowerCase() === normalized);
    return { correct };
  }

  #highlightTarget(code, target) {
    if (!target) return this.#escapeHtml(code);
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.#escapeHtml(code).replace(
      new RegExp(`\\b${escaped}\\b`, 'g'),
      `<mark class="code-highlight">${target}</mark>`
    );
  }

  #escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
