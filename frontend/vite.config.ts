import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ─── Detección de modo Tauri ───────────────────────────────────────────────────
// Cuando Tauri lanza el dev server inyecta TAURI_ENV_TARGET_TRIPLE.
// En build de producción Tauri setea TAURI_ENV_TARGET_TRIPLE también.
// Usamos esto para distinguir "modo escritorio" de "modo Docker/Web".
const isTauri = !!process.env.TAURI_ENV_TARGET_TRIPLE;

export default defineConfig({
  plugins: [react()],

  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },

  // ── Servidor de desarrollo ──────────────────────────────────────────────────
  server: {
    // Tauri requiere que el host sea localhost estricto (no 0.0.0.0)
    // para acceder al devserver desde el WebView nativo.
    host: isTauri ? "localhost" : true,
    port: 5173,
    // Tauri 2.x necesita que strictPort sea true para evitar port-hopping
    // que rompería la URL hardcoded en tauri.conf.json.
    strictPort: true,
    proxy: isTauri
      ? {
          // En modo escritorio el backend corre en localhost (no Docker).
          // El usuario debe levantar la API Node localmente o apuntar a producción.
          "/api": {
            target: process.env.VITE_API_TARGET ?? "http://localhost:3000",
            changeOrigin: true,
          },
        }
      : {
          // Modo Docker: el backend es resolvible por nombre de contenedor.
          "/api": {
            target: "http://api-orchestrator:3000",
            changeOrigin: true,
          },
        },
  },

  // ── Build de producción ─────────────────────────────────────────────────────
  build: {
    // Tauri espera los assets en dist/ con rutas relativas (no absolutas).
    // outDir por defecto ya es 'dist', lo dejamos explícito.
    outDir: "dist",
    // Rutas relativas para que el WebView de Tauri cargue los assets
    // desde el sistema de ficheros sin servidor HTTP.
    assetsDir: "assets",
    // Tauri no soporta ES modules en el WebView de Windows por defecto.
    // target 'es2021' es el mínimo compatible con Chromium embebido (WebView2).
    target: ["es2021", "chrome100", "safari13"],
    // sourcemaps en dev desktop, desactivado en release para reducir tamaño del .exe
    sourcemap: isTauri && process.env.NODE_ENV !== "production",
    // Separar chunks grandes: recharts es la dependencia más pesada (~300KB)
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ["react", "react-dom"],
          recharts: ["recharts"],
        },
      },
    },
  },

  // ── Variables de entorno expuestas al frontend ──────────────────────────────
  // VITE_APP_MODE permite que el código React detecte si corre como desktop app.
  define: {
    __TAURI_MODE__: JSON.stringify(isTauri),
  },
});
