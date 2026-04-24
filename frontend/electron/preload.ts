import { contextBridge, ipcRenderer } from 'electron';

// ─── API expuesta al renderer (React) ─────────────────────────────────────────
// Solo exponemos lo estrictamente necesario.
// El renderer NO tiene acceso a Node.js ni a la API completa de Electron.
contextBridge.exposeInMainWorld('electronAPI', {
  /** Versión de la plataforma: 'electron' | 'web' */
  platform: 'electron' as const,

  /** Abre una URL externa en el navegador del sistema */
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  /** Versión de Electron (útil para debugging) */
  versions: {
    electron: process.versions.electron,
    node:     process.versions.node,
    chrome:   process.versions.chrome,
  },
});
