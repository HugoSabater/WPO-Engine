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
  getLatestPerSite,
  getQueueStatus,
} from './services/api';
import type { QueueStatus } from './services/api';
import './index.css';

// ─── Mapa de rutas URL ↔ vista ────────────────────────────────────────────────
// Permite navegación directa (bookmark, compartir enlace) y botón Atrás.
const ROUTE_MAP: Record<string, ActiveView> = {
  '/':              'dashboard',
  '/dashboard':     'dashboard',
  '/site-explorer': 'explorer',
  '/automations':   'automations',
  '/reports':       'reports',
};
const VIEW_TO_PATH: Record<ActiveView, string> = {
  dashboard:   '/dashboard',
  explorer:    '/site-explorer',
  automations: '/automations',
  reports:     '/reports',
};
function viewFromPath(): ActiveView {
  return ROUTE_MAP[window.location.pathname] ?? 'dashboard';
}

export default function App() {
  // ── Navegación SPA — inicializada desde la URL actual ───────────────────────
  const [activeView, setActiveView] = useState<ActiveView>(viewFromPath);

  // ── Prefill de URL para AutomationsView (desde Reports → Automations) ────────
  const [prefillUrl, setPrefillUrl] = useState<string>('');

  // ── Navegación contextual SiteExplorer → Reports (url + strategy) ──────────
  const [prefillReport, setPrefillReport] = useState<{ url: string; strategy: string } | null>(null);

  // ── Row seleccionado para abrir SlideOver en Dashboard (desde SiteExplorer) ───
  const [dashboardRow, setDashboardRow] = useState<import('./types').MetricRow | null>(null);

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
      // Insights y tarjetas basados SOLO en el último análisis de cada sitio
      const latestPerSite = getLatestPerSite(data);
      setInsights(buildPriorityInsights(latestPerSite));
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

  // ── Navegación contextual: Reports → Automations con URL prefilled ──────────
  const navigateToAutomations = useCallback((url: string) => {
    setPrefillUrl(url);
    setActiveView('automations');
  }, []);

  // ── Navegación contextual: SiteExplorer → Reports (prefill url + estrategia) ─
  const navigateToReports = useCallback((url: string, strategy: string) => {
    setPrefillReport({ url, strategy });
    setActiveView('reports');
  }, []);

  // ── Navegación contextual: SiteExplorer → Dashboard (abrir SlideOver) ───────
  const navigateToDashboardRow = useCallback((row: import('./types').MetricRow) => {
    setDashboardRow(row);
    setActiveView('dashboard');
  }, []);

  // ── Sincronización URL bidireccional ───────────────────────────────────────
  // Cuando cambia la vista activa → actualizar URL (para bookmarks / compartir)
  useEffect(() => {
    const path = VIEW_TO_PATH[activeView];
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, [activeView]);

  // Cuando el usuario pulsa Atrás/Adelante en el navegador → sincronizar vista
  useEffect(() => {
    const onPop = () => setActiveView(viewFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
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
            initialRow={dashboardRow}
            onInitialRowConsumed={() => setDashboardRow(null)}
          />
        );
      case 'explorer':
        return (
          <SiteExplorerView
            onNavigateToReports={navigateToReports}
            onNavigateToDashboard={navigateToDashboardRow}
          />
        );
      case 'automations':
        return <AutomationsView prefillUrl={prefillUrl} onPrefillConsumed={() => setPrefillUrl('')} />;
      case 'reports':
        return (
          <ReportsView
            onCreateAutomation={navigateToAutomations}
            prefillReport={prefillReport}
            onPrefillConsumed={() => setPrefillReport(null)}
          />
        );
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
