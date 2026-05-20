# WPO Engine — Decisiones de Arquitectura (ADR)

> Registro de las decisiones técnicas principales que han dado forma al sistema. Cada entrada documenta el contexto, la alternativa elegida y el razonamiento que la justifica.

---

## ADR-001 — Migración de Monolito a SPA (v1.1)

**Contexto:** El Dashboard inicial renderizaba todos los registros de la base de datos en una única vista monolítica. El sorting del lado del cliente congestionaba el DOM con cientos de filas y la ausencia de enrutamiento impedía enlazar directamente a una vista concreta.

**Decisión:** Migrar a Single Page Application con React/Vite y un componente `TopBar` global que gestiona la vista activa como estado.

**Consecuencias:**
- Cuatro vistas independientes: Dashboard, Site Explorer, Automations, Reports.
- El estado de navegación se sincroniza con la URL del navegador (`window.history.pushState`) permitiendo bookmarks y el botón Atrás.
- El HUD de cola reside en `TopBar` y persiste en todas las vistas.

---

## ADR-002 — Cola de tareas en memoria vs BullMQ (v2.0.0)

**Contexto:** La v1.x usaba BullMQ con Redis para gestionar la cola de auditorías. En modo desktop (Electron), Redis no está disponible sin instalar servicios adicionales, y BullMQ falla con `ERR_MODULE_NOT_FOUND` en el proceso principal de Electron.

**Alternativas consideradas:**
1. Empaquetar Redis dentro del ejecutable Electron.
2. Usar SQLite como backend de cola.
3. Implementar una cola en memoria simple con semáforo de concurrencia.

**Decisión:** Opción 3 — cola en memoria (`array + isRunning boolean`) en `electron/auditor.ts`.

**Razonamiento:** El caso de uso desktop es monopuesto y la concurrencia máxima es 1 (una auditoría a la vez para no saturar la CPU del usuario). Una cola en memoria es suficiente, sin overhead de serialización ni dependencias externas. Si la app se cierra, los jobs pendientes se pierden — comportamiento aceptable para uso interactivo.

**Consecuencias:**
- El endpoint `GET /api/queue/status` retorna `{ waiting, active, delayed: 0, failed: 0 }` directamente desde `getQueueLength()`.
- El endpoint `POST /api/queue/clean-failed` es un no-op en modo Electron.
- Los jobs no sobreviven a un reinicio de la aplicación.

---

## ADR-003 — Chrome Launcher vs Puppeteer (v2.0.0)

**Contexto:** La v1.x usaba Puppeteer, que descarga y gestiona su propia versión de Chromium dentro del contenedor Docker. En modo desktop, Puppeteer añade ~170 MB al ejecutable y requiere una imagen base de Ubuntu.

**Decisión:** Sustituir Puppeteer por `chrome-launcher` + `lighthouse` directamente.

**Razonamiento:** `chrome-launcher` detecta y usa la instalación existente de Google Chrome en el sistema operativo. Elimina la descarga del binario de Chromium, reduce el tamaño del ejecutable y evita conflictos con la versión del SO. El requisito de "tener Chrome instalado" es aceptable para el perfil de usuario objetivo (equipos de marketing/desarrollo que ya usan Chrome).

**Consecuencias:**
- La importación `import * as chromeLauncher from 'chrome-launcher'` (namespace) es necesaria para compatibilidad CJS/ESM en el contexto de Electron. La importación `default` falla con `SyntaxError`.
- Si Chrome no está instalado, `chromeLauncher.launch()` lanza una excepción que rechaza la Promise del job auditado.

---

## ADR-004 — Ruta de SQLite en %APPDATA% (v2.0.0)

**Contexto:** En la v1.x, SQLite vivía en un volumen Docker mapeado a `./db/wpo-historics.sqlite`. En Windows, los permisos de escritura sobre volúmenes Docker en `Program Files` son problemáticos y provocaban errores `SQLITE_READONLY`.

**Decisión:** En modo Electron, `main.ts` inyecta `process.env.WPO_DB_PATH = app.getPath('userData') + '/wpo-historics.sqlite'` antes de importar cualquier módulo que abra la base de datos.

**Razonamiento:** `app.getPath('userData')` resuelve a `C:\Users\<user>\AppData\Roaming\WPO Analytics Engine\` en Windows, una ruta que siempre tiene permisos de escritura para el usuario actual. Además, aísla completamente los datos de cada instalación.

**Consecuencias:**
- El módulo `database.ts` y `automations.service.ts` leen `process.env.WPO_DB_PATH` como primera prioridad. La inyección debe ocurrir **antes** de cualquier `import` de estos módulos (por eso todos los imports de controllers son dinámicos en `main.ts`).
- Los datos de un usuario no son accesibles por otro usuario de Windows en la misma máquina.
- Desinstalar la aplicación no elimina los datos (permanecen en `%APPDATA%` hasta borrado manual).

---

## ADR-005 — Build dual Electron/Docker con Vite (v2.0.0)

**Contexto:** El mismo codebase debe compilarse en dos modos: como app Electron (proceso main + renderer) y como SPA web para Docker. Las dependencias de Electron (`vite-plugin-electron`) no están disponibles en el contenedor Docker.

**Decisión:** Detección mediante variable de entorno `ELECTRON=true` en `vite.config.ts`. El import de `vite-plugin-electron/simple` es dinámico (`await import(...)`) y solo ocurre si el flag está activo.

**Consecuencias:**
- En modo Electron, todos los imports de `main.ts` que no son rutas relativas se marcan como externos en Rollup. Node.js los resuelve desde `node_modules` en runtime.
- La variable `__ELECTRON_MODE__` se expone al renderer. `api.ts` la usa para decidir si el `API_URL` es `'http://127.0.0.1:3000'` o `''` (proxy de Vite).
- El proxy de Vite (`/api → http://api-orchestrator:3000`) solo está activo en modo Docker.

---

## ADR-006 — Eliminación de screenshot_base64 (v1.3)

**Contexto:** El worker original generaba una captura de pantalla completa de cada página auditada, la codificaba como Base64 y la almacenaba en SQLite. Las cadenas de 8–18 MB por registro provocaban errores de memoria (OOM) al serializar el historial completo a JSON para el frontend.

**Decisión:** Eliminar el almacenamiento de screenshots del flujo activo. La columna `screenshot_base64` se mantiene en el esquema SQL por compatibilidad pero se inserta siempre como `NULL`.

**Consecuencias:**
- El historial de auditorías es completamente transferible y ligero (< 1 KB por fila).
- La pestaña "Vista Previa" del SlideOver fue eliminada en la misma versión.
- Si en el futuro se requieren capturas, deberán almacenarse como archivos en disco con solo la ruta en SQLite.

---

## ADR-007 — Scoring heurístico en cliente vs score de Lighthouse (v1.0)

**Contexto:** Lighthouse genera un `performance score` propio (0-100) mediante un promedio ponderado de múltiples métricas. Este score varía entre ejecuciones por el ruido de CPU y puede resultar confuso para audiencias no técnicas.

**Decisión:** Calcular un score propio en el frontend (`calculateScore()` en `api.ts`) basado en umbrales discretos de Core Web Vitals publicados por Google.

**Razonamiento:** Los umbrales "Good/Needs Improvement/Poor" de Google son estables, públicamente documentados y directamente explicables. Un score calculado así es determinista para los mismos valores de métrica.

**Consecuencias:**
- El score que muestra la herramienta **no coincide** con el score que mostraría Lighthouse o PageSpeed Insights para la misma URL. Esto puede generar confusión si se comparan resultados.
- La fórmula del servidor (`getHistory7Days`) usa una función lineal diferente a la heurística del cliente. Son dos scores distintos para dos propósitos distintos (histórico vs estado actual).
- Ver [`docs/technical/dashboard.md`](./technical/dashboard.md) para las fórmulas exactas de ambos scores.
