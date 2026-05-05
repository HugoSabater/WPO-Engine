import MetricsChart from '../components/MetricsChart';
import PriorityCards from '../components/PriorityCards';
import DataTable from '../components/DataTable';
import SlideOverPanel from '../components/SlideOverPanel';
import AnalyzerInput from '../components/AnalyzerInput';
import type { MetricRow, PriorityInsight, ChartDataPoint } from '../types';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { getLatestPerSite, filterByDays, buildPriorityInsights } from '../services/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ViewMode = 'current' | 'last30';

interface DashboardViewProps {
  metrics: MetricRow[];
  insights: PriorityInsight[];
  chartData: ChartDataPoint[];
  loading: boolean;
  onRefreshRequested: () => void;
  onAnalysisEnqueued: () => void;
  initialRow?:              MetricRow | null;
  onInitialRowConsumed?:    () => void;
}

// ─── Selector de modo de vista ────────────────────────────────────────────────
function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const options: { id: ViewMode; label: string; hint: string }[] = [
    { id: 'current', label: 'Estado Actual',   hint: 'Último análisis por sitio' },
    { id: 'last30',  label: 'Últimos 30 días', hint: 'Promedio del período' },
  ];

  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-charcoal-800/60 border border-charcoal-700/40">
      {options.map(({ id, label, hint }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={hint}
          className={`
            px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150
            ${mode === id
              ? 'bg-charcoal-700 text-charcoal-100 shadow-sm'
              : 'text-charcoal-500 hover:text-charcoal-300'}
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardView({
  metrics,
  insights: insightsFromApp,
  chartData,
  loading,
  onRefreshRequested,
  onAnalysisEnqueued,
  initialRow,
  onInitialRowConsumed,
}: DashboardViewProps) {
  const [activeRow, setActiveRow] = useState<MetricRow | null>(initialRow ?? null);
  const [viewMode,  setViewMode]  = useState<ViewMode>('current');

  // Abrir SlideOver si llegamos desde SiteExplorer con una fila pre-seleccionada
  useEffect(() => {
    if (!initialRow) return;
    setActiveRow(initialRow);
    onInitialRowConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRow]);

  const handleRowClick = useCallback((row: MetricRow) => {
    setActiveRow(prev => prev?.id === row.id ? null : row);
  }, []);

  // ── Derivar el conjunto activo según el modo ────────────────────────────────
  // 'current': último análisis por sitio → insights precisos y sin ruido histórico
  // 'last30':  todos los registros de los últimos 30 días → visión temporal
  const { activeInsights, activeMetrics } = useMemo(() => {
    if (viewMode === 'current') {
      // Ya calculados en App.tsx con getLatestPerSite — reutilizamos
      return { activeInsights: insightsFromApp, activeMetrics: getLatestPerSite(metrics) };
    }
    // Modo temporal: filtrar por 30 días y recalcular insights
    const filtered = filterByDays(metrics, 30);
    return {
      activeInsights: buildPriorityInsights(getLatestPerSite(filtered)),
      activeMetrics:  filtered,
    };
  }, [viewMode, metrics, insightsFromApp]);

  // Textos de contexto para el operador
  const modeLabel = viewMode === 'current'
    ? `Mostrando estado actual · ${activeMetrics.length} sitio${activeMetrics.length !== 1 ? 's' : ''} monitoreado${activeMetrics.length !== 1 ? 's' : ''}`
    : `Últimos 30 días · ${activeMetrics.length} análisis`;

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-6">
      <AnalyzerInput onAnalysisEnqueued={onAnalysisEnqueued} />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-charcoal-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Cargando métricas desde el motor WPO...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Barra de contexto: modo de vista + etiqueta informativa */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-[11px] text-charcoal-500">{modeLabel}</p>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {/* Contenido principal */}
          <div className="w-full min-w-0">
            <MetricsChart data={chartData} />
            <PriorityCards insights={activeInsights} />
            <DataTable
              rows={activeMetrics}
              activeRowId={activeRow?.id ?? null}
              onRowClick={handleRowClick}
              onRefreshRequested={onRefreshRequested}
            />
          </div>

          {/* Drawer lateral flotante */}
          {activeRow && (
            <>
              <div
                className="fixed inset-0 z-30 bg-charcoal-950/60 backdrop-blur-sm"
                onClick={() => setActiveRow(null)}
              />
              <div className="fixed top-0 right-0 z-40 h-screen w-[420px] max-w-[90vw] border-l border-charcoal-700/50 shadow-2xl overflow-hidden">
                <SlideOverPanel row={activeRow} onClose={() => setActiveRow(null)} />
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
