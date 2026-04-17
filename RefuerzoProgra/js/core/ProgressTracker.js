/**
 * ProgressTracker — Single Responsibility: persists all progress data to localStorage.
 * Knows nothing about UI or game logic — only reads and writes progress state.
 *
 * Optional: pass an `onSave` callback to be notified after every write.
 * Used by app.js to debounce remote sync to the D1 database.
 */
export class ProgressTracker {
  #STORAGE_KEY = 'poo_unity_v1';
  #data;
  #onSave;

  constructor({ onSave } = {}) {
    this.#onSave = onSave ?? null;
    this.#data = this.#load();
  }

  #load() {
    try {
      return JSON.parse(localStorage.getItem(this.#STORAGE_KEY)) ?? {};
    } catch {
      return {};
    }
  }

  #save() {
    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(this.#data));
    this.#onSave?.();
  }

  /** Returns the full progress state (for remote sync). */
  getState() {
    return this.#data;
  }

  /**
   * Replaces the in-memory state with externally loaded data (e.g. from D1).
   * Also updates localStorage so offline fallback stays current.
   */
  loadState(data) {
    if (data && typeof data === 'object') {
      this.#data = data;
      localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(this.#data));
    }
  }

  /** Returns progress state for a section, initializing if not present. */
  getSectionProgress(sectionId) {
    if (!this.#data[sectionId]) {
      this.#data[sectionId] = {
        unlockedAt: null,
        sessions: [],
        totalCorrect: 0,
        totalAttempted: 0,
        answeredQuestions: {}
      };
    }
    return this.#data[sectionId];
  }

  /** Records a completed session for a section. */
  recordSession(sectionId, { correct, total, legendary = false }) {
    const p = this.getSectionProgress(sectionId);
    p.sessions.push({
      date: new Date().toISOString(),
      correct,
      total,
      score: total > 0 ? Math.round((correct / total) * 100) : 0,
      legendary
    });
    p.totalCorrect += correct;
    p.totalAttempted += total;
    this.#save();
  }

  /** Returns the number of distinct questions answered CORRECTLY at least once. */
  getUniqueAnswered(sectionId) {
    return Object.values(this.getSectionProgress(sectionId).answeredQuestions)
      .filter(q => q.correct > 0).length;
  }

  /** Returns the IDs of questions answered correctly at least once. */
  getCorrectlyAnsweredIds(sectionId) {
    return Object.entries(this.getSectionProgress(sectionId).answeredQuestions)
      .filter(([, v]) => v.correct > 0)
      .map(([id]) => id);
  }

  /** Records a single answer result for a question. */
  recordAnswer(sectionId, questionId, correct) {
    const p = this.getSectionProgress(sectionId);
    if (!p.answeredQuestions[questionId]) {
      p.answeredQuestions[questionId] = { correct: 0, attempts: 0 };
    }
    p.answeredQuestions[questionId].attempts++;
    if (correct) p.answeredQuestions[questionId].correct++;
    this.#save();
  }

  /** Marks a section as unlocked. */
  unlockSection(sectionId) {
    const p = this.getSectionProgress(sectionId);
    if (!p.unlockedAt) {
      p.unlockedAt = new Date().toISOString();
      this.#save();
    }
  }

  /** Returns true if the section has been unlocked. */
  isUnlocked(sectionId) {
    return !!this.getSectionProgress(sectionId).unlockedAt;
  }

  /** Returns total correct answers across all sessions for a section. */
  getTotalCorrect(sectionId) {
    return this.getSectionProgress(sectionId).totalCorrect;
  }

  /** Returns all sessions for a section (for history display). */
  getSessions(sectionId) {
    return this.getSectionProgress(sectionId).sessions;
  }

  /** Resets all progress (for debug purposes). */
  reset() {
    this.#data = {};
    this.#save();
  }
}
