/**
 * UnlockManager — Single Responsibility: evaluates and applies section unlock logic.
 * Depends on ProgressTracker (via constructor injection — Dependency Inversion).
 */
export class UnlockManager {
  #tracker;
  #courseData = null;

  constructor(progressTracker) {
    this.#tracker = progressTracker;
  }

  /** Must be called after course data is loaded. */
  setCourseData(courseData) {
    this.#courseData = courseData;
    // First section is always unlocked
    const first = courseData.sections[0];
    if (!this.#tracker.isUnlocked(first.id)) {
      this.#tracker.unlockSection(first.id);
    }
  }

  /** Returns true if a section is accessible. */
  isUnlocked(sectionId) {
    if (!this.#courseData) return false;
    const section = this.#findSection(sectionId);
    if (!section) return false;
    if (section.unlockRequirement === null) return true;
    return this.#tracker.isUnlocked(sectionId);
  }

  /**
   * Checks whether the current session's correct count triggers an unlock.
   * @param {string} sectionId - The section being played
   * @param {number} sessionCorrect - Correct answers in current session
   * @returns {object|null} The newly unlocked section config, or null
   */
  checkUnlock(sectionId, sessionCorrect) {
    const section = this.#findSection(sectionId);
    if (!section || section.correctAnswersToUnlockNext === null) return null;

    const totalCorrect = this.#tracker.getTotalCorrect(sectionId) + sessionCorrect;

    if (totalCorrect >= section.correctAnswersToUnlockNext) {
      const next = this.#getNextSection(sectionId);
      if (next && !this.#tracker.isUnlocked(next.id)) {
        this.#tracker.unlockSection(next.id);
        return next;
      }
    }
    return null;
  }

  /** Returns all currently unlocked section configs. */
  getUnlockedSections() {
    return this.#courseData?.sections.filter(s => this.isUnlocked(s.id)) ?? [];
  }

  /** Returns all section configs regardless of unlock status. */
  getAllSections() {
    return this.#courseData?.sections ?? [];
  }

  #findSection(id) {
    return this.#courseData?.sections.find(s => s.id === id) ?? null;
  }

  #getNextSection(currentId) {
    const sections = this.#courseData.sections;
    const idx = sections.findIndex(s => s.id === currentId);
    return idx >= 0 && idx < sections.length - 1 ? sections[idx + 1] : null;
  }
}
