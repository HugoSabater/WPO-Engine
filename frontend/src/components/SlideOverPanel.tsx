import { useState } from 'react';
import { MetricRow, SlideOverTab } from '../types';
import { translateMetrics } from '../utils/wpoTranslator';

interface SlideOverPanelProps {
  row: MetricRow;
  onClose: () => void;
}

const BUSINESS_CONTENT = (row: MetricRow) => {
  const { insights, isPerfect } = translateMetrics(row);
  
  if (isPerfect) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-charcoal-400 space-y-3">
        <span className="text-4xl">🚀</span>
        <p className="text-sm">¡Excelente rendimiento!<br/>Esta ruta no presenta problemas graves de negocio.</p>
      </div>
    );
  }

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

const TECHNICAL_CONTENT = (row: MetricRow) => {
  const { insights, isPerfect } = translateMetrics(row);

  if (isPerfect) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-charcoal-400 space-y-3">
        <span className="text-4xl">✨</span>
        <p className="text-sm">Sin cuellos de botella técnicos graves detectados.</p>
      </div>
    );
  }

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

const PREVIEW_CONTENT = (row: MetricRow) => {
  if (!row.screenshot_base64) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-charcoal-500 space-y-3">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        <p className="text-sm">Vista previa no disponible en este escaneo antiguo.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-4 bg-charcoal-900 border border-dashed border-charcoal-700 rounded-xl overflow-hidden min-h-full">
      <div 
        className={`relative overflow-y-auto overflow-x-hidden border-4 border-charcoal-950 rounded-lg shadow-2xl transition-all CustomScrollbar 
        ${row.strategy === 'desktop' ? 'w-full aspect-video border-[6px]' : 'w-[280px] h-[550px] border-[12px] border-b-[24px] border-t-[24px] rounded-[24px]'}`}
      >
        <img 
          src={`data:image/jpeg;base64,${row.screenshot_base64}`} 
          alt={`Screenshot of ${row.url}`}
          className="w-full h-auto block select-none"
        />
      </div>
      <p className="text-xs text-charcoal-500 font-mono mt-4 uppercase tracking-widest">
         Vista emulada en {row.strategy}
      </p>
    </div>
  );
};

export default function SlideOverPanel({ row, onClose }: SlideOverPanelProps) {
  const [activeTab, setActiveTab] = useState<SlideOverTab>('business');

  return (
    <div className="flex flex-col h-full bg-charcoal-900 border-l border-charcoal-700/50">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-charcoal-700/50">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-charcoal-400 mb-0.5">Análisis Detallado</p>
          <p className="text-xs font-mono text-blue-400 truncate" title={row.url}>
            {row.url.replace(/^https?:\/\//, '')}
          </p>
        </div>
        <button onClick={onClose} className="ml-3 text-charcoal-500 hover:text-charcoal-200 transition-colors p-1 rounded">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Score Badge */}
      <div className="px-4 py-3 border-b border-charcoal-700/50 flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold
          ${(row.score ?? 0) >= 90 ? 'border-emerald-500 text-emerald-400' : (row.score ?? 0) >= 50 ? 'border-amber-500 text-amber-400' : 'border-red-500 text-red-400'}`}>
          {row.score ?? '?'}
        </div>
        <div className="text-xs space-y-0.5">
          <div className="text-charcoal-400">LCP: <span className="font-mono text-charcoal-200">{row.lcp != null ? (row.lcp / 1000).toFixed(2) : '-'}s</span></div>
          <div className="text-charcoal-400">TBT: <span className="font-mono text-charcoal-200">{row.tbt != null ? row.tbt.toFixed(0) : '-'}ms</span></div>
          <div className="text-charcoal-400">CLS: <span className="font-mono text-charcoal-200">{row.cls != null ? row.cls.toFixed(3) : '-'}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-charcoal-700/50 px-4 gap-5 overflow-x-auto CustomScrollbarHide">
        <button onClick={() => setActiveTab('business')} className={`py-3 text-xs whitespace-nowrap ${activeTab === 'business' ? 'tab-active' : 'tab-inactive'}`}>
          Impacto de Negocio
        </button>
        <button onClick={() => setActiveTab('technical')} className={`py-3 text-xs whitespace-nowrap ${activeTab === 'technical' ? 'tab-active' : 'tab-inactive'}`}>
          Solución Técnica
        </button>
        <button onClick={() => setActiveTab('preview')} className={`py-3 text-xs whitespace-nowrap ${activeTab === 'preview' ? 'tab-active' : 'tab-inactive'}`}>
          Vista Previa
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'business' && BUSINESS_CONTENT(row)}
        {activeTab === 'technical' && TECHNICAL_CONTENT(row)}
        {activeTab === 'preview' && PREVIEW_CONTENT(row)}
      </div>
    </div>
  );
}
