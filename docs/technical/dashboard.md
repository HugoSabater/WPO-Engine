**Documentación técnica →** [Arquitectura](./architecture.md) · [Dashboard](./dashboard.md) · [Automations](./automations.md) · [Herramientas internas](./internal-tools.md)

---

# Dashboard — Documentación Técnica

## Responsabilidades

El `DashboardView` es la vista principal de la aplicación. Muestra el estado de salud actual de todos los sitios monitoreados, una gráfica temporal de los últimos 7 días y los 3 insights de mayor prioridad derivados de Core Web Vitals.

---

## Fuentes de Datos

Todos los datos del Dashboard se cargan en `App.tsx` y se pasan como props. El componente `DashboardView` es **puro** respecto a la red — no hace fetch por sí mismo.

### Carga inicial (`App.tsx → loadData()`)

Se ejecutan en paralelo con `Promise.all`:

```typescript
const [data, history] = await Promise.all([fetchMetrics(), fetchHistory()]);
```

| Función         | Endpoint                | Retorna                                  |
|-----------------|-------------------------|------------------------------------------|
| `fetchMetrics()`  | `GET /api/audit/metrics` | Últimos 50 registros con join de baseline |
| `fetchHistory()`  | `GET /api/audit/history` | Array de 7 puntos `{ date, avgScore, avgLcp }` |

Después de `fetchMetrics()`, el cliente aplica `calculateScore()` a cada fila para derivar un campo `score` (0-100). **Este campo no viene de la API ni de SQLite.**

### Heurística de Scoring (cliente)

```
score = 100
  − 35 si lcp > 4000 ms  (o −15 si lcp > 2500)
  − 25 si tbt > 600 ms   (o −12 si tbt > 300)
  − 20 si cls > 0.25      (o −10 si cls > 0.1)
  − 20 si ttfb > 1800 ms  (o −10 si ttfb > 800)
  clamped a [0, 100]
```

Umbrales alineados con los rangos "Poor" y "Needs Improvement" de Google Core Web Vitals.

### Historial — `getHistory7Days()` (SQLite)

```sql
SELECT
  strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date,
  AVG(lcp) as avgLcp,
  AVG(tbt) as avgTbt,
  AVG(cls) as avgCls
FROM metrics
WHERE timestamp >= (strftime('%s', 'now', '-7 days')) * 1000
GROUP BY date
ORDER BY date ASC
```

El `avgScore` se calcula en el servidor con la fórmula:

```
score = 100 − (avgTbt / 30) − (avgLcp / 150) − (avgCls * 100)
clamp(0, 100)
```

> ⚠️ Esta fórmula difiere de la heurística cliente. El servidor usa una función lineal simplificada mientras que el cliente aplica rangos por umbrales.

---

## Modos de Vista

El Dashboard tiene un toggle binario (`ViewMode`):

| Modo       | Datos mostrados                                    | Fuente                              |
|------------|---------------------------------------------------|-------------------------------------|
| `current`  | Último análisis por URL única                     | `getLatestPerSite(metrics)` (O(n) Map) |
| `last30`   | Todos los registros de los últimos 30 días         | `filterByDays(metrics, 30)`         |

El cambio de modo es **local** (sin red). Recalcula insights y tabla usando los datos ya en memoria.

`getLatestPerSite()` usa un `Map<string, MetricRow>` para conservar únicamente el registro con mayor `timestamp` por URL.

---

## Componentes Renderizados

```
DashboardView
├── AnalyzerInput          — Formulario de auditoría bajo demanda
├── ViewModeToggle         — Toggle current / last30
├── MetricsChart           — Recharts (área) con chartData (7 días)
├── PriorityCards          — 3 tarjetas de insight (LCP, TBT, CLS)
├── DataTable              — Tabla de registros con acciones inline
└── SlideOverPanel         — Drawer lateral (condicional)
    ├── Tab: business      — Traducción de impacto de negocio
    ├── Tab: technical     — Vitals numéricos
    └── Tab: rawdata       — JSON de la fila completa
```

### `AnalyzerInput`

Envia `POST /api/audit/ondemand` con `{ url, strategy }`. Al completarse, llama a `onAnalysisEnqueued()` que fuerza `prevQueueBusyRef.current = true` en `App.tsx`, preparando el polling para recargar datos cuando la cola quede vacía.

El campo `url` aplica auto-prefijo: si el valor no empieza con `http://` o `https://`, se antepone `https://`.

### Polling de Cola (HUD)

Definido en `App.tsx`, activo en **todas las vistas**:

```
setInterval(async () => {
  const status = await getQueueStatus();  // GET /api/queue/status
  // Si transición "ocupado → libre": loadData(true) silencioso
}, 3000)
```

El endpoint `/api/queue/status` en Electron retorna:

```json
{
  "waiting": <queue.length>,
  "active":  <isRunning ? 1 : 0>,
  "delayed": 0,
  "failed":  0,
  "mode":    "electron-standalone"
}
```

---

## Flujo de Insights (`buildPriorityInsights`)

Recibe el array `latestPerSite` (un registro por URL) y genera exactamente 3 insights:

| ID    | Métrica | Severidad `critical`  | Severidad `warning`  |
|-------|---------|----------------------|---------------------|
| `lcp` | LCP     | `lcp > 4000 ms`      | cualquier otro caso  |
| `tbt` | TBT     | `tbt > 600 ms`       | cualquier otro caso  |
| `cls` | CLS     | `cls > 0.25`         | cualquier otro caso  |

La URL mostrada en la descripción del insight se extrae con `new URL(row.url).pathname`.

---

## Navegación Contextual (Cross-View)

El Dashboard puede recibir una fila pre-seleccionada desde `SiteExplorerView`:

```typescript
// SiteExplorer llama:
onNavigateToDashboard(row: MetricRow)
// App.tsx:
setDashboardRow(row);
setActiveView('dashboard');
// DashboardView (useEffect):
if (initialRow) {
  setActiveRow(initialRow);
  onInitialRowConsumed();  // limpia el estado en App
}
```

Esto abre automáticamente el `SlideOverPanel` con los datos de esa fila.

---

## Estado de Error

Si `fetchMetrics()` o `fetchHistory()` fallan, `App.tsx` muestra un banner global:

```
⚠️ Falló la conexión con la API del Backend. Verifica que Docker esté corriendo.
```

> El mensaje menciona "Docker" porque el string fue definido antes de la migración a Electron. En modo desktop, el error real es que el servidor Express interno no arrancó correctamente.

Los arrays `metrics`, `insights` y `chartData` se resetean a `[]` ante cualquier fallo de red.
