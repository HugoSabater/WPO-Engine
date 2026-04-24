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
 * Arranca el servidor Express con los controllers de WPO y Automations.
 *
 * La DB SQLite se guarda en app.getPath('userData'), que en Windows es:
 *   C:\Users\<usuario>\AppData\Roaming\WPO Analytics Engine\
 * Este path siempre tiene permisos de escritura, a diferencia de Program Files.
 *
 * BullMQ/Redis NO se inicializa: en modo escritorio las auditorías son
 * síncronas (on-demand directo). La cola de cron es solo para el modo Docker.
 */
async function startExpressServer(): Promise<void> {
  // ── 1. Inyectar la ruta de SQLite ANTES de importar database.ts ───────────
  //    CRÍTICO: la importación de database.ts abre la conexión en el momento
  //    del import. Si WPO_DB_PATH no está seteado, usará la ruta por defecto.
  const userDataPath = app.getPath('userData');
  process.env.WPO_DB_PATH   = path.join(userDataPath, 'wpo-historics.sqlite');
  process.env.ELECTRON_MODE = 'true';   // guard para deshabilitar BullMQ
  console.log(`[Electron] SQLite DB → ${process.env.WPO_DB_PATH}`);

  // ── 2. Importar Express y controllers DESPUÉS de setear las env vars ──────
  //    Usamos import() dinámico para garantizar el orden correcto.
  const { default: express }                 = await import('express');
  const { default: cors }                    = await import('cors');
  const { default: compression }             = await import('compression');
  const { WPOController }                    = await import('../../api/src/controllers/wpo.controller.js');
  const { AutomationsController }            = await import('../../api/src/controllers/automations.controller.js');

  const server = express();
  server.use(cors());
  server.use(compression() as any);
  server.use(express.json({ limit: '10mb' }));

  // ── Rutas de auditoría ────────────────────────────────────────────────────
  server.post('/api/audit/batch',      WPOController.enqueueBatchAudit);
  server.post('/api/audit/ondemand',   WPOController.enqueueOnDemand);
  server.post('/api/audit/baseline',   WPOController.setBaseline);
  server.get('/api/audit/metrics',     WPOController.getMetrics);
  server.get('/api/audit/all',         WPOController.getAllMetrics);
  server.get('/api/audit/history',     WPOController.getHistory);
  server.delete('/api/audit/:id',      WPOController.deleteAudit);

  // ── Cola (estado mock en modo Electron — Redis no disponible) ────────────
  server.get('/api/queue/status', (_req, res) => {
    res.json({ waiting: 0, active: 0, delayed: 0, failed: 0, mode: 'electron-standalone' });
  });
  server.post('/api/queue/clean-failed', (_req, res) => {
    res.json({ cleaned: 0, message: 'No-op en modo Electron standalone' });
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
      console.log(`[Electron] API embebida escuchando en http://127.0.0.1:${API_PORT}`);
      resolve();
    });
  });
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

  // Links externos → navegador del sistema
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
  // 1. Arrancar el servidor Express primero
  try {
    await startExpressServer();
  } catch (err) {
    console.error('[Electron] Error arrancando servidor Express:', err);
    // No abortamos: la UI puede mostrar estado de error de API
  }

  // 2. Abrir la ventana una vez que la API está lista
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
