// Tipos compartidos para toda la aplicación WPO Dashboard

export interface MetricRow {
  id: number;
  url: string;
  timestamp: number;
  ttfb: number;
  lcp: number;
  cls: number;
  tbt: number;
  domSize: number;
  // Baseline (Antes / Después)
  is_baseline?: number;
  baseline_lcp?: number;
  baseline_ttfb?: number;
  baseline_tbt?: number;
  baseline_cls?: number;
  // Score calculado en cliente (0-100)
  score?: number;
  strategy?: 'mobile' | 'desktop';
  // screenshot_base64: ELIMINADO — Roadmap V2, Fase 1 (Purga de Datos)
}

export interface ChartDataPoint {
  date: string;
  performanceScore: number;
  lcp: number;
}

export type InsightSeverity = 'critical' | 'warning' | 'ok';

export interface PriorityInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  metric: string;
  value: string;
  description: string;
}

// 'preview' eliminado — tab de Vista Previa retirada definitivamente
export type SlideOverTab = 'business' | 'technical' | 'rawdata';
