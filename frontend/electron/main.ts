import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath }             from 'node:url';
import path                          from 'node:path';

// ─── Rutas del proceso principal ─────────────────────────────────────────────
const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH    = path.join(__dirname, '../dist');
const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL; // inyectado por vite-plugin-electron

// ─── Puerto del servidor Express embebido ────────────────────────────────────
const API_PORT = 3000;

// ─── Ventana principal ────────────────────────────────────────────────────────
let win: BrowserWindow | null = null;

// ─── Servidor Express embebido ────────────────────────────────────────────────
/**
 * Arranca Express + controllers. La DB SQLite se guarda en app.getPath('userData'):
 *   Windows → C:\Users\<user>\AppData\Roaming\WPO Analytics Engine\
 * Ese path siempre tiene permisos de escritura (a diferencia de Program Files).
 */
async function startExpressServer(): Promise<void> {
  // ── 1. Inyectar ruta de SQLite ANTES de cualquier import que abra la DB ────
  const userDataPath = app.getPath('userData');
  process.env.WPO_DB_PATH   = path.join(userDataPath, 'wpo-historics.sqlite');
  process.env.ELECTRON_MODE = 'true';
  console.log(`[Electron] SQLite DB → ${process.env.WPO_DB_PATH}`);

  // ── 2. Importar Express y controllers dinámicamente (garantiza orden env) ──
  const { default: express }          = await import('express');
  const { default: cors }             = await import('cors');
  const { default: compression }      = await import('compression');
  const { WPOController }             = await import('../../api/src/controllers/wpo.controller.js');
  const { AutomationsController }     = await import('../../api/src/controllers/automations.controller.js');
  const { CrawlerController }         = await import('../../api/src/controllers/crawler.controller.js');
  const { enqueueAudit, getQueueLength } = await import('./auditor.js');

  const server = express();
  server.use(cors());
  server.use(compression() as any);
  server.use(express.json({ limit: '10mb' }));

  // ── Web Crawler ─────────────────────────────────────────────────────────────
  server.get('/api/crawl', CrawlerController.crawl);

  // ── Rutas de auditoría ────────────────────────────────────────────────────
  // POST /api/audit/ondemand — ejecuta Lighthouse localmente vía auditor.ts
  server.post('/api/audit/ondemand', async (req, res) => {
    const { url, strategy = 'mobile' } = req.body as { url?: string; strategy?: string };
    if (!url) { res.status(400).json({ error: 'Se requiere el campo url.' }); return; }
    try { new URL(url); } catch {
      res.status(400).json({ error: 'URL inválida. Incluye http:// o https://' }); return;
    }
    if (strategy !== 'mobile' && strategy !== 'desktop') {
      res.status(400).json({ error: 'strategy debe ser "mobile" o "desktop".' }); return;
    }
    // Encolamos y respondemos inmediatamente (202 Accepted)
    enqueueAudit(url, strategy as 'mobile' | 'desktop')
      .then(m => console.log(`[Electron] Auditoría completada para ${m.url}`))
      .catch(e => console.error('[Electron] Error en auditoría:', e));
    res.status(202).json({ message: `Auditoría encolada para ${url}`, mode: 'electron-standalone' });
  });

  // POST /api/audit/batch — encola múltiples URLs
  server.post('/api/audit/batch', async (req, res) => {
    const { urls } = req.body as { urls?: string[] };
    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({ error: 'Se requiere un array de URLs.' }); return;
    }
    if (urls.length > 50) {
      res.status(413).json({ error: 'Máximo 50 URLs por batch.' }); return;
    }
    urls.forEach(url => {
      enqueueAudit(url, 'mobile')
        .then(m => console.log(`[Electron] Batch completado para ${m.url}`))
        .catch(e => console.error(`[Electron] Error batch ${url}:`, e));
    });
    res.status(202).json({ message: `${urls.length} URLs encoladas.`, mode: 'electron-standalone' });
  });

  server.post('/api/audit/baseline',   WPOController.setBaseline);
  server.get('/api/audit/metrics',     WPOController.getMetrics);
  server.get('/api/audit/all',         WPOController.getAllMetrics);
  server.get('/api/audit/history',     WPOController.getHistory);
  server.delete('/api/audit/:id',      WPOController.deleteAudit);

  // ── Cola: estado en tiempo real ───────────────────────────────────────────
  server.get('/api/queue/status', (_req, res) => {
    const pending = getQueueLength();
    res.json({ waiting: pending, active: pending > 0 ? 1 : 0, delayed: 0, failed: 0, mode: 'electron-standalone' });
  });
  server.post('/api/queue/clean-failed', (_req, res) => {
    res.json({ cleaned: 0, message: 'No-op en modo Electron (sin Redis).' });
  });

  // ── Automations ───────────────────────────────────────────────────────────
  server.get('/api/cronjobs',              AutomationsController.getCronjobs);
  server.post('/api/cronjobs',             AutomationsController.addCronjob);
  server.patch('/api/cronjobs/:id/toggle', AutomationsController.toggleCronjob);
  server.delete('/api/cronjobs/:id',       AutomationsController.deleteCronjob);
  server.get('/api/alerts',                AutomationsController.getAlerts);
  server.post('/api/alerts',               AutomationsController.addAlert);
  server.delete('/api/alerts/:id',         AutomationsController.deleteAlert);

  // ── Arranque ──────────────────────────────────────────────────────────────
  await new Promise<void>((resolve) => {
    server.listen(API_PORT, '127.0.0.1', () => {
      console.log(`[Electron] API embebida → http://127.0.0.1:${API_PORT}`);
      resolve();
    });
  });
}

// ─── Scheduler de cronjobs (reemplaza BullMQ repeatable) ─────────────────────
/**
 * Lee la tabla `cronjobs` de SQLite y registra cada entrada activa en el
 * scheduler `cron`. Cuando el cron dispara, llama a `enqueueAudit()` que
 * procesa el job con Lighthouse localmente.
 *
 * Se llama al inicio de la app y puede volver a llamarse tras cada cambio
 * en la tabla (add/delete/toggle) via IPC si se implementa en el futuro.
 */
async function startCronScheduler(): Promise<void> {
  const { CronJob }               = await import('cron');
  const { AutomationsService }    = await import('../../api/src/services/automations.service.js');
  const { enqueueAudit }          = await import('./auditor.js');

  let jobs: ReturnType<typeof CronJob.from>[] = [];

  async function loadJobs(): Promise<void> {
    // Parar los crons activos antes de recargar
    jobs.forEach(j => j.stop());
    jobs = [];

    const cronjobs = await AutomationsService.getCronjobs();
    const active   = cronjobs.filter(c => c.active);

    for (const cj of active) {
      const job = CronJob.from({
        cronTime:  cj.cron_expression,
        onTick:    () => {
          console.log(`[Cron] Disparando auditoría para ${cj.url} (${cj.strategy})`);
          enqueueAudit(cj.url, cj.strategy)
            .then(m  => console.log(`[Cron] ✓ ${m.url}`))
            .catch(e  => console.error(`[Cron] Error ${cj.url}:`, e));
        },
        start:     true,
        timeZone:  'Europe/Madrid',
      });
      jobs.push(job);
      console.log(`[Cron] Registrado: "${cj.cron_expression}" → ${cj.url}`);
    }

    console.log(`[Cron] Scheduler activo con ${active.length} job(s).`);
  }

  await loadJobs();
}

// ─── Ventana ──────────────────────────────────────────────────────────────────
function createWindow(): void {
  win = new BrowserWindow({
    title:           'WPO Analytics Engine',
    width:           1280,
    height:          800,
    minWidth:        1024,
    minHeight:       640,
    center:          true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (VITE_DEV_URL) {
    win.loadURL(VITE_DEV_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(DIST_PATH, 'index.html'));
  }
}

// ─── Ciclo de vida ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // 1. Express primero (inyecta WPO_DB_PATH en process.env)
  try {
    await startExpressServer();
  } catch (err) {
    console.error('[Electron] Error arrancando Express:', err);
  }

  // 2. Scheduler de crons (depende de que la DB esté lista)
  try {
    await startCronScheduler();
  } catch (err) {
    console.error('[Electron] Error arrancando scheduler de crons:', err);
  }

  // 3. Ventana
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
