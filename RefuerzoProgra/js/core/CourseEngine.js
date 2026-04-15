/**
 * CourseEngine — Central state machine and orchestrator.
 * Bug fixes v2: double-session recording fixed by resetting counters after endSession.
 * New: Master Quest mode, group exam support, group-aware rendering.
 */
export class CourseEngine {
  #loader;
  #tracker;
  #unlockManager;
  #evalPanel;
  #docPanel;
  #sidebar;

  #courseData = null;
  #loadedSections = new Map();
  #activeSectionId = null;
  #sessionCorrect = 0;
  #sessionTotal = 0;
  #questionPool = [];
  #usedIds = new Set();
  #currentQuestion = null;
  #wrongAttempts = 0;
  #isMasterQuest = false;

  constructor({ dataLoader, progressTracker, unlockManager, evaluationPanel, documentationPanel, sidebarManager }) {
    this.#loader = dataLoader;
    this.#tracker = progressTracker;
    this.#unlockManager = unlockManager;
    this.#evalPanel = evaluationPanel;
    this.#docPanel = documentationPanel;
    this.#sidebar = sidebarManager;
  }

  async init() {
    this.#courseData = await this.#loader.loadCourse();
    this.#unlockManager.setCourseData(this.#courseData);

    // Preload docs for already-unlocked sections
    const unlocked = this.#unlockManager.getUnlockedSections();
    for (const sec of unlocked) {
      if (!sec.isExam) {
        await this.#ensureSectionLoaded(sec);
        const data = this.#loadedSections.get(sec.id);
        if (data?.documentation) this.#docPanel.addSection(sec, data);
      }
    }

    const firstSection = unlocked.find(s => !s.isExam);
    if (firstSection) {
      await this.#startSection(firstSection.id);
    } else {
      this.#evalPanel.showMessage('<p>No hay secciones disponibles.</p>');
    }

    this.#renderSidebar();
  }

  async selectSection(sectionId) {
    if (!this.#unlockManager.isUnlocked(sectionId)) return;
    this.#endSession();
    await this.#startSection(sectionId);
    this.#sidebar.setActive(sectionId);
    this.#docPanel.focusSection(sectionId);
  }

  /** Starts a Master Quest session — all questions in the pool in one run. */
  async startMasterQuest(sectionId) {
    if (!this.#unlockManager.isUnlocked(sectionId)) return;
    this.#endSession();
    this.#isMasterQuest = true;
    await this.#startSection(sectionId, { masterQuest: true });
    this.#sidebar.setActive(sectionId);
  }

  handleAnswer(answer) {
    if (!this.#currentQuestion) return;
    const { correct } = this.#validateAnswer(answer, this.#currentQuestion);
    correct ? this.#onCorrect(answer) : this.#onWrong(answer);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  async #startSection(sectionId, { masterQuest = false } = {}) {
    const sec = this.#getAllSectionConfigs().find(s => s.id === sectionId);
    if (!sec) return;

    await this.#ensureSectionLoaded(sec);

    this.#activeSectionId = sectionId;
    this.#sessionCorrect = 0;
    this.#sessionTotal = 0;
    this.#usedIds = new Set();
    this.#wrongAttempts = 0;
    this.#isMasterQuest = masterQuest;

    this.#evalPanel.clear();

    const secData = this.#loadedSections.get(sectionId);
    const totalQ = secData?.questions?.length ?? 0;

    this.#evalPanel.showMessage(`
      <div class="section-start-card" style="--section-color:${sec.color ?? '#58a6ff'}">
        <span class="section-start-icon">${sec.icon}</span>
        <h2>${sec.title}</h2>
        <p>${sec.description}</p>
        ${masterQuest ? `<div class="master-quest-banner">⚔️ Master Quest — ${totalQ} preguntas</div>` : ''}
      </div>
    `);

    setTimeout(() => this.#nextQuestion(), 800);
  }

  async #nextQuestion() {
    const q = this.#pickQuestion();
    if (!q) {
      await this.#onSectionComplete();
      return;
    }
    this.#currentQuestion = q;
    this.#wrongAttempts = 0;
    this.#usedIds.add(q.id);
    const sectionData = this.#loadedSections.get(this.#activeSectionId);
    const total = sectionData?.questions?.length ?? 0;
    const num   = this.#usedIds.size; // already added above
    this.#evalPanel.renderQuestion(q, answer => this.handleAnswer(answer), num, total);
  }

  async #onSectionComplete() {
    const legendary = this.#isMasterQuest && this.#sessionCorrect === this.#sessionTotal && this.#sessionTotal > 0;

    // Check exam unlock BEFORE endSession resets the counters
    const activeSection = this.#unlockManager.getAllSections().find(s => s.id === this.#activeSectionId);
    let examUnlocked = null;
    if (activeSection?.isExam) {
      examUnlocked = this.#unlockManager.checkExamUnlock(this.#activeSectionId);
    }

    this.#endSession({ legendary });

    if (legendary) {
      this.#evalPanel.showMessage(`
        <div class="section-complete legendary-complete">
          <div class="complete-icon">💛</div>
          <h2>¡LEGENDARIO!</h2>
          <p>Completaste el Master Quest con un <strong>100%</strong> de aciertos.</p>
          <p class="legendary-badge-text">🏆 Insignia Legendaria desbloqueada</p>
        </div>
      `);
    } else {
      this.#evalPanel.showMessage(`
        <div class="section-complete">
          <div class="complete-icon">🎉</div>
          <h2>¡Sección completada!</h2>
          <p>Has respondido todas las preguntas de esta sesión.</p>
          <p>Puedes repasar otras secciones desde el menú lateral.</p>
        </div>
      `);
    }

    if (examUnlocked) await this.#handleUnlock(examUnlocked);
  }

  #onCorrect(answer) {
    this.#evalPanel.showCorrectResult(answer);
    this.#sessionCorrect++;
    this.#sessionTotal++;
    this.#tracker.recordAnswer(this.#activeSectionId, this.#currentQuestion.id, true);

    const unlocked = this.#unlockManager.checkUnlock(this.#activeSectionId, this.#sessionCorrect);

    setTimeout(async () => {
      this.#evalPanel.markCorrect();
      if (unlocked) await this.#handleUnlock(unlocked);
      setTimeout(() => this.#nextQuestion(), 400);
    }, 1200);
  }

  #onWrong(answer) {
    this.#tracker.recordAnswer(this.#activeSectionId, this.#currentQuestion.id, false);
    const maxHints = this.#currentQuestion.hints?.length ?? 0;

    if (this.#wrongAttempts < maxHints) {
      this.#evalPanel.showWrongFeedback(this.#wrongAttempts);
      this.#wrongAttempts++;
    } else {
      this.#sessionTotal++;
      this.#evalPanel.showExplanation(answer);
      setTimeout(() => this.#nextQuestion(), 2000);
    }
  }

  async #handleUnlock(newSection) {
    // Load section data
    await this.#ensureSectionLoaded(newSection);

    // Add documentation only if the section has it
    if (!newSection.isExam) {
      const data = this.#loadedSections.get(newSection.id);
      if (data?.documentation) this.#docPanel.addSection(newSection, data);
    }

    this.#renderSidebar();

    await Swal.fire({
      title: `🔓 ¡${newSection.isExam ? 'Examen' : 'Sección'} Desbloqueado!`,
      html: `
        <div class="unlock-content">
          <span class="unlock-icon">${newSection.icon}</span>
          <h3>${newSection.title}</h3>
          <p>${newSection.description}</p>
          ${newSection.isExam ? '<p><em>Selecciona el examen en el menú lateral para comenzar.</em></p>' : '<p>La documentación está disponible en el panel derecho.</p>'}
        </div>
      `,
      background: '#16213e',
      color: '#e0e0e0',
      confirmButtonText: '¡Vamos!',
      confirmButtonColor: newSection.color ?? '#4CAF50',
      timer: 8000,
      timerProgressBar: true
    });
  }

  /** Records the current session and resets counters. Prevents double-recording. */
  #endSession({ legendary = false } = {}) {
    if (this.#activeSectionId && this.#sessionTotal > 0) {
      this.#tracker.recordSession(this.#activeSectionId, {
        correct: this.#sessionCorrect,
        total: this.#sessionTotal,
        legendary
      });
      // Reset immediately to prevent double-recording if endSession is called again
      this.#sessionTotal = 0;
      this.#sessionCorrect = 0;
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

    let picked;

    if (this.#isMasterQuest) {
      // Master Quest: sorted by difficulty but shuffled within same difficulty level
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      shuffled.sort((a, b) => a.difficulty - b.difficulty);
      picked = shuffled[0];
    } else if (this.#sessionCorrect < 3) {
      // Warm-up: pick randomly from the easiest available difficulty group
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const minDiff = Math.min(...shuffled.map(q => q.difficulty));
      const easyPool = shuffled.filter(q => q.difficulty === minDiff);
      picked = easyPool[Math.floor(Math.random() * easyPool.length)];
    } else {
      // After warm-up: fully random order
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      picked = shuffled[0];
    }

    // For multiple-choice: shuffle options and update correctIndex accordingly
    if (picked?.type === 'multiple_choice') {
      const tagged = picked.options.map((opt, i) => ({ opt, correct: i === picked.correctIndex }));
      for (let i = tagged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
      }
      picked = {
        ...picked,
        options: tagged.map(t => t.opt),
        correctIndex: tagged.findIndex(t => t.correct)
      };
    }

    return picked;
  }

  #validateAnswer(answer, question) {
    switch (question.type) {
      case 'multiple_choice':
        return { correct: answer === question.correctIndex };
      case 'identification':
        return {
          correct: question.acceptedAnswers.some(
            a => a.toLowerCase() === String(answer).trim().toLowerCase()
          )
        };
      case 'code_writing': {
        const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
        const a = norm(answer);
        if (a === norm(question.expectedAnswer)) return { correct: true };
        return { correct: (question.alternateAnswers ?? []).map(norm).includes(a) };
      }
      default:
        return { correct: false };
    }
  }

  #getAllSectionConfigs() {
    const all = [];
    for (const group of (this.#courseData?.groups ?? [])) {
      all.push(...group.sections);
      if (group.exam) all.push(group.exam);
    }
    return all;
  }

  #renderSidebar() {
    const groups = this.#unlockManager.getGroups();
    const unlockedIds = this.#unlockManager.getUnlockedSections().map(s => s.id);

    this.#sidebar.render(groups, unlockedIds, this.#activeSectionId, id => {
      const p = this.#tracker.getSectionProgress(id);
      const sectionData = this.#loadedSections.get(id);
      return {
        sessions: p.sessions,
        totalCorrect: p.totalCorrect,
        totalAttempted: p.totalAttempted,
        uniqueAnswered: this.#tracker.getUniqueAnswered(id),
        totalQuestionsAvailable: sectionData?.questions?.length ?? 0
      };
    });
  }
}
