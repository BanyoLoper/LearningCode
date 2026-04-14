/**
 * SidebarManager — Renders and manages the left sidebar navigation.
 * Shows unlocked sections, session history, and progress per section.
 */
export class SidebarManager {
  #nav;
  #onSectionClick;

  /**
   * @param {HTMLElement} navContainer
   * @param {function} onSectionClick - called with (sectionId) when user clicks a section
   */
  constructor(navContainer, onSectionClick) {
    this.#nav = navContainer;
    this.#onSectionClick = onSectionClick;
  }

  /**
   * Full re-render of the sidebar.
   * @param {object[]} allSections - all section configs from course.json
   * @param {string[]} unlockedIds - IDs of unlocked sections
   * @param {string} activeSectionId - currently active section
   * @param {function} getProgress - (sectionId) => { sessions[], totalCorrect, totalAttempted }
   */
  render(allSections, unlockedIds, activeSectionId, getProgress) {
    this.#nav.innerHTML = '';

    allSections.forEach(section => {
      const isUnlocked = unlockedIds.includes(section.id);
      const isActive = section.id === activeSectionId;
      const progress = getProgress(section.id);

      const item = document.createElement('div');
      item.className = `nav-item ${isUnlocked ? 'unlocked' : 'locked'} ${isActive ? 'active' : ''}`;
      item.dataset.sectionId = section.id;
      item.style.setProperty('--section-color', section.color);

      if (isUnlocked) {
        const best = this.#getBestScore(progress.sessions);
        item.innerHTML = `
          <div class="nav-item-main">
            <span class="nav-icon">${section.icon}</span>
            <div class="nav-item-info">
              <span class="nav-title">${section.title}</span>
              ${best !== null ? `<span class="nav-score">${best}% mejor</span>` : '<span class="nav-score">Sin sesiones</span>'}
            </div>
            ${progress.sessions.length > 0 ? '<button class="nav-history-toggle" title="Ver historial">📊</button>' : ''}
          </div>
          ${this.#renderMiniProgress(progress)}
          ${this.#renderSessionHistory(progress.sessions)}
        `;

        item.querySelector('.nav-item-main').addEventListener('click', () => {
          this.#onSectionClick(section.id);
        });

        const historyToggle = item.querySelector('.nav-history-toggle');
        if (historyToggle) {
          historyToggle.addEventListener('click', e => {
            e.stopPropagation();
            const hist = item.querySelector('.nav-session-history');
            if (hist) hist.classList.toggle('visible');
          });
        }
      } else {
        item.innerHTML = `
          <div class="nav-item-main">
            <span class="nav-icon locked-icon">🔒</span>
            <div class="nav-item-info">
              <span class="nav-title">${section.title}</span>
              <span class="nav-score">Bloqueado</span>
            </div>
          </div>
        `;
      }

      this.#nav.appendChild(item);
    });
  }

  /** Highlights a section as active without full re-render. */
  setActive(sectionId) {
    this.#nav.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.sectionId === sectionId);
    });
  }

  #renderMiniProgress(progress) {
    if (progress.totalAttempted === 0) return '';
    const pct = Math.round((progress.totalCorrect / progress.totalAttempted) * 100);
    return `
      <div class="nav-mini-progress">
        <div class="nav-mini-bar" style="width: ${pct}%"></div>
      </div>
    `;
  }

  #renderSessionHistory(sessions) {
    if (sessions.length === 0) return '';
    return `
      <div class="nav-session-history">
        <div class="nav-history-label">Historial de sesiones</div>
        ${sessions.slice().reverse().map((s, i) => `
          <div class="nav-session-item">
            <span class="session-num">#${sessions.length - i}</span>
            <span class="session-date">${this.#formatDate(s.date)}</span>
            <span class="session-score score-${this.#scoreClass(s.score)}">${s.score}%</span>
            <span class="session-detail">${s.correct}/${s.total}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  #getBestScore(sessions) {
    if (!sessions.length) return null;
    return Math.max(...sessions.map(s => s.score));
  }

  #scoreClass(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'mid';
    return 'low';
  }

  #formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    } catch {
      return '—';
    }
  }
}
