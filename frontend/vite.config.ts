import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// ─── Detección de modo ────────────────────────────────────────────────────────
// ELECTRON=true → modo escritorio (Electron + vite-plugin-electron)
// Sin la variable → modo web puro (Docker / navegador directo)
const isElectron = process.env.ELECTRON === 'true';

export default defineConfig(async () => {
  // ── Plugin Electron (solo en modo escritorio) ────────────────────────────
  // CRÍTICO: el import es dinámico para que Docker no falle al no tener
  // vite-plugin-electron instalado en el contenedor (es devDependency local).
  const electronPlugins: Plugin[] = [];
  if (isElectron) {
    const { default: electron } = await import('vite-plugin-electron/simple');

    electronPlugins.push(
      electron({
        main: {
          entry: 'electron/main.ts',
          onstart(args) {
            args.startup();
          },
          vite: {
            build: {
              sourcemap: false,
              minify: false,
              // No intentar bundlear: dejar todo como require() externo en CJS
              // para que Node.js resuelva los módulos en runtime
              lib: {
                entry: 'electron/main.ts',
                formats: ['es'],
              },
              rollupOptions: {
                // Tratar TODOS los imports que no son rutas relativas como externos.
                // Esto incluye: electron, express, cheerio, sqlite3, etc.
                // El proceso main corre en Node.js real y los resuelve desde node_modules.
                external: (id) => !id.startsWith('.') && !id.startsWith('/') && !/^[A-Za-z]:[/\\](?!.*node_modules)/.test(id),
                output: {
                  format: 'es',
                  entryFileNames: '[name].mjs',
                },
              },
            },
          },
        },
        preload: { input: 'electron/preload.ts' },
        renderer: {},
      })
    );
  }

  return {
    plugins: [react(), ...electronPlugins],

    // ── Servidor de desarrollo ──────────────────────────────────────────────
    server: {
      host:       true,
      port:       5173,
      strictPort: true,
      proxy: {
        '/api': {
          // Docker → nombre de contenedor; Electron local → localhost:3000
          target:       process.env.VITE_API_TARGET ?? 'http://api-orchestrator:3000',
          changeOrigin: true,
        },
      },
    },

    // ── Build de producción ─────────────────────────────────────────────────
    build: {
      outDir:    'dist',
      assetsDir: 'assets',
      target:    ['es2022', 'chrome120'],
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

    // ── Variables de entorno expuestas al renderer ──────────────────────────
    define: {
      __ELECTRON_MODE__: JSON.stringify(isElectron),
    },
  };
});
