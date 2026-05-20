# Changelog — WPO Analytics Engine

Todas las versiones se documentan aquí siguiendo el formato [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [2.0.0] — Mayo 2026 — Desktop Edition

### Resumen del sprint
Migración completa de la arquitectura Docker (4 contenedores) a una aplicación de escritorio autocontenida distribuible como instalador `.exe` para Windows.

### Añadido
- **Electron Shell:** El sistema completo (frontend + backend + base de datos) se empaqueta en un único ejecutable con instalador NSIS.
- **Web Crawler (`/api/crawl`):** Nuevo endpoint que descarga el HTML de una URL raíz, extrae todos los enlaces internos con Cheerio y los devuelve filtrados (excluye redes sociales, anclas, `mailto:`, `tel:`). Límite configurable hasta 50 URLs.
- **Auditorías en lote (`POST /api/audit/batch`):** Acepta hasta 50 URLs en una sola petición y las encola para procesamiento secuencial.
- **Rastrear y Auditar:** Integración en Site Explorer que combina el crawler con el encolador para auditar un sitio completo con un solo clic.
- **Filtros en Reports:** Búsqueda por URL en tiempo real y filtro por estado de salud (Todas / Críticas / Mejorables / Óptimas).
- **Navegación contextual:** Desde Reports se puede crear una automatización para cualquier URL; desde Site Explorer se puede abrir el detalle en Dashboard o filtrar en Reports.
- **Documentación técnica:** Directorio `docs/technical/` con cuatro archivos que documentan arquitectura, dashboard, automations y herramientas internas basados en el código fuente real.
- **Manual de colores (`docs/manual-colores.md`):** Guía para perfiles de gerencia y marketing sin conocimientos técnicos.

### Cambiado
- **Motor de auditoría:** Sustituido `puppeteer` (requería Ubuntu en Docker) por `chrome-launcher` que usa el Chrome nativo del sistema operativo. Menor consumo de memoria.
- **Sistema de cola:** Eliminada la dependencia de BullMQ y Redis. Implementada cola interna en memoria (array + semáforo de concurrencia máxima 1) en `auditor.ts`.
- **Scheduler de crons:** Sustituida la cola BullMQ repeatable por `node-cron` (`CronJob.from()`) con zona horaria `Europe/Madrid`.
- **Ruta de SQLite:** En lugar del volumen Docker (`/app/db/`), la base de datos se almacena en `%APPDATA%\WPO Analytics Engine\wpo-historics.sqlite` (perfil del usuario de Windows).
- **API URL en frontend:** La constante `API_URL` detecta el flag `__ELECTRON_MODE__` en tiempo de compilación y apunta a `http://127.0.0.1:3000` en lugar de usar rutas relativas (que fallan en protocolo `file://`).
- **Placeholders de UI:** Sustituidos `https://example.com`, `floressolidarias.org` y `marketing@floressolidarias.org` por valores genéricos (`tutienda.com`, `alertas@tutienda.com`) para distribución como herramienta de agencia.
- **README:** Reescrito completamente. Eliminadas referencias a Docker, BullMQ y Puppeteer.

### Corregido
- `ERR_MODULE_NOT_FOUND` al arrancar la app empaquetada: la importación de `QueueService` (dependiente de BullMQ) se convirtió a dinámica (`await import()`), evitando que el entorno Electron intente resolver una dependencia de servidor inexistente.
- `SyntaxError: does not provide an export named 'default'` en `chrome-launcher`: cambiada la importación de `import chromeLauncher from 'chrome-launcher'` a `import * as chromeLauncher from 'chrome-launcher'` para compatibilidad CJS/ESM en el contexto de Electron.
- `Failed to fetch` en el Web Crawler desde el ejecutable: las funciones `crawlUrl` y `enqueueBatch` en `SiteExplorerView` ahora usan `API_URL` exportado en lugar de rutas relativas vacías.

### Eliminado
- Contenedores Docker: `api-orchestrator`, `lighthouse-worker`, `redis-queue`, `frontend` (Docker).
- Dependencias: `bullmq`, `puppeteer`, `ioredis`.
- Archivos de documentación obsoletos: `Commit_Preparation.md`, `WPO_Architecture_And_Operation_Manual.md`, `WPO_Backend_Architecture.md`, `WPO_Roadmap.md`.

---

## [1.x] — Enero–Abril 2026 — Docker Edition

### Arquitectura
Sistema de microservicios orquestado con Docker Compose:

| Contenedor | Stack |
|------------|-------|
| `frontend` | React + Vite + Tailwind CSS |
| `api-orchestrator` | Node.js + Express + BullMQ + SQLite |
| `lighthouse-worker` | Ubuntu + Puppeteer + Google Lighthouse |
| `redis-queue` | Redis 7 Alpine |

### Hitos destacados de la v1.x

- **v1.0 — Monolito inicial:** Dashboard monolítico con tabla única. El usuario recargaba la página para ver resultados.
- **v1.1 — Refactoring SPA:** Migración a arquitectura Single Page Application con `TopBar` global y cuatro vistas independientes: Dashboard, Site Explorer, Automations, Reports.
- **v1.2 — HUD de cola en tiempo real:** Polling activo cada 3 segundos a `/api/queue/status`. Cuando la cola pasa de ocupada a vacía, los datos se recargan silenciosamente sin intervención del usuario.
- **v1.3 — Purga de Base64:** Eliminada la columna `screenshot_base64` del flujo activo. Las capturas de pantalla (que pesaban hasta 18 MB por registro) provocaban OOM en el servidor al serializar el historial a JSON. La columna se mantiene en el esquema como `NULL` por compatibilidad.
- **v1.4 — Sistema de Baseline:** Posibilidad de marcar una auditoría como línea de referencia. Las siguientes auditorías muestran el delta (+/-) respecto a esa baseline.
- **v1.5 — Automations:** Módulo completo de cron jobs y alertas con umbrales configurables por métrica.

### Decisiones de arquitectura revertidas en v2.0

| Decisión v1 | Motivo de revertir |
|-------------|-------------------|
| BullMQ + Redis para cola | Innecesario en uso monopuesto; añade 2 contenedores de fricción |
| Puppeteer en Ubuntu | Requiere imagen Docker de 800 MB; `chrome-launcher` es equivalente en desktop |
| Volúmenes Docker para SQLite | Los permisos de escritura en Windows son problemáticos; `%APPDATA%` resuelve esto nativamente |
| Screenshot en Base64 en BD | Causa OOM con historial largo; eliminado definitivamente |
