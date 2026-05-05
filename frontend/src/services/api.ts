import type { MetricRow, PriorityInsight, ChartDataPoint } from '../types';

// Usamos ruta relativa para que el proxy de Vite gestione el CORS internamente.
// En producción en Electron (file://), el Frontend debe apuntar directamente al puerto 3000.
// @ts-ignore
export const API_URL = (typeof __ELECTRON_MODE__ !== 'undefined' && __ELECTRON_MODE__) ? 'http://127.0.0.1:3000' : '';

export interface QueueStatus {
  waiting: number;
  active:  number;
  delayed: number;
  failed:  number;
}

/**
 * Snapshot de contadores vitales de BullMQ.
 * Usado por el polling de 3s en App.tsx para el HUD parpadeante.
 */
export async function getQueueStatus(): Promise<QueueStatus> {
  const res = await fetch(`${API_URL}/api/queue/status`);
  if (!res.ok) throw new Error(`Queue status error: ${res.status}`);
  return res.json() as Promise<QueueStatus>;
}

/**
 * Encola un análisis WPO On-Demand en el Backend.
 */
export async function enqueueAudit(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/audit/ondemand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, strategy })
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error encolando URL: ${res.status}`);
  }
  return true;
}

/**
 * Fija una captura como Baseline.
 */
export async function setBaseline(id: number): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/audit/baseline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error(`Error fijando baseline: ${res.status}`);
  return true;
}

/**
 * Elimina un registro guardado en SQLite.
 */
export async function deleteAudit(id: number): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/audit/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Error al eliminar auditoría: ${res.status}`);
  return true;
}

/**
 * Obtiene las métricas de la base de datos SQLite vía API.
 */
export async function fetchMetrics(): Promise<MetricRow[]> {
  const res = await fetch(`${API_URL}/api/audit/metrics`);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const json = await res.json();
  // Calcular score básico en cliente (basado en LCP y TBT principalmente)
  return json.data.map((row: MetricRow) => ({
    ...row,
    score: calculateScore(row),
  }));
}

/**
 * Historial completo sin límite — usado por el módulo Reports para CSV fidedigno.
 * Aplica el mismo scoring heurístico que fetchMetrics.
 */
export async function fetchAllMetrics(): Promise<MetricRow[]> {
  const res = await fetch(`${API_URL}/api/audit/all`);
  if (!res.ok) throw new Error(`API Error (all): ${res.status}`);
  const json = await res.json();
  return json.data.map((row: MetricRow) => ({
    ...row,
    score: calculateScore(row),
  }));
}

/**
 * Heurística de scoring simplificada para MVP (0-100).
 * Basada en los umbrales de Core Web Vitals de Google.
 */
function calculateScore(row: MetricRow): number {
  let score = 100;
  if (row.lcp > 4000) score -= 35;
  else if (row.lcp > 2500) score -= 15;
  if (row.tbt > 600) score -= 25;
  else if (row.tbt > 300) score -= 12;
  if (row.cls > 0.25) score -= 20;
  else if (row.cls > 0.1) score -= 10;
  if (row.ttfb > 1800) score -= 20;
  else if (row.ttfb > 800) score -= 10;
  return Math.max(0, score);
}

/**
 * Devuelve SOLO el último registro por URL única.
 * Es el conjunto correcto para el Dashboard de "Estado de Salud Actual".
 * O(n) usando un Map: conserva el registro con mayor timestamp por URL.
 */
export function getLatestPerSite(metrics: MetricRow[]): MetricRow[] {
  const latest = new Map<string, MetricRow>();
  for (const row of metrics) {
    const existing = latest.get(row.url);
    if (!existing || row.timestamp > existing.timestamp) {
      latest.set(row.url, row);
    }
  }
  return Array.from(latest.values());
}

/**
 * Filtra registros de los últimos N días (por defecto 30).
 * Usado por el toggle temporal del Dashboard.
 */
export function filterByDays(metrics: MetricRow[], days = 30): MetricRow[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return metrics.filter(r => r.timestamp >= cutoff);
}

/**
 * Genera los 3 Insights críticos a partir de los datos reales.
 * Debe recibir el conjunto ya filtrado (latestPerSite o filtro temporal).
 */
export function buildPriorityInsights(metrics: MetricRow[]): PriorityInsight[] {
  if (!metrics.length) return [];

  const worstLcp = [...metrics].sort((a, b) => b.lcp - a.lcp)[0];
  const worstTbt = [...metrics].sort((a, b) => b.tbt - a.tbt)[0];
  const worstCls = [...metrics].sort((a, b) => b.cls - a.cls)[0];

  return [
    {
      id: 'lcp',
      severity: worstLcp.lcp > 4000 ? 'critical' : 'warning',
      title: 'LCP Crítico Detectado',
      metric: 'Largest Contentful Paint',
      value: `${(worstLcp.lcp / 1000).toFixed(2)}s`,
      description: `La página ${new URL(worstLcp.url).pathname} supera el umbral "Pobre" de Google. Impacto directo en conversiones WooCommerce.`,
    },
    {
      id: 'tbt',
      severity: worstTbt.tbt > 600 ? 'critical' : 'warning',
      title: 'Hilo Principal Bloqueado',
      metric: 'Total Blocking Time',
      value: `${worstTbt.tbt.toFixed(0)}ms`,
      description: `JavaScript de terceros (plugins de Elementor/WooCommerce) bloquea la interactividad durante ${worstTbt.tbt.toFixed(0)}ms.`,
    },
    {
      id: 'cls',
      severity: worstCls.cls > 0.25 ? 'critical' : 'warning',
      title: 'Inestabilidad Visual (CLS)',
      metric: 'Cumulative Layout Shift',
      value: worstCls.cls.toFixed(3),
      description: `Imágenes sin dimensiones fijas o banners publicitarios tardíos provocan saltos de diseño que dañan la experiencia de compra.`,
    },
  ];
}

/**
 * Obtiene el historial (Time-Series) de los últimos 7 días.
 */
export async function fetchHistory(): Promise<ChartDataPoint[]> {
  const res = await fetch(`${API_URL}/api/audit/history`);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const json = await res.json();
  
  return json.data.map((row: any) => {
    // Evitamos desfase de zonas horarias forzando mediodía UTC
    const d = new Date(row.date + 'T12:00:00Z');
    return {
      date: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      performanceScore: row.avgScore,
      lcp: Math.round(row.avgLcp)
    };
  });
}

// ─── Automations API ──────────────────────────────────────────────────────────

export type Strategy    = 'mobile' | 'desktop';
export type AlertDevice = 'mobile' | 'desktop' | 'both';
export type AlertMetric = 'score' | 'lcp' | 'ttfb' | 'cls' | 'tbt';

export interface CronJobRow {
  id:              number;
  url:             string;
  strategy:        Strategy;
  cron_expression: string;
  active:          boolean;     // 0 | 1 en SQLite, el servicio lo normaliza a boolean
  last_run:        string | null;
}

export interface AlertRow {
  id:         number;
  email:      string;
  device:     AlertDevice;
  thresholds: Record<AlertMetric, number>;
}

/** GET /api/cronjobs */
export async function getCronjobs(): Promise<CronJobRow[]> {
  const res = await fetch(`${API_URL}/api/cronjobs`);
  if (!res.ok) throw new Error(`[getCronjobs] ${res.status}`);
  const json = await res.json();
  return json.data as CronJobRow[];
}

/** POST /api/cronjobs — payload: { url, strategy, cron_expression } */
export async function createCronjob(payload: {
  url:             string;
  strategy:        Strategy;
  cron_expression: string;
}): Promise<CronJobRow> {
  const res = await fetch(`${API_URL}/api/cronjobs`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `[createCronjob] ${res.status}`);
  }
  const json = await res.json();
  return json.data as CronJobRow;
}

/** PATCH /api/cronjobs/:id/toggle — payload: { active: boolean } */
export async function toggleCronjob(id: number, active: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/api/cronjobs/${id}/toggle`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ active }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `[toggleCronjob] ${res.status}`);
  }
}

/** DELETE /api/cronjobs/:id */
export async function deleteCronjob(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/cronjobs/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `[deleteCronjob] ${res.status}`);
  }
}

/** GET /api/alerts */
export async function getAlerts(): Promise<AlertRow[]> {
  const res = await fetch(`${API_URL}/api/alerts`);
  if (!res.ok) throw new Error(`[getAlerts] ${res.status}`);
  const json = await res.json();
  return json.data as AlertRow[];
}

/** POST /api/alerts — thresholds deben ser números (el backend valida typeof v !== 'number') */
export async function createAlert(payload: {
  email:      string;
  device:     AlertDevice;
  thresholds: Record<AlertMetric, number>;
}): Promise<AlertRow> {
  const res = await fetch(`${API_URL}/api/alerts`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `[createAlert] ${res.status}`);
  }
  const json = await res.json();
  return json.data as AlertRow;
}

/** DELETE /api/alerts/:id */
export async function deleteAlert(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/alerts/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `[deleteAlert] ${res.status}`);
  }
}

/**
 * Genera datos dummy de gráfica si la API falla o está vacía.
 */
export function buildFallbackChartData(metrics: MetricRow[]): ChartDataPoint[] {
  const now = Date.now();
  const days: ChartDataPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayMetrics = metrics.filter(m => m.timestamp >= dayStart && m.timestamp < dayEnd);
    const date = new Date(dayStart).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

    if (dayMetrics.length > 0) {
      const avgLcp = dayMetrics.reduce((a, b) => a + b.lcp, 0) / dayMetrics.length;
      const avgScore = dayMetrics.reduce((a, b) => a + (b.score || 0), 0) / dayMetrics.length;
      days.push({ date, performanceScore: Math.round(avgScore), lcp: Math.round(avgLcp) });
    } else {
      days.push({ date, performanceScore: 0, lcp: 0 });
    }
  }
  return days;
}
