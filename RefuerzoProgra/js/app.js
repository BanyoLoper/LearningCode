/**
 * app.js — Entry point. Wires all dependencies together and boots the course.
 * All modules are imported here; this is the only file that knows about everything.
 */
import { DataLoader }         from './core/DataLoader.js';
import { ProgressTracker }    from './core/ProgressTracker.js';
import { UnlockManager }      from './core/UnlockManager.js';
import { CourseEngine }       from './core/CourseEngine.js';
import { EvaluationPanel }    from './ui/EvaluationPanel.js';
import { DocumentationPanel } from './ui/DocumentationPanel.js';
import { SidebarManager }     from './ui/SidebarManager.js';

// ─── Remote sync helpers ──────────────────────────────────────────────────────

/** Fetches the authenticated user email from the Cloudflare Zero Trust header via Worker. */
async function fetchUserEmail() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return null;
    const { email } = await res.json();
    return email ?? null;
  } catch {
    return null;
  }
}

/** Fetches the user's remote progress from D1. Returns {} on any failure. */
async function fetchRemoteProgress() {
  try {
    const res = await fetch('/api/progress');
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === 'object' && !data.error ? data : null;
  } catch {
    return null;
  }
}

/** Pushes the current progress state to D1. Fire-and-forget. */
async function pushRemoteProgress(state) {
  try {
    await fetch('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {
    // Silent fail — localStorage already has the data
  }
}

/** Returns a debounced version of fn with the given delay in ms. */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  // Fetch user identity and remote progress in parallel before building the tracker
  const [userEmail, remoteProgress] = await Promise.all([
    fetchUserEmail(),
    fetchRemoteProgress(),
  ]);

  // Show email in header (or hide the element if not available)
  const emailEl = document.getElementById('user-email');
  if (emailEl) {
    if (userEmail) {
      emailEl.textContent = userEmail;
      emailEl.title = userEmail;
    } else {
      emailEl.style.display = 'none';
    }
  }

  // Debounced remote sync — pushes after 1.5 s of inactivity to avoid spamming D1
  const syncToRemote = debounce((state) => pushRemoteProgress(state), 1500);

  // Instantiate all services
  const dataLoader      = new DataLoader();
  const progressTracker = new ProgressTracker({
    onSave: () => syncToRemote(progressTracker.getState()),
  });

  // If we got remote data, use it as the source of truth (overrides localStorage)
  if (remoteProgress && Object.keys(remoteProgress).length > 0) {
    progressTracker.loadState(remoteProgress);
  }

  const unlockManager   = new UnlockManager(progressTracker);

  // Instantiate UI panels
  const evaluationPanel = new EvaluationPanel(
    document.getElementById('current-question-container'),
    document.getElementById('topic-questions-container')
  );

  const documentationPanel = new DocumentationPanel(
    document.getElementById('documentation-content')
  );

  let engine; // defined below so sidebar can reference it

  const sidebarManager = new SidebarManager(
    document.getElementById('sections-nav'),
    sectionId => engine.selectSection(sectionId),
    sectionId => engine.startMasterQuest(sectionId)
  );

  // Wire engine with all dependencies
  engine = new CourseEngine({
    dataLoader,
    progressTracker,
    unlockManager,
    evaluationPanel,
    documentationPanel,
    sidebarManager
  });

  // Initialize
  await engine.init();

  // Hide loading overlay
  document.getElementById('loading-overlay').style.display = 'none';

  // Reset button (dev helper)
  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    const result = await Swal.fire({
      title: '¿Reiniciar progreso?',
      text: 'Se borrará todo tu historial y progreso. Esta acción no se puede deshacer.',
      icon: 'warning',
      background: '#16213e',
      color: '#e0e0e0',
      showCancelButton: true,
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f44336'
    });
    if (result.isConfirmed) {
      progressTracker.reset();
      await pushRemoteProgress({}); // also wipe the D1 record
      window.location.reload();
    }
  });
}

boot().catch(err => {
  console.error('Error al iniciar el curso:', err);
  const overlay = document.getElementById('loading-overlay');
  overlay.innerHTML = `
    <div class="error-message">
      <div class="error-icon">⚠️</div>
      <h2>Error al cargar el curso</h2>
      <p>Asegúrate de abrir el proyecto desde un servidor web local.</p>
      <p>Ejecuta <code>serve.bat</code> en esta carpeta y accede a:</p>
      <a href="http://localhost:3000" class="error-link">http://localhost:3000</a>
      <details>
        <summary>Detalle técnico</summary>
        <pre>${err.message}</pre>
      </details>
    </div>
  `;
});
