import { formatText } from '../core/TextFormatter.js';

/**
 * MultipleChoiceHandler — Renders and validates multiple-choice questions.
 * Single Responsibility: only knows how to handle this question type.
 */
export class MultipleChoiceHandler {
  /**
   * Renders the question into the container.
   * @param {object} question
   * @param {HTMLElement} container
   * @param {function} onSubmit - called with (answer: number) when user confirms
   */
  render(question, container, onSubmit) {
    container.innerHTML = `
      <div class="question-badge mc-badge">Opción Múltiple</div>
      <p class="question-text">${formatText(question.question)}</p>
      <div class="options-list" role="radiogroup">
        ${question.options.map((opt, i) => `
          <label class="option-item" data-index="${i}">
            <input type="radio" name="q_${question.id}" value="${i}" class="option-radio">
            <span class="option-letter">${String.fromCharCode(65 + i)}</span>
            <span class="option-text">${opt}</span>
          </label>
        `).join('')}
      </div>
      <button class="btn-submit" disabled>Confirmar respuesta</button>
    `;

    const radios = container.querySelectorAll('.option-radio');
    const btn = container.querySelector('.btn-submit');
    const labels = container.querySelectorAll('.option-item');

    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        labels.forEach(l => l.classList.remove('selected'));
        radio.closest('.option-item').classList.add('selected');
        btn.disabled = false;
      });
    });

    btn.addEventListener('click', () => {
      const checked = container.querySelector('.option-radio:checked');
      if (!checked) return;
      btn.disabled = true;
      onSubmit(parseInt(checked.value));
    });
  }

  /**
   * Shows the result on the rendered question.
   * @param {HTMLElement} container
   * @param {object} question
   * @param {number} selectedIndex
   * @param {boolean} correct
   */
  showResult(container, question, selectedIndex, correct) {
    const labels = container.querySelectorAll('.option-item');
    const btn = container.querySelector('.btn-submit');
    if (btn) btn.remove();

    labels.forEach((label, i) => {
      const radio = label.querySelector('input');
      if (radio) radio.disabled = true;
      if (i === question.correctIndex) {
        label.classList.add('option-correct');
      } else if (i === selectedIndex && !correct) {
        label.classList.add('option-wrong');
      }
    });

    const feedback = document.createElement('div');
    feedback.className = `question-feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}`;
    feedback.innerHTML = `
      <span class="feedback-icon">${correct ? '✓' : '✗'}</span>
      <span>${correct ? '¡Correcto!' : 'Incorrecto'}</span>
      <div class="explanation-text">${question.explanation}</div>
    `;
    container.appendChild(feedback);
  }

  /** Validates an answer synchronously. Returns { correct: boolean }. */
  validate(answer, question) {
    return { correct: answer === question.correctIndex };
  }
}
