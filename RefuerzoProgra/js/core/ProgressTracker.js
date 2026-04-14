/**
 * ProgressTracker — Single Responsibility: persists all progress data to localStorage.
 * Knows nothing about UI or game logic — only reads and writes progress state.
 */
export class ProgressTracker {
  #STORAGE_KEY = 'poo_unity_v1';
  #data;

  constructor() {
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

  /** Returns the number of distinct questions answered (at least one attempt). */
  getUniqueAnswered(sectionId) {
    return Object.keys(this.getSectionProgress(sectionId).answeredQuestions).length;
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
