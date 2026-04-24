import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ─── Rutas ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dist-electron/main.js  →  dist/index.html
const DIST_PATH      = path.join(__dirname, '../dist');
const VITE_DEV_URL   = process.env.VITE_DEV_SERVER_URL;    // inyectado por vite-plugin-electron

// ─── Ventana principal ────────────────────────────────────────────────────────
let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    title:           'WPO Analytics Engine',
    width:           1280,
    height:          800,
    minWidth:        1024,
    minHeight:       640,
    center:          true,
    // Frame oscuro coherente con el diseño charcoal de la SPA
    backgroundColor: '#0a0a0f',
    webPreferences: {
      // preload.ts compilado junto al main
      preload:           path.join(__dirname, 'preload.mjs'),
      // Contexto aislado: el renderer NO tiene acceso a Node.js directamente
      contextIsolation:  true,
      nodeIntegration:   false,
    },
  });

  // Abrir enlaces externos en el navegador del sistema, no en Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // ── Carga de la SPA ─────────────────────────────────────────────────────────
  if (VITE_DEV_URL) {
    // Modo desarrollo: apunta al dev server de Vite (hot-reload)
    win.loadURL(VITE_DEV_URL);
    win.webContents.openDevTools();
  } else {
    // Modo producción: carga el HTML compilado desde disco
    win.loadFile(path.join(DIST_PATH, 'index.html'));
  }
}

// ─── Ciclo de vida ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

// macOS: recrear ventana si se cierra pero la app sigue activa
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Windows / Linux: cerrar la app cuando se cierra la última ventana
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
