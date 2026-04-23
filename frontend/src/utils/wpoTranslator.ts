import { MetricRow } from '../types';

export interface WpoInsight {
  title: string;
  metricValue: string;
  type: 'TBT' | 'LCP' | 'TTFB';
  businessImpact: string;
  technicalSolution: string;
}

export interface WpoTranslationResult {
  insights: WpoInsight[];
  isPerfect: boolean;
}

export function translateMetrics(metrics: MetricRow): WpoTranslationResult {
  const insights: WpoInsight[] = [];

  // 1. TBT
  if (metrics.tbt > 600) {
    insights.push({
      title: 'TBT Crítico (Total Blocking Time)',
      metricValue: `${metrics.tbt.toFixed(0)} ms`,
      type: 'TBT',
      businessImpact: "La página se congela mientras carga. Los clientes que intenten hacer clic en 'Añadir al carrito' o hacer scroll sentirán que la web está rota, aumentando la tasa de abandono.",
      technicalSolution: "Bloqueo severo del Main Thread. En WooCommerce esto suele deberse a la carga síncrona de jQuery, Tag Manager o el Meta Pixel. Acción: Mover scripts de rastreo a GTM y aplicar defer a los JS de plugins no críticos."
    });
  }

  // 2. LCP
  if (metrics.lcp > 2500) {
    insights.push({
      title: 'LCP Lento (Largest Contentful Paint)',
      metricValue: `${(metrics.lcp / 1000).toFixed(2)} s`,
      type: 'LCP',
      businessImpact: "La imagen o texto principal tarda demasiado en aparecer. Según datos de Google, esto reduce la conversión móvil hasta en un 20%.",
      technicalSolution: "El renderizado principal está bloqueado. Acción: Pre-cargar (preload) la imagen hero/producto principal, excluirla del Lazy Load nativo de WP y asegurar que el CSS crítico esté inline."
    });
  }

  // 3. TTFB
  if (metrics.ttfb > 600) {
    insights.push({
      title: 'TTFB Alto (Time to First Byte)',
      metricValue: `${metrics.ttfb.toFixed(0)} ms`,
      type: 'TTFB',
      businessImpact: "El servidor tarda mucho en responder. La web se percibe lenta incluso con conexiones 5G o fibra.",
      technicalSolution: "Cuello de botella en PHP/MySQL. Acción: Validar exclusiones de WP Rocket. Si es una página de producto, evaluar la integración de Redis Object Cache para aliviar consultas a la tabla wp_options."
    });
  }

  return {
    insights,
    isPerfect: insights.length === 0
  };
}

// ─── Cron Translator ──────────────────────────────────────────────────────────

const DAYS_ES = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];

/**
 * Convierte una expresión cron a texto legible en español.
 *
 * Patrones soportados:
 *  `0 H * * *`    → Diario (HH:00)
 *  `0 H * * D`    → Semanal — Nombre_día (HH:00)
 *  `0 H D * *`    → Mensual — Día D (HH:00)
 *  `0 H * * 1-5`  → Días laborables (HH:00)
 *  `0 H * * 0,6`  → Fines de semana (HH:00)
 *  Cualquier otro → Personalizada: [expr]
 */
export function translateCron(cron: string): string {
  if (!cron?.trim()) return '—';

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return `Personalizada: ${cron}`;

  const [min, hour, dom, month, dow] = parts;

  if (!/^\d+$/.test(min) || month !== '*') return `Personalizada: ${cron}`;

  const hourNum = parseInt(hour, 10);
  const isValidHour = /^\d+$/.test(hour) && hourNum >= 0 && hourNum <= 23;
  const timeSuffix = isValidHour
    ? ` (${String(hourNum).padStart(2, '0')}:${min.padStart(2, '0')})`
    : '';

  // Diario
  if (dom === '*' && dow === '*') return `Diario${timeSuffix}`;

  // Días laborables
  if (dom === '*' && dow === '1-5') return `Días laborables${timeSuffix}`;

  // Fines de semana
  if (dom === '*' && (dow === '0,6' || dow === '6,0')) return `Fines de semana${timeSuffix}`;

  // Semanal (día concreto 0-6)
  if (dom === '*' && /^[0-6]$/.test(dow)) {
    return `Semanal — ${DAYS_ES[parseInt(dow, 10)]}${timeSuffix}`;
  }

  // Mensual (día del mes concreto)
  if (/^\d+$/.test(dom) && dow === '*') {
    return `Mensual — Día ${parseInt(dom, 10)}${timeSuffix}`;
  }

  return `Personalizada: ${cron}`;
}

/**
 * Formatea el campo last_run (ISO string | null) a texto legible.
 */
export function formatLastRun(lastRun: string | null | undefined): string {
  if (!lastRun) return '—';
  try {
    return new Date(lastRun).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return lastRun;
  }
}
