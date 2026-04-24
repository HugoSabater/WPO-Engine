import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

// ─── Detección de modo ────────────────────────────────────────────────────────
// En modo web puro (Docker/navegador) no lanzamos Electron.
const isElectron = process.env.ELECTRON === 'true';

export default defineConfig({
  plugins: [
    react(),

    // Solo activar el plugin cuando se lanza como app de escritorio
    ...(isElectron
      ? [
          electron({
            main: {
              // Punto de entrada del proceso principal
              entry: 'electron/main.ts',
            },
            preload: {
              // Compilado junto al main y referenciado desde BrowserWindow
              input: 'electron/preload.ts',
            },
            // El renderer puede usar módulos de Node.js si es necesario
            renderer: {},
          }),
        ]
      : []),
  ],

  // ── Servidor de desarrollo ──────────────────────────────────────────────────
  server: {
    host:       true,
    port:       5173,
    strictPort: true,
    proxy: {
      // Modo Docker: el backend es resolvible por nombre de contenedor.
      // En modo Electron local la API corre en localhost:3000.
      '/api': {
        target:       process.env.VITE_API_TARGET ?? 'http://api-orchestrator:3000',
        changeOrigin: true,
      },
    },
  },

  // ── Build de producción ─────────────────────────────────────────────────────
  build: {
    outDir:    'dist',
    assetsDir: 'assets',
    // Electron usa Chromium reciente — podemos apuntar alto
    target: ['es2022', 'chrome120'],
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom'],
          recharts: ['recharts'],
        },
      },
    },
  },

  // ── Variables de entorno expuestas al renderer ──────────────────────────────
  define: {
    __ELECTRON_MODE__: JSON.stringify(isElectron),
  },
});
