import { icon } from '../ui/Icon.js';
import { fuzzyMatch } from './answerNormalizer.js';

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

  async handleAnswer(answer) {
    if (!this.#currentQuestion) return;
    const { correct } = await this.#validateAnswer(answer, this.#currentQuestion);
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
    this.#wrongAttempts = 0;
    this.#isMasterQuest = masterQuest;

    // Pre-populate usedIds with CORRECTLY answered IDs so they are skipped on
    // re-entry. Wrong-only attempts stay in the pool. MasterQuest = full pool.
    const correctIds = masterQuest
      ? []
      : this.#tracker.getCorrectlyAnsweredIds(sectionId);
    this.#usedIds = new Set(correctIds);

    this.#evalPanel.clear();

    // Restore history panel with correctly answered questions from previous sessions.
    // Wrong answers from past sessions are intentionally omitted — they re-enter the pool.
    const secData = this.#loadedSections.get(sectionId);
    if (!masterQuest && correctIds.length > 0 && secData?.questions) {
      const correctSet = new Set(correctIds);
      const restoredQuestions = secData.questions.filter(q => correctSet.has(q.id));
      this.#evalPanel.restoreHistory(restoredQuestions);
    }

    const totalQ = secData?.questions?.length ?? 0;

    this.#evalPanel.showMessage(`
      <div class="section-start-card" style="--section-color:${sec.color ?? '#58a6ff'}">
        <span class="section-start-icon">${icon(sec.icon)}</span>
        <h2>${sec.title}</h2>
        <p>${sec.description}</p>
        ${masterQuest ? `<div class="master-quest-banner">${icon('swords')} Master Quest — ${totalQ} preguntas</div>` : ''}
      </div>
    `);

    setTimeout(() => this.#nextQuestion(), 800);
  }

  async #nextQuestion() {
    const q = this.#pickQuestion();
    if (!q) {
      // If we haven't answered a single question this session, the pool was already
      // empty from the pre-fill — meaning all questions have been explored before.
      if (!this.#isMasterQuest && this.#sessionCorrect === 0 && this.#sessionTotal === 0) {
        const sectionData = this.#loadedSections.get(this.#activeSectionId);
        const totalQ = sectionData?.questions?.length ?? 0;
        const uniqueAnswered = this.#tracker.getUniqueAnswered(this.#activeSectionId);
        if (totalQ > 0 && uniqueAnswered >= totalQ) {
          this.#showAllExploredMessage();
          return;
        }
      }
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
          <div class="complete-icon">${icon('heart')}</div>
          <h2>¡LEGENDARIO!</h2>
          <p>Completaste el Master Quest con un <strong>100%</strong> de aciertos.</p>
          <p class="legendary-badge-text">${icon('trophy')} Insignia Legendaria desbloqueada</p>
        </div>
      `);
    } else {
      this.#evalPanel.showMessage(`
        <div class="section-complete">
          <div class="complete-icon">${icon('party')}</div>
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
      this.#renderSidebar(); // keep progress bar / question count in sync after every answer
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
      // Return this question to the pool — it stays "unanswered" until the user
      // gets it right. It will surface again at a random point in the session.
      this.#usedIds.delete(this.#currentQuestion.id);
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
      title: `${icon('unlock')} ¡${newSection.isExam ? 'Examen' : 'Sección'} Desbloqueado!`,
      html: `
        <div class="unlock-content">
          <span class="unlock-icon" style="--section-color:${newSection.color ?? '#58a6ff'}">${icon(newSection.icon)}</span>
          <h3>${newSection.title}</h3>
          <p>${newSection.description}</p>
          ${newSection.isExam ? '<p><em>Selecciona el examen en el menú lateral para comenzar.</em></p>' : '<p>La documentación está disponible en el panel derecho.</p>'}
        </div>
      `,
      background: '#16213e',
      color: '#e0e0e0',
      confirmButtonText: '¡Vamos!',
      confirmButtonColor: newSection.color ?? '#4CAF50'
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

  async #validateAnswer(answer, question) {
    switch (question.type) {
      case 'multiple_choice':
        return { correct: answer === question.correctIndex };

      case 'identification': {
        const accepted = question.acceptedAnswers ?? [];
        // 1. Fast local match: normalized equality + token containment.
        if (accepted.some(a => fuzzyMatch(answer, a))) return { correct: true };
        // 2. Semantic fallback: ask the Workers AI grader.
        const llm = await this.#semanticValidate({
          question: question.question,
          acceptedAnswers: accepted,
          studentAnswer: answer,
        });
        return { correct: llm.correct };
      }

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

  /** Calls the Cloudflare Pages Function that grades the answer with an LLM. */
  async #semanticValidate({ question, acceptedAnswers, studentAnswer }) {
    try {
      const res = await fetch('/api/validate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, acceptedAnswers, studentAnswer }),
      });
      if (!res.ok) return { correct: false };
      const data = await res.json();
      return { correct: data?.correct === true };
    } catch {
      return { correct: false };
    }
  }

  #showAllExploredMessage() {
    const sectionId = this.#activeSectionId;
    this.#evalPanel.showAllExplored(() => this.startMasterQuest(sectionId));
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
