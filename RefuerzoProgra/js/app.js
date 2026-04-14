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

async function boot() {
  // Instantiate all services
  const dataLoader      = new DataLoader();
  const progressTracker = new ProgressTracker();
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
    sectionId => engine.selectSection(sectionId)
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
