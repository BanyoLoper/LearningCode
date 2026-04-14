/**
 * CourseEngine — The central state machine and orchestrator.
 * Coordinates data loading, progress tracking, unlock checks, and UI updates.
 * All business logic lives here; UI managers only receive display commands.
 */
export class CourseEngine {
  // Dependencies (injected via constructor — Dependency Inversion Principle)
  #loader;
  #tracker;
  #unlockManager;
  #evalPanel;
  #docPanel;
  #sidebar;

  // Runtime state
  #courseData = null;
  #loadedSections = new Map();   // sectionId → section JSON data
  #activeSectionId = null;
  #sessionCorrect = 0;
  #sessionTotal = 0;
  #questionPool = [];            // All questions for active section
  #usedIds = new Set();          // Question IDs used this session
  #currentQuestion = null;
  #wrongAttempts = 0;            // Wrong attempts for current question

  constructor({ dataLoader, progressTracker, unlockManager, evaluationPanel, documentationPanel, sidebarManager }) {
    this.#loader = dataLoader;
    this.#tracker = progressTracker;
    this.#unlockManager = unlockManager;
    this.#evalPanel = evaluationPanel;
    this.#docPanel = documentationPanel;
    this.#sidebar = sidebarManager;
  }

  /** Bootstrap the course. Call once on app start. */
  async init() {
    this.#courseData = await this.#loader.loadCourse();
    this.#unlockManager.setCourseData(this.#courseData);

    // Load documentation for already-unlocked sections
    const unlocked = this.#unlockManager.getUnlockedSections();
    for (const sec of unlocked) {
      await this.#ensureSectionLoaded(sec);
      this.#docPanel.addSection(sec, this.#loadedSections.get(sec.id));
    }

    // Start with the first unlocked section
    const firstSection = unlocked[0];
    if (firstSection) {
      await this.#startSection(firstSection.id);
    } else {
      this.#evalPanel.showMessage('<p>No hay secciones disponibles.</p>');
    }

    this.#renderSidebar();
  }

  /** Called when the user clicks a section in the sidebar. */
  async selectSection(sectionId) {
    if (!this.#unlockManager.isUnlocked(sectionId)) return;

    // Save current session before switching
    this.#endSession();

    await this.#startSection(sectionId);
    this.#sidebar.setActive(sectionId);
  }

  /**
   * Called by the EvaluationPanel when the user submits an answer.
   * @param {*} answer
   */
  handleAnswer(answer) {
    if (!this.#currentQuestion) return;
    const q = this.#currentQuestion;
    const handler = this.#getHandler(q.type);
    const { correct } = handler.validate(answer, q);

    if (correct) {
      this.#onCorrect(answer);
    } else {
      this.#onWrong(answer);
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  async #startSection(sectionId) {
    const sec = this.#courseData.sections.find(s => s.id === sectionId);
    if (!sec) return;

    await this.#ensureSectionLoaded(sec);

    this.#activeSectionId = sectionId;
    this.#sessionCorrect = 0;
    this.#sessionTotal = 0;
    this.#usedIds = new Set();
    this.#wrongAttempts = 0;

    this.#evalPanel.clear();
    this.#evalPanel.showMessage(`
      <div class="section-start-card">
        <span class="section-start-icon">${sec.icon}</span>
        <h2>${sec.title}</h2>
        <p>${sec.description}</p>
      </div>
    `);

    // Small delay for UX then load first question
    setTimeout(() => this.#nextQuestion(), 800);
  }

  #nextQuestion() {
    const q = this.#pickQuestion();
    if (!q) {
      this.#evalPanel.showMessage(`
        <div class="section-complete">
          <div class="complete-icon">🎉</div>
          <h2>¡Sección completada!</h2>
          <p>Has respondido todas las preguntas disponibles en esta sección.</p>
          <p>Puedes seguir repasando otras secciones desde el menú lateral.</p>
        </div>
      `);
      this.#endSession();
      return;
    }
    this.#currentQuestion = q;
    this.#wrongAttempts = 0;
    this.#usedIds.add(q.id);
    this.#evalPanel.renderQuestion(q, answer => this.handleAnswer(answer));
  }

  #onCorrect(answer) {
    this.#evalPanel.showCorrectResult(answer);
    this.#sessionCorrect++;
    this.#sessionTotal++;
    this.#tracker.recordAnswer(this.#activeSectionId, this.#currentQuestion.id, true);

    // Check unlocks
    const unlocked = this.#unlockManager.checkUnlock(this.#activeSectionId, this.#sessionCorrect);

    setTimeout(async () => {
      this.#evalPanel.markCorrect();

      if (unlocked) {
        await this.#handleUnlock(unlocked);
      }

      // Small pause then load next question
      setTimeout(() => this.#nextQuestion(), 400);
    }, 1200);
  }

  #onWrong(answer) {
    this.#tracker.recordAnswer(this.#activeSectionId, this.#currentQuestion.id, false);
    const q = this.#currentQuestion;
    const maxHints = q.hints?.length ?? 0;

    if (this.#wrongAttempts < maxHints) {
      this.#evalPanel.showWrongFeedback(this.#wrongAttempts);
      this.#wrongAttempts++;
    } else {
      // No more hints — reveal explanation and move on
      this.#sessionTotal++;
      this.#evalPanel.showExplanation(answer);
      setTimeout(() => this.#nextQuestion(), 2000);
    }
  }

  async #handleUnlock(newSection) {
    // Load data for new section
    await this.#ensureSectionLoaded(newSection);

    // Add docs
    this.#docPanel.addSection(newSection, this.#loadedSections.get(newSection.id));

    // Re-render sidebar
    this.#renderSidebar();

    // SweetAlert celebration
    await Swal.fire({
      title: `🔓 ¡Sección Desbloqueada!`,
      html: `
        <div class="unlock-content">
          <span class="unlock-icon">${newSection.icon}</span>
          <h3>${newSection.title}</h3>
          <p>${newSection.description}</p>
          <p>La documentación de esta sección ya está disponible en el panel derecho.</p>
        </div>
      `,
      background: '#16213e',
      color: '#e0e0e0',
      confirmButtonText: '¡Vamos!',
      confirmButtonColor: newSection.color,
      showClass: { popup: 'swal2-show animate-unlock' },
      timer: 8000,
      timerProgressBar: true
    });
  }

  #endSession() {
    if (this.#activeSectionId && this.#sessionTotal > 0) {
      this.#tracker.recordSession(this.#activeSectionId, {
        correct: this.#sessionCorrect,
        total: this.#sessionTotal
      });
      this.#renderSidebar();
    }
  }

  async #ensureSectionLoaded(sectionConfig) {
    if (this.#loadedSections.has(sectionConfig.id)) return;
    const data = await this.#loader.loadSection(sectionConfig.dataFile);
    this.#loadedSections.set(sectionConfig.id, data);
  }

  #pickQuestion() {
    const sectionData = this.#loadedSections.get(this.#activeSectionId);
    if (!sectionData) return null;

    const available = sectionData.questions.filter(q => !this.#usedIds.has(q.id));
    if (available.length === 0) return null;

    // Prefer lower difficulty for early questions in the session
    const easyFirst = this.#sessionCorrect < 3;
    if (easyFirst) {
      available.sort((a, b) => a.difficulty - b.difficulty);
    } else {
      // Shuffle with slight preference for harder questions
      available.sort(() => Math.random() - 0.4);
    }
    return available[0];
  }

  #getHandler(type) {
    // Handlers are owned by EvaluationPanel but validate() is stateless,
    // so we instantiate temporary ones here for validation only.
    const { MultipleChoiceHandler } = window.__handlers__ ?? {};
    switch (type) {
      case 'multiple_choice':
        return { validate: (a, q) => ({ correct: a === q.correctIndex }) };
      case 'identification':
        return {
          validate: (a, q) => ({
            correct: q.acceptedAnswers.some(acc => acc.toLowerCase() === a.trim().toLowerCase())
          })
        };
      case 'code_writing':
        return {
          validate: (a, q) => {
            const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
            const ans = norm(a);
            if (ans === norm(q.expectedAnswer)) return { correct: true };
            const alts = (q.alternateAnswers ?? []).map(norm);
            return { correct: alts.includes(ans) };
          }
        };
      default:
        return { validate: () => ({ correct: false }) };
    }
  }

  #renderSidebar() {
    const all = this.#unlockManager.getAllSections();
    const unlocked = this.#unlockManager.getUnlockedSections().map(s => s.id);
    this.#sidebar.render(all, unlocked, this.#activeSectionId, id => {
      const p = this.#tracker.getSectionProgress(id);
      return {
        sessions: p.sessions,
        totalCorrect: p.totalCorrect,
        totalAttempted: p.totalAttempted
      };
    });
  }
}
