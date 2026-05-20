**Documentación técnica →** [Arquitectura](./architecture.md) · [Dashboard](./dashboard.md) · [Automations](./automations.md) · [Herramientas internas](./internal-tools.md)

---

# Herramientas Internas — Documentación Técnica

## Índice de Scripts y Utilidades

| Módulo / Script                   | Ubicación                                          | Propósito                                         |
|-----------------------------------|----------------------------------------------------|---------------------------------------------------|
| `auditor.ts`                      | `frontend/electron/auditor.ts`                     | Motor de cola + ejecución de Lighthouse           |
| `database.ts`                     | `api/src/models/database.ts`                       | Inicialización de SQLite y métodos de acceso      |
| `automations.service.ts`          | `api/src/services/automations.service.ts`          | CRUD de cronjobs y alertas                        |
| `crawler.controller.ts`           | `api/src/controllers/crawler.controller.ts`        | Extracción de URLs internas con Cheerio           |
| `api.ts` (helpers de cliente)     | `frontend/src/services/api.ts`                     | Funciones de transformación y scoring en cliente  |
| `vite.config.ts`                  | `frontend/vite.config.ts`                          | Configuración dual (Electron / Docker)            |
| `make:win` (npm script)           | `frontend/package.json`                            | Empaquetado del instalador NSIS para Windows      |

---

## `auditor.ts` — Cola Interna de Lighthouse

Referencia completa en [`architecture.md`](./architecture.md#capa-de-auditoría-electronauditorts).

### Funciones exportadas

#### `enqueueAudit(url, strategy?)`

```typescript
function enqueueAudit(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<AuditMetrics>
```

- Empuja el job a `queue[]`.
- Llama a `processNext()` inmediatamente.
- Si `isRunning === true`, el job queda en cola y se procesará en cadena vía `setImmediate(processNext)` al terminar el anterior.
- Si Lighthouse falla, rechaza la Promise con el error original. El error se propaga al llamador (`main.ts` lo captura con `.catch()`).

#### `getQueueLength()`

```typescript
function getQueueLength(): number
// Retorna: queue.length + (isRunning ? 1 : 0)
```

Usado por `GET /api/queue/status` en `main.ts` para el HUD del frontend.

### Configuración de Chrome

```typescript
chromeLauncher.launch({
  chromeFlags: [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ]
})
```

Requiere Google Chrome instalado en el sistema operativo. No descarga ni empaqueta Chromium. Si Chrome no se encuentra, `chromeLauncher.launch()` lanza una excepción que rechaza la Promise del job.

---

## `database.ts` — Modelo de Datos SQLite

### Resolución de Ruta

```typescript
function resolveDbPath(): string {
    if (process.env.WPO_DB_PATH) return process.env.WPO_DB_PATH;   // Electron
    if (process.env.NODE_ENV === 'development') return resolve(__dirname, '../../wpo-historics.sqlite');
    return '/app/db/wpo-historics.sqlite';  // Docker
}
```

### Métodos de la Clase `Database`

| Método                | Parámetros       | Retorna             | SQL base                                      |
|-----------------------|------------------|---------------------|-----------------------------------------------|
| `insertMetric(metric)`| `any`            | `Promise<void>`     | `INSERT INTO metrics ...`                     |
| `getMetrics()`        | —                | `Promise<any[]>`    | SELECT últimos 50 con LEFT JOIN baseline      |
| `getAllMetrics()`      | —                | `Promise<any[]>`    | SELECT todos sin límite con LEFT JOIN baseline |
| `getHistory7Days()`   | —                | `Promise<ChartDataPoint[]>` | AVG agrupado por día, últimos 7 días  |
| `setBaseline(id)`     | `number`         | `Promise<void>`     | UPDATE doble: desmarca anteriores, marca nuevo |
| `deleteMetric(id)`    | `number`         | `Promise<void>`     | DELETE con verificación de `this.changes`     |
| `getUniqueUrls()`     | —                | `Promise<string[]>` | SELECT DISTINCT url                           |

#### `setBaseline(id)` — Lógica Transaccional

```sql
-- Paso 1: Desmarcar todos los baselines de esa URL
UPDATE metrics SET is_baseline = 0 WHERE url = (SELECT url FROM metrics WHERE id = ?)

-- Paso 2: Marcar el nuevo baseline
UPDATE metrics SET is_baseline = 1 WHERE id = ?
```

Ambas sentencias se ejecutan en `db.serialize()` para garantizar orden secuencial. Si el `id` no existe en el paso 1 (`SELECT url ... WHERE id = ?` devuelve null), rechaza con `Error("URL no encontrada para ese ID")`.

#### `getMetrics()` — Query Completo

```sql
SELECT
    m.*,
    b.lcp  as baseline_lcp,
    b.ttfb as baseline_ttfb,
    b.tbt  as baseline_tbt,
    b.cls  as baseline_cls
FROM metrics m
LEFT JOIN metrics b ON m.url = b.url AND b.is_baseline = 1
ORDER BY m.timestamp DESC
LIMIT 50
```

---

## `crawler.controller.ts` — Web Crawler con Cheerio

### Endpoint

```
GET /api/crawl?url=<URL>&limit=<N>
```

| Query param | Tipo   | Default | Máximo | Descripción                          |
|-------------|--------|---------|--------|--------------------------------------|
| `url`       | string | —       | —      | URL raíz a rastrear (requerida)      |
| `limit`     | number | `10`    | `50`   | Número máximo de URLs a devolver     |

### Respuesta exitosa (`200`)

```json
{
  "base": "https://tutienda.com",
  "total": 8,
  "urls": [
    "https://tutienda.com/productos",
    "https://tutienda.com/contacto",
    "..."
  ]
}
```

### Errores

| Código | Condición                                      |
|--------|------------------------------------------------|
| `400`  | `url` ausente o no parseable con `new URL()`   |
| `502`  | La URL objetivo respondió con status no-2xx    |
| `502`  | Timeout de 15 segundos agotado (`AbortController`) |
| `502`  | Error de red en `fetch()`                      |

### Lógica de Filtrado

1. **Fetch** del HTML con User-Agent: `WPO-Engine-Crawler/2.0`.
2. **Cheerio** parsea `$('a[href]')`.
3. Descarta hrefs que empiecen con `#`, `mailto:`, `tel:`, `javascript:`.
4. Resuelve rutas relativas con `new URL(href, base.origin)`.
5. Filtra por `resolved.hostname === base.hostname` (mismo dominio exacto, sin subdominios cruzados).
6. Aplica blocklist de redes sociales:

```typescript
const SOCIAL_BLOCKLIST = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
  'whatsapp.com', 't.me', 'telegram.me',
];
```

7. Normaliza: elimina fragmentos (`resolved.hash = ''`) y trailing slash.
8. Acumula en un `Set<string>` para deduplicación. Sale del `each()` cuando `found.size >= limit`.

---

## `api.ts` — Utilidades de Cliente

### Funciones de Transformación (sin red)

#### `calculateScore(row: MetricRow): number`

Heurística local. **No llama a ningún endpoint.** Se aplica en `fetchMetrics()` y `fetchAllMetrics()` tras recibir los datos de la API.

```
score = 100
  LCP:  > 4000 → −35  |  > 2500 → −15
  TBT:  > 600  → −25  |  > 300  → −12
  CLS:  > 0.25 → −20  |  > 0.1  → −10
  TTFB: > 1800 → −20  |  > 800  → −10
  resultado = max(0, score)
```

#### `getLatestPerSite(metrics: MetricRow[]): MetricRow[]`

Complejidad O(n). Usa `Map<url, MetricRow>` para retener solo el registro con mayor `timestamp` por URL.

#### `filterByDays(metrics: MetricRow[], days = 30): MetricRow[]`

```typescript
const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
return metrics.filter(r => r.timestamp >= cutoff);
```

#### `buildPriorityInsights(metrics: MetricRow[]): PriorityInsight[]`

Genera exactamente 3 insights (LCP, TBT, CLS) ordenando los registros por valor descendente para cada métrica. Retorna `[]` si `metrics` está vacío.

#### `buildFallbackChartData(metrics: MetricRow[]): ChartDataPoint[]`

Genera 7 puntos de datos (un punto por día, últimos 7 días) calculando promedios locales. Se usa como fallback cuando `fetchHistory()` falla o devuelve datos vacíos.

---

## `vite.config.ts` — Build Dual

### Variable de entorno `ELECTRON`

| Valor             | Comportamiento                                              |
|-------------------|-------------------------------------------------------------|
| `"true"`          | Activa `vite-plugin-electron`, compila `main.ts` y `preload.ts`, define `__ELECTRON_MODE__ = true` |
| Ausente / otro    | Build estándar para navegador/Docker, proxy `/api` activo  |

### Plugin de Electron — Configuración de `rollupOptions`

```typescript
external: (id) => !id.startsWith('.') && !id.startsWith('/') && !/^[A-Za-z]:[/\\](?!.*node_modules)/.test(id)
```

Esta función marca como externos **todos los imports que no son rutas relativas o absolutas de Windows**. Incluye: `electron`, `express`, `sqlite3`, `cheerio`, `chrome-launcher`, `lighthouse`, `cron`, etc. El bundle del proceso principal contiene solo el código de la aplicación; las dependencias se resuelven desde `node_modules` en runtime.

### Script `make:win`

```bash
cross-env ELECTRON=true CSC_IDENTITY_AUTO_DISCOVERY=false vite build \
  && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win
```

- `CSC_IDENTITY_AUTO_DISCOVERY=false` — Deshabilita la búsqueda de certificados de firma de código (Code Signing). Necesario para builds de distribución interna sin certificado EV.
- `electron-builder` genera el instalador NSIS en la ruta configurada en `package.json` (`build.directories.output`), actualmente apuntando a `C:\WPO-Build\release`.
- `sqlite3` se recompila desde fuentes para la versión N-API de Electron durante el build (etapa `rebuilding native dependencies`).
- Los directorios `frontend/dist-electron/` y `frontend/release/` están en `.gitignore` y no se versionan.
