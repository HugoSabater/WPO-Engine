import { useState, useEffect, useCallback } from 'react';
import MetricsChart from './components/MetricsChart';
import PriorityCards from './components/PriorityCards';
import DataTable from './components/DataTable';
import SlideOverPanel from './components/SlideOverPanel';
import AnalyzerInput from './components/AnalyzerInput';
import type { MetricRow, PriorityInsight, ChartDataPoint } from './types';
import { fetchMetrics, fetchHistory, buildPriorityInsights, buildFallbackChartData } from './services/api';
import './index.css';

// Se ha eliminado el MODO DEMO a petición para entorno de PRD.

export default function App() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [insights, setInsights] = useState<PriorityInsight[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [activeRow, setActiveRow] = useState<MetricRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const loadData = useCallback(async (isBackgroundLoader = false) => {
    if (!isBackgroundLoader) setLoading(true);
    let finalData: MetricRow[] = [];
    let finalChartData: ChartDataPoint[] = [];
    let useDemo = false;
    let apiError: string | null = null;

    try {
      const [data, history] = await Promise.all([
        fetchMetrics(),
        fetchHistory()
      ]);
      
      finalData = data;
      finalChartData = history;
    } catch {
      finalData = [];
      finalChartData = [];
      apiError = 'Falló la conexión con la API del Backend. Por favor verifica que Docker o el ORM estén corriendo.';
    }

    setMetrics(finalData);
    setInsights(buildPriorityInsights(finalData));
    setChartData(finalChartData);
    setIsDemo(useDemo);
    setError(apiError);
    if (!isBackgroundLoader) setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAnalysisEnqueued = () => {
    // BullMQ y Lighthouse tardan unos 45-60s reales. 
    // Hacemos polling a los 40s, 60s, y 90s para asegurar refresco suave 
    // sin bloquear el uso de la interfaz
    setTimeout(() => loadData(true), 40000);
    setTimeout(() => loadData(true), 60000);
    setTimeout(() => loadData(true), 90000);
  };

  const handleRowClick = (row: MetricRow) => {
    setActiveRow(prev => prev?.url === row.url ? null : row);
  };

  return (
    <div className="min-h-screen bg-charcoal-950">
      {/* Header */}
      <header className="border-b border-charcoal-800 bg-charcoal-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-charcoal-100">WPO Analytics Engine</h1>
              <p className="text-xs text-charcoal-500">WordPress / WooCommerce Performance Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDemo && (
              <span className="badge-amber">MODO DEMO</span>
            )}
            <span className="text-xs text-charcoal-500">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>
      </header>

      {/* API Error Banner */}
      {error && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-400 text-center">
          ⚠️ {error}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6">
        <AnalyzerInput onAnalysisEnqueued={handleAnalysisEnqueued} />
        

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
          <div className="flex gap-6">
            {/* Left: Main Content (70% o 100%) */}
            <div className={`flex-1 min-w-0 transition-all duration-300 ${activeRow ? 'max-w-[70%]' : 'max-w-full'}`}>
              <MetricsChart data={chartData} />
              <PriorityCards insights={insights} />
              <DataTable 
                rows={metrics} 
                activeUrl={activeRow?.url || null} 
                onRowClick={handleRowClick} 
                onRefreshRequested={() => loadData(true)}
              />
            </div>

            {/* Right: SlideOver Panel (30%) */}
            {activeRow && (
              <div className="w-[30%] min-w-[320px] flex-shrink-0 h-[calc(100vh-120px)] sticky top-[72px] rounded-xl overflow-hidden border border-charcoal-700/50">
                <SlideOverPanel row={activeRow} onClose={() => setActiveRow(null)} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
