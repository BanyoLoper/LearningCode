/**
 * PracticeManager.js
 * Loads practice case studies (casos_de_uso/*.json) and renders them
 * inside #practice-main with CodeMirror editors for syntax-highlighted
 * C# code input and evaluation feedback.
 */

/** Maps practice tags → where to find the topic in the Theory section */
const TAG_THEORY_MAP = {
  'big-o':             'Tema 11: Complejidad y Optimización → Complejidad Algorítmica (Big O)',
  'bucles-anidados':   'Tema 2: Control de Flujo → Bucles | Tema 11: Optimización de Código en Unity',
  'caching':           'Tema 11: Complejidad y Optimización → Optimización de Código en Unity',
  'gc-pressure':       'Tema 11: Complejidad y Optimización → Optimización de Código en Unity',
  'god-class':         'Tema 16: SOLID y Buenas Prácticas → SRP — Responsabilidad Única',
  'hardcoding':        'Tema 10: Data Driven Design → Introducción a Data Driven',
  'deep-inheritance':  'Tema 4: Herencia y Polimorfismo → Herencia',
  'memory-leak':       'Tema 7: Ciclo de Vida MonoBehaviour → IEnumerator y Corrutinas',
  'missing-cache':     'Tema 11: Complejidad y Optimización → Optimización de Código en Unity',
  'missing-pool':      'Tema 5: Patrones Unity → Prefabs e Instanciación',
  'object-pooling':    'Tema 5: Patrones Unity → Prefabs e Instanciación',
  'physics-layers':    'Tema 14: Física Aplicada en Unity → Física con Rigidbody',
  'physics-manual':    'Tema 14: Física Aplicada en Unity → Traslaciones y Movimiento',
  'physics-triggers':  'Tema 14: Física Aplicada en Unity → Física con Rigidbody',
  'referencia-directa':'Tema 15: Delegados y Eventos → Eventos C#',
  'update-polling':    'Tema 7: Ciclo de Vida MonoBehaviour → Ciclo de Vida Completo',
  'wrong-structure':   'Tema 8: Estructuras de Datos → Arrays vs Listas',
  'arquitectura':      'Tema 16: SOLID y Buenas Prácticas',
  'async':             'Tema 7: Ciclo de Vida MonoBehaviour → IEnumerator y Corrutinas',
  'estructuras-datos': 'Tema 8: Estructuras de Datos',
  'eventos':           'Tema 15: Delegados y Eventos',
  'fisica':            'Tema 14: Física Aplicada en Unity',
  'optimizacion':      'Tema 11: Complejidad y Optimización',
  'patrones':          'Tema 16: SOLID y Buenas Prácticas | Tema 5: Patrones Unity',
  'sistemas-juego':    'Tema 5: Patrones Unity | Tema 10: Data Driven Design',
};

const CASE_FILES = [
  'data/casos_de_uso/optimizacion.json',
  'data/casos_de_uso/arquitectura.json',
  'data/casos_de_uso/patrones.json',
  'data/casos_de_uso/fisica.json',
  'data/casos_de_uso/sistemas_juego.json',
  'data/casos_de_uso/eventos.json',
  'data/casos_de_uso/estructuras_datos.json',
  'data/casos_de_uso/async.json',
];

export class PracticeManager {
  constructor(container) {
    this.container    = container;
    this.cases        = [];
    this.currentIndex = 0;
    this._starterCM   = null;
    this._solutionCM  = null;
    this._initialized = false;
  }

  // ─── Public ──────────────────────────────────────────────────────────────

  async init() {
    for (const file of CASE_FILES) {
      try {
        const res  = await fetch(file);
        const data = await res.json();
        if (Array.isArray(data.cases)) this.cases.push(...data.cases);
      } catch (err) {
        console.warn(`[PracticeManager] No se pudo cargar ${file}:`, err);
      }
    }
    this._initialized = true;
    this._render();
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  _render() {
    this._destroyEditors();

    if (this.cases.length === 0) {
      this.container.innerHTML =
        '<p class="panel-message">No hay casos de uso disponibles.</p>';
      return;
    }

    const c = this.cases[this.currentIndex];
    this.container.innerHTML = this._buildHTML(c);
    this._initEditors(c);
    this._bindEvents(c);
  }

  _buildHTML(c) {
    const stars   = '★'.repeat(c.difficulty) + '☆'.repeat(3 - c.difficulty);
    const tagsHtml = c.tags
      .map(t => {
        const tip = TAG_THEORY_MAP[t];
        return tip
          ? `<span class="practice-tag" data-tooltip="${tip}">${t}</span>`
          : `<span class="practice-tag">${t}</span>`;
      })
      .join('');

    return `
      <div class="practice-wrap">

        <div class="practice-topbar">
          <button id="btn-prev-case" class="practice-nav-btn"
            ${this.currentIndex === 0 ? 'disabled' : ''}>◀ Anterior</button>
          <span class="practice-counter">
            Caso ${this.currentIndex + 1} / ${this.cases.length}
          </span>
          <button id="btn-next-case" class="practice-nav-btn"
            ${this.currentIndex === this.cases.length - 1 ? 'disabled' : ''}>Siguiente ▶</button>
        </div>

        <div class="practice-card">
          <div class="practice-meta">
            <span class="practice-difficulty">${stars}</span>
            <span class="practice-genre">🎮 ${c.genre}</span>
            ${tagsHtml}
          </div>
          <h2 class="practice-title">${c.title}</h2>
          <p class="practice-context">${this._md(c.context)}</p>
          <p class="practice-scenario">${this._md(c.scenario)}</p>
        </div>

        <div class="practice-card">
          <div class="practice-section-label">Código con el problema</div>
          <div class="cm-wrap cm-readonly">
            <textarea id="starter-cm">${this._escHtml(c.starterCode)}</textarea>
          </div>
        </div>

        <div class="practice-card">
          <div class="practice-section-label">Tu solución — reescribe o mejora el código</div>
          <div class="cm-wrap cm-editable">
            <textarea id="solution-cm"></textarea>
          </div>
          <div class="practice-eval-row">
            <span id="eval-hint" class="eval-hint"></span>
            <button id="btn-evaluate" class="btn-submit">Evaluar →</button>
          </div>
        </div>

        <div id="practice-results" class="practice-results-hidden"></div>

      </div>`;
  }

  // ─── Editors ─────────────────────────────────────────────────────────────

  _initEditors(c) {
    // Read-only starter code — auto-height to show everything
    this._starterCM = CodeMirror.fromTextArea(
      document.getElementById('starter-cm'), {
        mode:          'text/x-csharp',
        theme:         'dracula',
        readOnly:      true,
        lineNumbers:   true,
        viewportMargin: Infinity,
        lineWrapping:  false,
      }
    );
    this._starterCM.setValue(c.starterCode);

    // Editable solution — fixed scrollable height
    this._solutionCM = CodeMirror.fromTextArea(
      document.getElementById('solution-cm'), {
        mode:          'text/x-csharp',
        theme:         'dracula',
        readOnly:      false,
        lineNumbers:   true,
        lineWrapping:  false,
        indentWithTabs: false,
        tabSize:        4,
        indentUnit:     4,
        autofocus:      false,
        extraKeys: {
          Tab:         cm => cm.replaceSelection('    '),
          'Ctrl-Enter': () => document.getElementById('btn-evaluate')?.click(),
        },
      }
    );
    this._solutionCM.setSize(null, 300);
  }

  _destroyEditors() {
    if (this._starterCM)   { this._starterCM.toTextArea();   this._starterCM   = null; }
    if (this._solutionCM)  { this._solutionCM.toTextArea();  this._solutionCM  = null; }
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  _bindEvents(c) {
    document.getElementById('btn-prev-case')
      ?.addEventListener('click', () => {
        if (this.currentIndex > 0) { this.currentIndex--; this._render(); }
      });

    document.getElementById('btn-next-case')
      ?.addEventListener('click', () => {
        if (this.currentIndex < this.cases.length - 1) {
          this.currentIndex++; this._render();
        }
      });

    document.getElementById('btn-evaluate')
      ?.addEventListener('click', () => this._evaluate(c));
  }

  // ─── Evaluation ──────────────────────────────────────────────────────────

  _evaluate(c) {
    const code    = this._solutionCM.getValue().trim();
    const hintEl  = document.getElementById('eval-hint');

    if (code.length < 30) {
      hintEl.textContent = 'Escribe tu solución antes de evaluar.';
      hintEl.style.color = 'var(--red)';
      return;
    }
    hintEl.textContent = '';

    const results = c.criteria.map(cr => {
      const regex   = new RegExp(cr.pattern, 'gis');
      const matched = regex.test(code);
      const passed  = cr.check === 'keyword' ? matched : !matched;
      return { ...cr, passed };
    });

    const earned = results.filter(r => r.passed).reduce((s, r) => s + r.points, 0);
    const max    = results.reduce((s, r) => s + r.points, 0);
    const ratio  = earned / max;
    const key    = ratio >= 0.7 ? 'high' : ratio >= 0.35 ? 'mid' : 'low';

    this._showResults(results, earned, max, c, key);
  }

  // ─── Results ─────────────────────────────────────────────────────────────

  _showResults(results, earned, max, c, feedbackKey) {
    const el          = document.getElementById('practice-results');
    const scoreClass  = earned / max >= 0.7 ? 'score-high'
                      : earned / max >= 0.35 ? 'score-mid' : 'score-low';

    const criteriaHtml = results.map(r => `
      <div class="criteria-row ${r.passed ? 'criteria-pass' : 'criteria-fail'}">
        <span class="criteria-check">${r.passed ? '✅' : '❌'}</span>
        <span class="criteria-label-text">${r.label}</span>
        <span class="criteria-pts ${r.passed ? 'score-high' : 'score-low'}">
          ${r.passed ? '+' + r.points : '0'}&nbsp;pts
        </span>
      </div>`).join('');

    const altsHtml = c.alternatives
      .map(a => `<li class="alt-item">${this._md(a)}</li>`).join('');

    el.className = 'practice-results-visible';
    el.innerHTML = `
      <div class="practice-card results-card">
        <div class="results-header">
          <span class="results-score-label">Resultado</span>
          <span class="results-score ${scoreClass}">${earned} / ${max} pts</span>
        </div>
        <div class="criteria-list">${criteriaHtml}</div>
        <div class="results-feedback">${this._md(c.feedback[feedbackKey])}</div>
        <details class="results-details">
          <summary>Ver solución de referencia</summary>
          <div class="ideal-solution-wrap">
            <textarea id="ideal-cm">${this._escHtml(c.idealSolution)}</textarea>
          </div>
        </details>
        <details class="results-details">
          <summary>Otras alternativas válidas</summary>
          <ul class="alts-list">${altsHtml}</ul>
        </details>
      </div>`;

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Init ideal solution editor only when the details panel is opened
    const detailsEl = el.querySelector('details:first-of-type');
    detailsEl.addEventListener('toggle', function handler(e) {
      if (!e.target.open) return;
      e.target.removeEventListener('toggle', handler);
      const area = document.getElementById('ideal-cm');
      if (!area) return;
      const cm = CodeMirror.fromTextArea(area, {
        mode:          'text/x-csharp',
        theme:         'dracula',
        readOnly:      true,
        lineNumbers:   true,
        viewportMargin: Infinity,
      });
      cm.setValue(area.value);
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Converts **bold** markdown to <strong> */
  _md(text) {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  /** Escapes HTML entities for safe injection into textarea value attribute */
  _escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
