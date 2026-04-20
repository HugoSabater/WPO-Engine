import { useState, useEffect, useCallback, useRef } from 'react';
import TopBar, { type ActiveView } from './components/TopBar';
import DashboardView from './views/DashboardView';
import SiteExplorerView from './views/SiteExplorerView';
import AutomationsView from './views/AutomationsView';
import ReportsView from './views/ReportsView';
import type { MetricRow, PriorityInsight, ChartDataPoint } from './types';
import {
  fetchMetrics,
  fetchHistory,
  buildPriorityInsights,
  getQueueStatus,
} from './services/api';
import type { QueueStatus } from './services/api';
import './index.css';

export default function App() {
  // ── Navegación SPA ─────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  // ── Datos globales del Dashboard ───────────────────────────────────────────
  const [metrics,   setMetrics]   = useState<MetricRow[]>([]);
  const [insights,  setInsights]  = useState<PriorityInsight[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // ── Cola BullMQ — polling global (permanece activo en cualquier vista) ─────
  const [queueStatus,    setQueueStatus]    = useState<QueueStatus>({ waiting: 0, active: 0, delayed: 0, failed: 0 });
  const pollingRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevQueueBusyRef = useRef(false);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const loadData = useCallback(async (isBackgroundLoader = false) => {
    if (!isBackgroundLoader) setLoading(true);
    try {
      const [data, history] = await Promise.all([fetchMetrics(), fetchHistory()]);
      setMetrics(data);
      setInsights(buildPriorityInsights(data));
      setChartData(history);
      setError(null);
    } catch {
      setMetrics([]);
      setInsights([]);
      setChartData([]);
      setError('Falló la conexión con la API del Backend. Verifica que Docker esté corriendo.');
    } finally {
      if (!isBackgroundLoader) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Motor de polling de cola (3 s, ciclo de vida limpio) ──────────────────
  const startQueuePolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const status = await getQueueStatus();
        setQueueStatus(status);
        const isBusy = (status.waiting + status.active) > 0;
        // Transición ocupado → libre: recargar datos silenciosamente
        if (prevQueueBusyRef.current && !isBusy) {
          loadData(true);
        }
        prevQueueBusyRef.current = isBusy;
      } catch { /* error silencioso */ }
    }, 3000);
  }, [loadData]);

  useEffect(() => {
    startQueuePolling();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [startQueuePolling]);

  const handleAnalysisEnqueued = useCallback(() => {
    // Marcar como ocupado para que la próxima transición dispare loadData
    prevQueueBusyRef.current = true;
  }, []);

  // ── Renderizado condicional de vistas ──────────────────────────────────────
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardView
            metrics={metrics}
            insights={insights}
            chartData={chartData}
            loading={loading}
            onRefreshRequested={() => loadData(true)}
            onAnalysisEnqueued={handleAnalysisEnqueued}
          />
        );
      case 'explorer':
        return <SiteExplorerView />;
      case 'automations':
        return <AutomationsView />;
      case 'reports':
        return <ReportsView />;
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-950">
      {/* TopBar global: contiene la nav y el HUD de cola — visible en todas las vistas */}
      <TopBar
        activeView={activeView}
        setActiveView={setActiveView}
        queueStatus={queueStatus}
      />

      {/* Banner de error de API */}
      {error && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-400 text-center">
          ⚠️ {error}
        </div>
      )}

      {/* Vista activa */}
      {renderView()}
    </div>
  );
}
