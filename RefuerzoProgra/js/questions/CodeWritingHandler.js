import { formatText } from '../core/TextFormatter.js';

/**
 * CodeWritingHandler — Renders "write code" and "complete the blank" questions.
 * Two subtypes:
 *   - 'write': user writes a full line from scratch
 *   - 'complete': user fills in the blank in a code template
 */
export class CodeWritingHandler {
  render(question, container, onSubmit) {
    const isComplete = question.subtype === 'complete';

    container.innerHTML = `
      <div class="question-badge cw-badge">${isComplete ? 'Completar Código' : 'Escribir Código'}</div>
      <p class="question-text">${formatText(question.instruction)}</p>
      ${isComplete ? this.#renderTemplate(question.codeTemplate) : ''}
      <div class="input-row code-input-row">
        <input
          type="text"
          class="answer-input code-input"
          placeholder="${question.placeholder}"
          autocomplete="off"
          spellcheck="false"
        >
        <button class="btn-submit">Verificar</button>
      </div>
      <div class="hints-container"></div>
      <div class="attempts-counter" data-attempts="0"></div>
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

  showHint(container, question, hintIndex) {
    const hintsEl = container.querySelector('.hints-container');
    const counter = container.querySelector('.attempts-counter');
    counter.textContent = `Intento ${hintIndex + 1}`;

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
        ? `¡Correcto! <code>${this.#escapeHtml(question.expectedAnswer)}</code>`
        : `La respuesta era: <code>${this.#escapeHtml(question.expectedAnswer)}</code>`
      }</span>
      <div class="explanation-text">${question.explanation}</div>
    `;
    container.appendChild(feedback);
  }

  validate(answer, question) {
    const normalize = str => str.trim().toLowerCase().replace(/\s+/g, ' ');
    const a = normalize(answer);
    const expected = normalize(question.expectedAnswer);
    if (a === expected) return { correct: true };
    const alts = (question.alternateAnswers ?? []).map(normalize);
    return { correct: alts.includes(a) };
  }

  #renderTemplate(template) {
    const escaped = this.#escapeHtml(template);
    const withBlank = escaped.replace(/________+/g,
      '<span class="code-blank">___________</span>');
    return `<pre class="code-block code-template"><code>${withBlank}</code></pre>`;
  }

  #escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
