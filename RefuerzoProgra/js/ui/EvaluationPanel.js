import { MultipleChoiceHandler } from '../questions/MultipleChoiceHandler.js';
import { IdentificationHandler } from '../questions/IdentificationHandler.js';
import { CodeWritingHandler } from '../questions/CodeWritingHandler.js';

/**
 * EvaluationPanel — Manages the evaluation section of the UI.
 * Renders the current active question and the history of answered questions.
 * Depends on question handlers for rendering (Open/Closed: add new types without modifying this).
 */
export class EvaluationPanel {
  #currentContainer;
  #historyContainer;
  #handlers;
  #activeQuestion = null;
  #activeHandler = null;
  #sessionHistory = []; // { question, correct, attempts }

  constructor(currentContainer, historyContainer) {
    this.#currentContainer = currentContainer;
    this.#historyContainer = historyContainer;
    this.#handlers = {
      multiple_choice: new MultipleChoiceHandler(),
      identification: new IdentificationHandler(),
      code_writing: new CodeWritingHandler()
    };
  }

  /**
   * Renders a new question as the active question.
   * @param {object} question
   * @param {function} onSubmit - called with (answer) when user submits
   */
  renderQuestion(question, onSubmit) {
    this.#activeQuestion = question;
    this.#activeHandler = this.#handlers[question.type];

    this.#currentContainer.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'question-card active-question';
    card.dataset.questionId = question.id;
    card.dataset.difficulty = question.difficulty;

    // Difficulty stars
    const stars = document.createElement('div');
    stars.className = 'question-difficulty';
    stars.innerHTML = Array(question.difficulty).fill('★').join('') +
      Array(3 - question.difficulty).fill('☆').join('');
    card.appendChild(stars);

    const body = document.createElement('div');
    body.className = 'question-body';
    card.appendChild(body);
    this.#currentContainer.appendChild(card);

    this.#activeHandler.render(question, body, onSubmit);
  }

  /**
   * Marks the active question as correct, moves it to history (collapsed).
   */
  markCorrect() {
    if (!this.#activeQuestion) return;
    this.#sessionHistory.push({ question: this.#activeQuestion, correct: true });
    this.#renderHistoryItem(this.#activeQuestion, true);
    this.#currentContainer.innerHTML = '';
    this.#activeQuestion = null;
    this.#activeHandler = null;
  }

  /**
   * Shows feedback for a wrong answer: calls the handler's hint/result method.
   * @param {number} hintIndex - 0-based. If >= question.hints.length, shows full explanation.
   */
  showWrongFeedback(hintIndex) {
    const q = this.#activeQuestion;
    const handler = this.#activeHandler;
    const body = this.#currentContainer.querySelector('.question-body');
    if (!q || !body) return;

    const maxHints = q.hints?.length ?? 0;

    if (hintIndex < maxHints) {
      handler.showHint?.(body, q, hintIndex);
    }
    // If no more hints, the engine will call showExplanation
  }

  /**
   * Shows final explanation for active question and moves it to history (expanded/failed).
   * @param {*} lastAnswer - The last answer the user submitted
   */
  showExplanation(lastAnswer) {
    if (!this.#activeQuestion) return;
    const q = this.#activeQuestion;
    const handler = this.#activeHandler;
    const body = this.#currentContainer.querySelector('.question-body');
    if (body) handler.showResult?.(body, q, lastAnswer, false);

    this.#sessionHistory.push({ question: q, correct: false });
    // After a delay, move to history (1600ms so CourseEngine's 2000ms timeout arrives after)
    setTimeout(() => {
      this.#renderHistoryItem(q, false, lastAnswer);
      this.#currentContainer.innerHTML = '';
      this.#activeQuestion = null;
      this.#activeHandler = null;
    }, 1600);
  }

  /**
   * Shows correct result (for MC) on the active question before collapsing.
   * @param {*} answer - The answer the user gave
   */
  showCorrectResult(answer) {
    if (!this.#activeQuestion) return;
    const q = this.#activeQuestion;
    const handler = this.#activeHandler;
    const body = this.#currentContainer.querySelector('.question-body');
    if (body) handler.showResult?.(body, q, answer, true);
  }

  /** Clears everything — call when switching sections. */
  clear() {
    this.#currentContainer.innerHTML = '';
    this.#historyContainer.innerHTML = '';
    this.#sessionHistory = [];
    this.#activeQuestion = null;
    this.#activeHandler = null;
  }

  /** Shows a loading/waiting message in the current question area. */
  showMessage(html) {
    this.#currentContainer.innerHTML = `<div class="panel-message">${html}</div>`;
  }

  #renderHistoryItem(question, correct, lastAnswer = null) {
    const item = document.createElement('div');
    item.className = `history-item ${correct ? 'history-correct' : 'history-wrong'}`;
    item.dataset.questionId = question.id;

    if (correct) {
      // Correct: collapsed by default, but expandable to see explanation
      item.innerHTML = `
        <div class="history-header">
          <span class="history-icon">✓</span>
          <span class="history-preview">${this.#truncate(question.question ?? question.instruction, 80)}</span>
          <span class="history-type-tag">${this.#typeName(question.type)}</span>
          <button class="history-toggle" aria-expanded="false" title="Ver explicación">▼</button>
        </div>
        <div class="history-body" style="display:none">
          <p class="history-full-question">${question.question ?? question.instruction}</p>
          ${question.code ? `<pre class="code-block small"><code>${this.#escapeHtml(question.code)}</code></pre>` : ''}
          <div class="history-explanation">
            <strong>Explicación:</strong>
            <p>${question.explanation}</p>
          </div>
        </div>
      `;
      const toggle = item.querySelector('.history-toggle');
      const body = item.querySelector('.history-body');
      toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !expanded);
        toggle.textContent = expanded ? '▼' : '▲';
        body.style.display = expanded ? 'none' : '';
      });
    } else {
      // Expanded: show question + explanation
      item.innerHTML = `
        <div class="history-header">
          <span class="history-icon">✗</span>
          <span class="history-preview">${this.#truncate(question.question ?? question.instruction, 80)}</span>
          <span class="history-type-tag">${this.#typeName(question.type)}</span>
          <button class="history-toggle" aria-expanded="true">▲</button>
        </div>
        <div class="history-body">
          <p class="history-full-question">${question.question ?? question.instruction}</p>
          ${question.code ? `<pre class="code-block small"><code>${this.#escapeHtml(question.code)}</code></pre>` : ''}
          <div class="history-explanation">
            <strong>Respuesta correcta:</strong>
            <p>${question.explanation}</p>
          </div>
        </div>
      `;
      const toggle = item.querySelector('.history-toggle');
      const body = item.querySelector('.history-body');
      toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !expanded);
        toggle.textContent = expanded ? '▼' : '▲';
        body.style.display = expanded ? 'none' : '';
      });
    }

    this.#historyContainer.insertBefore(item, this.#historyContainer.firstChild);
  }

  #truncate(text, max) {
    if (!text) return '';
    const clean = text.replace(/<[^>]+>/g, '');
    return clean.length > max ? clean.slice(0, max) + '…' : clean;
  }

  #typeName(type) {
    return { multiple_choice: 'Opción Múltiple', identification: 'Identificación', code_writing: 'Código' }[type] ?? type;
  }

  #escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
