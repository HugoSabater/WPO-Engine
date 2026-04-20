import MetricsChart from '../components/MetricsChart';
import PriorityCards from '../components/PriorityCards';
import DataTable from '../components/DataTable';
import SlideOverPanel from '../components/SlideOverPanel';
import AnalyzerInput from '../components/AnalyzerInput';
import type { MetricRow, PriorityInsight, ChartDataPoint } from '../types';
import { useState, useCallback } from 'react';

interface DashboardViewProps {
  metrics: MetricRow[];
  insights: PriorityInsight[];
  chartData: ChartDataPoint[];
  loading: boolean;
  onRefreshRequested: () => void;
  onAnalysisEnqueued: () => void;
}

export default function DashboardView({
  metrics,
  insights,
  chartData,
  loading,
  onRefreshRequested,
  onAnalysisEnqueued,
}: DashboardViewProps) {
  const [activeRow, setActiveRow] = useState<MetricRow | null>(null);

  const handleRowClick = useCallback((row: MetricRow) => {
    setActiveRow(prev => prev?.id === row.id ? null : row);
  }, []);

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
          {/* Contenido principal — ancho completo, el drawer flota encima */}
          <div className="w-full min-w-0">
            <MetricsChart data={chartData} />
            <PriorityCards insights={insights} />
            <DataTable
              rows={metrics}
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
