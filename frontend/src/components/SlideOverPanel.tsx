import { useState } from 'react';
import { MetricRow, SlideOverTab } from '../types';
import { translateMetrics } from '../utils/wpoTranslator';

interface SlideOverPanelProps {
  row: MetricRow;
  onClose: () => void;
}

// ─── Umbrales de métricas Core Web Vitals (Google) ────────────────────────────
type ThresholdLevel = 'good' | 'needs-improvement' | 'poor';

interface MetricCardDef {
  key: keyof MetricRow;
  label: string;
  unit: string;
  description: string;
  format?: (v: number) => string;
  threshold: (v: number) => ThresholdLevel;
}

const METRIC_CARDS: MetricCardDef[] = [
  {
    key: 'ttfb',
    label: 'TTFB',
    unit: 'ms',
    description: 'Time to First Byte',
    threshold: v => v <= 800 ? 'good' : v <= 1800 ? 'needs-improvement' : 'poor',
  },
  {
    key: 'lcp',
    label: 'LCP',
    unit: 's',
    description: 'Largest Contentful Paint',
    format: v => (v / 1000).toFixed(2),
    threshold: v => v <= 2500 ? 'good' : v <= 4000 ? 'needs-improvement' : 'poor',
  },
  {
    key: 'cls',
    label: 'CLS',
    unit: '',
    description: 'Cumulative Layout Shift',
    format: v => v.toFixed(3),
    threshold: v => v <= 0.1 ? 'good' : v <= 0.25 ? 'needs-improvement' : 'poor',
  },
  {
    key: 'tbt',
    label: 'TBT',
    unit: 'ms',
    description: 'Total Blocking Time',
    threshold: v => v <= 300 ? 'good' : v <= 600 ? 'needs-improvement' : 'poor',
  },
  {
    key: 'domSize',
    label: 'DOM',
    unit: ' nodos',
    description: 'Tamaño del árbol DOM',
    format: v => v.toLocaleString(),
    threshold: v => v <= 800 ? 'good' : v <= 1500 ? 'needs-improvement' : 'poor',
  },
  {
    key: 'score',
    label: 'Score',
    unit: '/100',
    description: 'Performance Score global',
    format: v => Math.round(v).toString(),
    // Para Score: mayor es mejor (isInverse = false)
    threshold: v => v >= 90 ? 'good' : v >= 50 ? 'needs-improvement' : 'poor',
  },
];

// ─── Helpers de color según umbral ───────────────────────────────────────────
function thresholdClasses(level: ThresholdLevel) {
  switch (level) {
    case 'good':             return { dot: 'bg-emerald-400', value: 'text-emerald-300', badge: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'needs-improvement':return { dot: 'bg-amber-400',   value: 'text-amber-300',   badge: 'bg-amber-500/10  border-amber-500/20'  };
    case 'poor':  default:   return { dot: 'bg-red-400',     value: 'text-red-300',     badge: 'bg-red-500/10   border-red-500/20'    };
  }
}

// ─── Tarjeta individual de métrica (estilo WebPageTest) ──────────────────────
function MetricCard({ def, row }: { def: MetricCardDef; row: MetricRow }) {
  const raw = row[def.key];
  if (raw == null) return (
    <div className="bg-charcoal-800/50 border border-charcoal-700/30 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider font-medium">{def.label}</span>
      <span className="text-lg font-mono text-charcoal-600">—</span>
      <span className="text-[9px] text-charcoal-600">{def.description}</span>
    </div>
  );

  const numVal = raw as number;
  const level  = def.threshold(numVal);
  const cls    = thresholdClasses(level);
  const displayed = def.format ? def.format(numVal) : Number.isInteger(numVal) ? numVal.toString() : numVal.toFixed(2);

  return (
    <div className={`border rounded-lg p-3 flex flex-col gap-1.5 ${cls.badge}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-charcoal-400 uppercase tracking-wider font-medium">{def.label}</span>
        <span className={`w-2 h-2 rounded-full ${cls.dot}`} title={level} />
      </div>
      <span className={`text-xl font-mono font-semibold ${cls.value}`}>
        {displayed}<span className="text-[11px] font-normal text-charcoal-500 ml-0.5">{def.unit}</span>
      </span>
      <span className="text-[9px] text-charcoal-500 leading-tight">{def.description}</span>
    </div>
  );
}

// ─── Tab: Raw Data Grid ───────────────────────────────────────────────────────
const RAW_DATA_CONTENT = (row: MetricRow) => (
  <div className="space-y-4">
    <p className="text-[10px] text-charcoal-500 uppercase tracking-widest font-semibold">
      Datos Crudos · {row.strategy === 'desktop' ? 'Desktop' : 'Mobile'}
    </p>

    {/* Grid de métricas */}
    <div className="grid grid-cols-2 gap-2.5">
      {METRIC_CARDS.map(def => (
        <MetricCard key={def.key as string} def={def} row={row} />
      ))}
    </div>

    {/* Bloque adicional: metadata de la auditoría */}
    <div className="mt-4 rounded-lg border border-charcoal-700/40 bg-charcoal-800/30 divide-y divide-charcoal-700/30">
      <div className="px-3 py-2 flex justify-between items-center">
        <span className="text-[10px] text-charcoal-500 uppercase tracking-wider">Dispositivo</span>
        <span className="text-[11px] font-mono text-charcoal-300 capitalize">{row.strategy ?? '—'}</span>
      </div>
      <div className="px-3 py-2 flex justify-between items-center">
        <span className="text-[10px] text-charcoal-500 uppercase tracking-wider">Timestamp</span>
        <span className="text-[11px] font-mono text-charcoal-300">
          {row.timestamp && row.timestamp > 0
            ? new Date(row.timestamp).toLocaleString('es-ES')
            : '—'}
        </span>
      </div>
      <div className="px-3 py-2 flex justify-between items-center">
        <span className="text-[10px] text-charcoal-500 uppercase tracking-wider">Baseline</span>
        <span className={`text-[11px] font-mono font-semibold ${row.is_baseline === 1 ? 'text-emerald-400' : 'text-charcoal-500'}`}>
          {row.is_baseline === 1 ? '✓ Activo' : 'No'}
        </span>
      </div>
      <div className="px-3 py-2">
        <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block mb-1">URL</span>
        <span className="text-[10px] font-mono text-charcoal-400 break-all">{row.url}</span>
      </div>
    </div>

    {/* Comparativa vs Baseline si existe */}
    {(row.baseline_lcp || row.baseline_ttfb || row.baseline_tbt || row.baseline_cls) && (
      <div className="mt-2">
        <p className="text-[10px] text-charcoal-500 uppercase tracking-widest font-semibold mb-2">
          Δ vs Baseline
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { label: 'TTFB', current: row.ttfb, base: row.baseline_ttfb, unit: 'ms', scale: 1 },
            { label: 'LCP',  current: row.lcp,  base: row.baseline_lcp,  unit: 's',  scale: 1000 },
            { label: 'CLS',  current: row.cls,  base: row.baseline_cls,  unit: '',   scale: 1 },
            { label: 'TBT',  current: row.tbt,  base: row.baseline_tbt,  unit: 'ms', scale: 1 },
          ] as { label: string; current: number; base?: number; unit: string; scale: number }[])
            .filter(m => m.base != null)
            .map(m => {
              const delta = (m.current - m.base!) / m.scale;
              const better = delta < 0;
              return (
                <div key={m.label} className={`rounded p-2 border text-center ${better ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <div className="text-[9px] text-charcoal-500 uppercase tracking-wider mb-1">{m.label}</div>
                  <div className={`text-sm font-mono font-semibold ${better ? 'text-emerald-400' : 'text-red-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(2)}{m.unit}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    )}
  </div>
);

// ─── Tab: Business Impact ─────────────────────────────────────────────────────
const BUSINESS_CONTENT = (row: MetricRow) => {
  const { insights, isPerfect } = translateMetrics(row);
  if (isPerfect) return (
    <div className="flex flex-col items-center justify-center h-full text-center text-charcoal-400 space-y-3">
      <span className="text-4xl">🚀</span>
      <p className="text-sm">¡Excelente rendimiento!<br />Esta ruta no presenta problemas graves de negocio.</p>
    </div>
  );
  return (
    <div className="space-y-4">
      {insights.map((insight, idx) => (
        <div key={idx} className="card border-amber-500/20 bg-amber-500/5 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{insight.title}</p>
            <span className="font-mono text-xs text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded">{insight.metricValue}</span>
          </div>
          <p className="text-sm text-charcoal-300 leading-relaxed">{insight.businessImpact}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Tab: Technical Solution ─────────────────────────────────────────────────
const TECHNICAL_CONTENT = (row: MetricRow) => {
  const { insights, isPerfect } = translateMetrics(row);
  if (isPerfect) return (
    <div className="flex flex-col items-center justify-center h-full text-center text-charcoal-400 space-y-3">
      <span className="text-4xl">✨</span>
      <p className="text-sm">Sin cuellos de botella técnicos graves detectados.</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-charcoal-400 text-xs mb-3">Diagnóstico técnico basado en CWV:</p>
      {insights.map((insight, idx) => (
        <div key={idx} className="mb-6">
          <p className="text-xs font-semibold text-charcoal-200 mb-2">
            {idx + 1}. Mitigar {insight.title}
          </p>
          <div className="code-block font-mono text-xs text-blue-300 bg-charcoal-800 p-3 rounded-lg border border-charcoal-700/50 leading-relaxed">
            {insight.technicalSolution}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Score Badge helper ───────────────────────────────────────────────────────
function scoreBadgeClasses(score: number) {
  if (score >= 90) return 'border-emerald-500 text-emerald-400';
  if (score >= 50) return 'border-amber-500  text-amber-400';
  return                    'border-red-500   text-red-400';
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function SlideOverPanel({ row, onClose }: SlideOverPanelProps) {
  const [activeTab, setActiveTab] = useState<SlideOverTab>('business');

  const TABS: { key: SlideOverTab; label: string }[] = [
    { key: 'business', label: 'Impacto de Negocio' },
    { key: 'technical', label: 'Solución Técnica' },
    { key: 'rawdata', label: 'Datos Crudos' },
  ];

  return (
    <div className="flex flex-col h-full bg-charcoal-900 border-l border-charcoal-700/50">

      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-charcoal-700/50">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-charcoal-400 mb-0.5">Análisis Detallado</p>
          <p className="text-xs font-mono text-charcoal-300 truncate" title={row.url}>
            {row.url.replace(/^https?:\/\//, '')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 text-charcoal-500 hover:text-charcoal-200 transition-colors p-1 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Score Badge compacto */}
      <div className="px-4 py-3 border-b border-charcoal-700/50 flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold flex-shrink-0 ${scoreBadgeClasses(row.score ?? 0)}`}>
          {row.score ?? '?'}
        </div>
        <div className="text-xs space-y-0.5 min-w-0">
          <div className="text-charcoal-400">LCP: <span className="font-mono text-charcoal-200">{row.lcp != null ? (row.lcp / 1000).toFixed(2) : '-'}s</span></div>
          <div className="text-charcoal-400">TBT: <span className="font-mono text-charcoal-200">{row.tbt != null ? row.tbt.toFixed(0) : '-'}ms</span></div>
          <div className="text-charcoal-400">CLS: <span className="font-mono text-charcoal-200">{row.cls != null ? row.cls.toFixed(3) : '-'}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-charcoal-700/50 px-4 gap-5 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`py-3 text-xs whitespace-nowrap transition-colors ${
              activeTab === key
                ? 'tab-active'
                : 'tab-inactive'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'business'  && BUSINESS_CONTENT(row)}
        {activeTab === 'technical' && TECHNICAL_CONTENT(row)}
        {activeTab === 'rawdata'   && RAW_DATA_CONTENT(row)}
      </div>
    </div>
  );
}
