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
