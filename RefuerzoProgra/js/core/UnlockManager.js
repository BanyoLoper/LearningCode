/**
 * UnlockManager — Evaluates and applies unlock logic for sections and group exams.
 * Works with the group-based course structure from course.json v2.
 */
export class UnlockManager {
  #tracker;
  #courseData = null;
  #flatSections = []; // all sections + exam sections, flattened

  constructor(progressTracker) {
    this.#tracker = progressTracker;
  }

  /** Must be called after course data is loaded. */
  setCourseData(courseData) {
    this.#courseData = courseData;

    // Flatten all sections + exams from all groups
    this.#flatSections = [];
    for (const group of courseData.groups) {
      for (const section of group.sections) {
        this.#flatSections.push({ ...section, _groupId: group.id });
      }
      if (group.exam) {
        this.#flatSections.push({ ...group.exam, _groupId: group.id });
      }
    }

    // First section of first group is always unlocked
    const first = this.#flatSections[0];
    if (first && !this.#tracker.isUnlocked(first.id)) {
      this.#tracker.unlockSection(first.id);
    }
  }

  /** Returns true if a section (or exam) is accessible. */
  isUnlocked(sectionId) {
    if (!this.#courseData) return false;
    const section = this.#flatSections.find(s => s.id === sectionId);
    if (!section) return false;
    if (section.unlockRequirement === null) return true;
    return this.#tracker.isUnlocked(sectionId);
  }

  /**
   * Checks whether the current session triggers an unlock (regular sections only).
   * Called per correct answer from CourseEngine.
   * @param {string} sectionId
   * @param {number} sessionCorrect - correct answers in the current (unsaved) session
   * @returns {object|null} Newly unlocked section/exam config, or null
   */
  checkUnlock(sectionId, sessionCorrect) {
    const section = this.#flatSections.find(s => s.id === sectionId);
    if (!section) return null;
    // Exams are handled separately via checkExamUnlock — skip here
    if (section.isExam) return null;
    if (!section.correctAnswersToUnlockNext) return null;

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

  /**
   * Called when an exam pool is exhausted (section complete).
   * Unlocks the first section of the next group.
   * @param {string} examId
   * @returns {object|null} Newly unlocked section config, or null
   */
  checkExamUnlock(examId) {
    const section = this.#flatSections.find(s => s.id === examId);
    if (!section?.isExam) return null;
    const next = this.#getNextSection(examId);
    if (next && !this.#tracker.isUnlocked(next.id)) {
      this.#tracker.unlockSection(next.id);
      return next;
    }
    return null;
  }

  /** All sections + exams (flat). */
  getAllSections() {
    return this.#flatSections;
  }

  /** Only currently unlocked sections + exams. */
  getUnlockedSections() {
    return this.#flatSections.filter(s => this.isUnlocked(s.id));
  }

  /** Full group structure (for sidebar rendering). */
  getGroups() {
    return this.#courseData?.groups ?? [];
  }

  // Returns the section/exam that comes after currentId in the course flow
  #getNextSection(currentId) {
    const groups = this.#courseData.groups;
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];

      // Check if currentId is this group's exam → return first section of next group
      if (group.exam?.id === currentId) {
        const nextGroup = groups[gi + 1];
        if (nextGroup?.sections?.length > 0) {
          return { ...nextGroup.sections[0], _groupId: nextGroup.id };
        }
        return null;
      }

      // Check within group sections
      const sections = group.sections;
      const idx = sections.findIndex(s => s.id === currentId);
      if (idx >= 0) {
        // Next within group sections
        if (idx < sections.length - 1) return { ...sections[idx + 1], _groupId: group.id };
        // Last section → unlock the group's exam
        return group.exam ? { ...group.exam, _groupId: group.id } : null;
      }
    }
    return null;
  }
}
