/**
 * DocumentationPanel — Progressive documentation panel.
 * Sections are added as the user unlocks them.
 * Groups sections under collapsible group headers.
 * Includes "Collapse All / Expand All" button at the top.
 */
export class DocumentationPanel {
  #container;
  #renderedSections = new Set();
  #groups = new Map(); // groupId → { headerEl, bodyEl }

  constructor(container) {
    this.#container = container;
    this.#buildControls();
  }

  /**
   * Adds documentation for a newly unlocked section.
   * @param {object} sectionConfig - { id, title, icon, color, _groupId }
   * @param {object} sectionData - section JSON (with .documentation.sections[])
   */
  addSection(sectionConfig, sectionData) {
    if (this.#renderedSections.has(sectionConfig.id)) return;
    this.#renderedSections.add(sectionConfig.id);

    const placeholder = this.#container.querySelector('.doc-placeholder');
    if (placeholder) placeholder.remove();

    // Find or create the group container
    const groupId = sectionConfig._groupId ?? 'default';
    const groupBody = this.#getOrCreateGroupContainer(groupId, sectionConfig);

    const block = document.createElement('div');
    block.className = 'doc-section';
    block.id = `doc-${sectionConfig.id}`;
    block.style.setProperty('--section-color', sectionConfig.color);

    block.innerHTML = `
      <div class="doc-section-header">
        <span class="doc-icon">${sectionConfig.icon}</span>
        <h3>${sectionConfig.title}</h3>
        <button class="doc-section-toggle" aria-expanded="true" title="Colapsar sección">▼</button>
      </div>
      <div class="doc-section-body">
        ${sectionData.documentation.sections.map(s => this.#renderDocEntry(s)).join('')}
      </div>
    `;

    // Section-level collapse toggle: collapses/expands all entries in this section
    const sectionToggle = block.querySelector('.doc-section-toggle');
    const sectionBody = block.querySelector('.doc-section-body');
    sectionToggle.addEventListener('click', () => {
      const expanded = sectionToggle.getAttribute('aria-expanded') === 'true';
      sectionToggle.setAttribute('aria-expanded', !expanded);
      sectionToggle.textContent = expanded ? '▶' : '▼';
      sectionBody.style.display = expanded ? 'none' : '';
    });

    // Make each entry collapsible
    block.querySelectorAll('.doc-entry-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.doc-entry').classList.toggle('collapsed');
        const toggle = header.querySelector('.doc-entry-toggle');
        if (toggle) toggle.textContent = header.closest('.doc-entry').classList.contains('collapsed') ? '▶' : '▼';
      });
    });

    groupBody.appendChild(block);

    // Animate in
    requestAnimationFrame(() => block.classList.add('doc-section-visible'));
  }

  /** Scrolls to a specific section. */
  scrollTo(sectionId) {
    const el = this.#container.querySelector(`#doc-${sectionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Collapses all doc sections and groups, then expands and scrolls to the target section.
   * Called when the user clicks a section in the sidebar.
   */
  focusSection(sectionId) {
    const target = this.#container.querySelector(`#doc-${sectionId}`);
    if (!target) return;

    // Collapse all section bodies and reset their toggles
    this.#container.querySelectorAll('.doc-section-body').forEach(body => {
      body.style.display = 'none';
    });
    this.#container.querySelectorAll('.doc-section-toggle').forEach(t => {
      t.setAttribute('aria-expanded', 'false');
      t.textContent = '▶';
    });

    // Expand all group bodies (keep groups open so the section is visible)
    this.#container.querySelectorAll('.doc-group-body').forEach(body => {
      body.style.display = '';
    });
    this.#container.querySelectorAll('.doc-group-toggle').forEach(t => {
      t.setAttribute('aria-expanded', 'true');
      t.textContent = '▼';
    });

    // Expand the target section
    const targetBody = target.querySelector('.doc-section-body');
    const targetToggle = target.querySelector('.doc-section-toggle');
    if (targetBody) targetBody.style.display = '';
    if (targetToggle) {
      targetToggle.setAttribute('aria-expanded', 'true');
      targetToggle.textContent = '▼';
    }

    // Scroll to it
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  #buildControls() {
    const ctrl = document.createElement('div');
    ctrl.className = 'doc-controls';
    ctrl.innerHTML = `
      <button class="btn-doc-collapse-all" title="Colapsar / expandir toda la documentación">
        ⊟ Colapsar todo
      </button>
    `;
    this.#container.before(ctrl);

    let allCollapsed = false;
    ctrl.querySelector('.btn-doc-collapse-all').addEventListener('click', (e) => {
      allCollapsed = !allCollapsed;
      this.#container.querySelectorAll('.doc-entry').forEach(entry => {
        entry.classList.toggle('collapsed', allCollapsed);
        const toggle = entry.querySelector('.doc-entry-toggle');
        if (toggle) toggle.textContent = allCollapsed ? '▶' : '▼';
      });
      this.#container.querySelectorAll('.doc-section-body').forEach(body => {
        body.style.display = allCollapsed ? 'none' : '';
      });
      this.#container.querySelectorAll('.doc-section-toggle').forEach(t => {
        t.setAttribute('aria-expanded', !allCollapsed);
        t.textContent = allCollapsed ? '▶' : '▼';
      });
      this.#container.querySelectorAll('.doc-group-body').forEach(body => {
        body.style.display = allCollapsed ? 'none' : '';
      });
      this.#container.querySelectorAll('.doc-group-toggle').forEach(t => {
        t.setAttribute('aria-expanded', !allCollapsed);
        t.textContent = allCollapsed ? '▶' : '▼';
      });
      e.currentTarget.textContent = allCollapsed ? '⊞ Expandir todo' : '⊟ Colapsar todo';
    });
  }

  #getOrCreateGroupContainer(groupId, sectionConfig) {
    if (this.#groups.has(groupId)) return this.#groups.get(groupId);

    const groupEl = document.createElement('div');
    groupEl.className = 'doc-group';
    groupEl.id = `doc-group-${groupId}`;
    groupEl.innerHTML = `
      <div class="doc-group-header">
        <span class="doc-group-title">📐 ${this.#guessGroupTitle(groupId)}</span>
        <button class="doc-group-toggle" aria-expanded="true" title="Colapsar grupo">▼</button>
      </div>
      <div class="doc-group-body"></div>
    `;

    const body = groupEl.querySelector('.doc-group-body');
    const toggle = groupEl.querySelector('.doc-group-toggle');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !expanded);
      toggle.textContent = expanded ? '▶' : '▼';
      body.style.display = expanded ? 'none' : '';
    });

    this.#container.appendChild(groupEl);
    this.#groups.set(groupId, body);
    return body;
  }

  #guessGroupTitle(groupId) {
    const titles = { poo: 'POO Fundamentals', default: 'Documentación' };
    return titles[groupId] ?? groupId.toUpperCase();
  }

  #renderDocEntry(entry) {
    return `
      <div class="doc-entry doc-type-${entry.type}">
        <div class="doc-entry-header">
          <span class="doc-entry-title">${entry.title}</span>
          <span class="doc-entry-toggle">▼</span>
        </div>
        <div class="doc-entry-body">
          ${this.#renderContent(entry)}
        </div>
      </div>
    `;
  }

  #renderContent(entry) {
    switch (entry.type) {
      case 'code':
        return `<pre class="doc-code-block"><code>${this.#escapeHtml(entry.content)}</code></pre>`;
      case 'list':
        return `<ul class="doc-list">${entry.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
      case 'note':
        return `<div class="doc-note">${entry.content}</div>`;
      case 'analogy':
        return `<div class="doc-analogy">${entry.content}</div>`;
      default:
        return `<div class="doc-text">${entry.content}</div>`;
    }
  }

  #escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
