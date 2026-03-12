import type { MetricRow, PriorityInsight, ChartDataPoint } from '../types';

// Usamos ruta relativa para que el proxy de Vite gestione el CORS internamente.
// vite.config.ts redirige /api → http://localhost:3000
const API_URL = '';

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
 * Genera los 3 Insights críticos a partir de los datos reales.
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
