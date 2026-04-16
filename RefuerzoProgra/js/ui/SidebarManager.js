/**
 * SidebarManager — Left sidebar navigation.
 * Renders sections grouped by their parent group (course structure).
 * Shows session history (last 2 auto-expanded, "ver todo" button for rest).
 * Shows answered/total questions progress per section.
 * Includes Master Quest button per unlocked section.
 */
export class SidebarManager {
  #nav;
  #onSectionClick;
  #onMasterQuest;

  /**
   * @param {HTMLElement} navContainer
   * @param {function} onSectionClick - (sectionId) => void
   * @param {function} onMasterQuest  - (sectionId) => void
   */
  constructor(navContainer, onSectionClick, onMasterQuest) {
    this.#nav = navContainer;
    this.#onSectionClick = onSectionClick;
    this.#onMasterQuest = onMasterQuest;
  }

  /**
   * Full re-render.
   * @param {object[]} groups - course groups (each with .sections[] and optional .exam)
   * @param {string[]} unlockedIds
   * @param {string} activeSectionId
   * @param {function} getProgress - (sectionId) => { sessions, totalCorrect, totalAttempted, uniqueAnswered, totalQuestionsAvailable }
   */
  render(groups, unlockedIds, activeSectionId, getProgress) {
    this.#nav.innerHTML = '';

    groups.forEach((group, i) => {
      const groupEl = this.#renderGroup(group, i + 1, unlockedIds, activeSectionId, getProgress);
      this.#nav.appendChild(groupEl);
    });
  }

  /** Highlights active section without full re-render. */
  setActive(sectionId) {
    this.#nav.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.sectionId === sectionId);
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  #renderGroup(group, groupNum, unlockedIds, activeSectionId, getProgress) {
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-group';
    wrapper.style.setProperty('--group-color', group.color ?? '#58a6ff');

    wrapper.innerHTML = `
      <div class="nav-group-header">
        <span class="nav-group-num">${groupNum}</span>
        <span class="nav-group-icon">${group.icon}</span>
        <span class="nav-group-title">${group.title}</span>
        <button class="nav-group-toggle" aria-expanded="true" title="Colapsar grupo">▼</button>
      </div>
      <div class="nav-group-body"></div>
    `;

    const body = wrapper.querySelector('.nav-group-body');
    const toggle = wrapper.querySelector('.nav-group-toggle');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !expanded);
      toggle.textContent = expanded ? '▶' : '▼';
      body.style.display = expanded ? 'none' : '';
    });

    // Regular sections
    for (const section of group.sections) {
      body.appendChild(
        this.#renderSectionItem(section, unlockedIds, activeSectionId, getProgress)
      );
    }

    // Exam
    if (group.exam) {
      body.appendChild(
        this.#renderExamItem(group.exam, unlockedIds, activeSectionId, getProgress)
      );
    }

    return wrapper;
  }

  #renderSectionItem(section, unlockedIds, activeSectionId, getProgress) {
    const isUnlocked = unlockedIds.includes(section.id);
    const isActive = section.id === activeSectionId;
    const progress = getProgress(section.id);

    const item = document.createElement('div');
    item.className = `nav-item ${isUnlocked ? 'unlocked' : 'locked'} ${isActive ? 'active' : ''}`;
    item.dataset.sectionId = section.id;
    item.style.setProperty('--section-color', section.color);

    if (!isUnlocked) {
      item.innerHTML = `
        <div class="nav-item-main">
          <span class="nav-icon">🔒</span>
          <div class="nav-item-info">
            <span class="nav-title">${section.title}</span>
            <span class="nav-score">Bloqueado</span>
          </div>
        </div>
      `;
      return item;
    }

    const { uniqueAnswered, totalQuestionsAvailable, sessions } = progress;
    const pct = totalQuestionsAvailable > 0
      ? Math.round((uniqueAnswered / totalQuestionsAvailable) * 100)
      : 0;

    item.innerHTML = `
      <div class="nav-item-main">
        <span class="nav-icon">${section.icon}</span>
        <div class="nav-item-info">
          <span class="nav-title">${section.title}</span>
          <span class="nav-score">${uniqueAnswered} / ${totalQuestionsAvailable} preguntas</span>
        </div>
        <button class="btn-master-quest" title="Master Quest — todas las preguntas en una sesión">⚔️</button>
      </div>
      <div class="nav-mini-progress" title="${pct}% de preguntas exploradas">
        <div class="nav-mini-bar" style="width:${pct}%"></div>
      </div>
      ${this.#renderSessionHistory(sessions)}
    `;

    // Click on main area (not the master quest button) = open section
    item.querySelector('.nav-item-main').addEventListener('click', e => {
      if (e.target.closest('.btn-master-quest')) return;
      this.#onSectionClick(section.id);
    });

    item.querySelector('.btn-master-quest').addEventListener('click', e => {
      e.stopPropagation();
      this.#onMasterQuest(section.id);
    });

    return item;
  }

  #renderExamItem(exam, unlockedIds, activeSectionId, getProgress) {
    const isUnlocked = unlockedIds.includes(exam.id);
    const isActive = exam.id === activeSectionId;
    const progress = getProgress(exam.id);

    const item = document.createElement('div');
    item.className = `nav-item nav-exam-item ${isUnlocked ? 'unlocked' : 'locked'} ${isActive ? 'active' : ''}`;
    item.dataset.sectionId = exam.id;
    item.style.setProperty('--section-color', exam.color ?? '#FFD700');

    if (!isUnlocked) {
      item.innerHTML = `
        <div class="nav-item-main">
          <span class="nav-icon">🔒</span>
          <div class="nav-item-info">
            <span class="nav-title">${exam.title}</span>
            <span class="nav-score">Completa todas las secciones</span>
          </div>
        </div>
      `;
      return item;
    }

    const bestSession = progress.sessions.length
      ? progress.sessions.reduce((best, s) => s.score > best.score ? s : best)
      : null;
    const hasLegendary = progress.sessions.some(s => s.legendary);

    item.innerHTML = `
      <div class="nav-item-main">
        <span class="nav-icon">${exam.icon}${hasLegendary ? ' 💛' : ''}</span>
        <div class="nav-item-info">
          <span class="nav-title">${exam.title}</span>
          <span class="nav-score">${bestSession ? `Mejor: ${bestSession.score}%` : 'Sin intentos'}</span>
        </div>
      </div>
      ${this.#renderSessionHistory(progress.sessions)}
    `;

    item.querySelector('.nav-item-main').addEventListener('click', () => {
      this.#onSectionClick(exam.id);
    });

    return item;
  }

  #renderSessionHistory(sessions) {
    if (!sessions?.length) return '';

    const PREVIEW_COUNT = 2;
    const last = sessions.slice(-PREVIEW_COUNT).reverse();
    const rest = sessions.slice(0, -PREVIEW_COUNT).reverse();

    const renderRow = (s, num) => `
      <div class="nav-session-item">
        <span class="session-num">#${num}</span>
        <span class="session-date">${this.#formatDate(s.date)}</span>
        <span class="session-score score-${this.#scoreClass(s.score)}">
          ${s.legendary ? '💛 ' : ''}${s.score}%
        </span>
        <span class="session-detail">${s.correct}/${s.total}</span>
      </div>
    `;

    const lastRows = last.map((s, i) => renderRow(s, sessions.length - i)).join('');
    const restRows = rest.length
      ? rest.map((s, i) => renderRow(s, sessions.length - PREVIEW_COUNT - i)).join('')
      : '';

    return `
      <div class="nav-session-history">
        <div class="nav-history-label">Sesiones</div>
        ${lastRows}
        ${rest.length ? `
          <button class="btn-history-more">Ver ${rest.length} sesión${rest.length > 1 ? 'es' : ''} más ▼</button>
          <div class="nav-history-rest" style="display:none">${restRows}</div>
        ` : ''}
      </div>
    `;
  }

  #getBestScore(sessions) {
    return sessions.length ? Math.max(...sessions.map(s => s.score)) : null;
  }

  #scoreClass(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'mid';
    return 'low';
  }

  #formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    } catch { return '—'; }
  }
}

// Delegate event for "ver más" history buttons (lives outside items)
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-history-more');
  if (!btn) return;
  const rest = btn.nextElementSibling;
  if (!rest) return;
  const hidden = rest.style.display === 'none';
  rest.style.display = hidden ? '' : 'none';
  btn.textContent = hidden
    ? btn.textContent.replace('▼', '▲').replace('Ver', 'Ocultar')
    : btn.textContent.replace('▲', '▼').replace('Ocultar', 'Ver');
});
