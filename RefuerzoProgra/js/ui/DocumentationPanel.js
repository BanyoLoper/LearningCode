/**
 * DocumentationPanel — Renders and manages the documentation sidebar.
 * Sections are added progressively as the user unlocks them.
 */
export class DocumentationPanel {
  #container;
  #renderedSections = new Set();

  constructor(container) {
    this.#container = container;
  }

  /**
   * Adds documentation for a newly unlocked section.
   * @param {object} sectionConfig - from course.json (id, title, icon, color)
   * @param {object} sectionData - from the section's JSON (documentation.sections[])
   */
  addSection(sectionConfig, sectionData) {
    if (this.#renderedSections.has(sectionConfig.id)) return;
    this.#renderedSections.add(sectionConfig.id);

    // Remove placeholder if present
    const placeholder = this.#container.querySelector('.doc-placeholder');
    if (placeholder) placeholder.remove();

    const block = document.createElement('div');
    block.className = 'doc-section';
    block.id = `doc-${sectionConfig.id}`;
    block.style.setProperty('--section-color', sectionConfig.color);

    block.innerHTML = `
      <div class="doc-section-header">
        <span class="doc-icon">${sectionConfig.icon}</span>
        <h3>${sectionConfig.title}</h3>
      </div>
      <div class="doc-section-body">
        ${sectionData.documentation.sections.map(s => this.#renderDocEntry(s)).join('')}
      </div>
    `;

    // Make entries collapsible
    block.querySelectorAll('.doc-entry-header').forEach(header => {
      header.addEventListener('click', () => {
        const entry = header.closest('.doc-entry');
        entry.classList.toggle('collapsed');
      });
    });

    this.#container.appendChild(block);

    // Animate in
    requestAnimationFrame(() => block.classList.add('doc-section-visible'));
  }

  /** Scrolls to a specific section in the docs panel. */
  scrollTo(sectionId) {
    const el = this.#container.querySelector(`#doc-${sectionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  #renderDocEntry(entry) {
    const typeClass = `doc-type-${entry.type}`;
    return `
      <div class="doc-entry ${typeClass}">
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
        return `<div class="doc-note">📌 ${entry.content}</div>`;
      case 'analogy':
        return `<div class="doc-analogy">🎮 ${entry.content}</div>`;
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
