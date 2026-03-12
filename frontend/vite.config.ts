import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://api-orchestrator:3000",
        changeOrigin: true,
      },
    },
  },
});
