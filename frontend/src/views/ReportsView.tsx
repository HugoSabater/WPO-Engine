import { useState, useEffect, useCallback } from 'react';
import { fetchAllMetrics } from '../services/api';
import type { MetricRow } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}
function scoreRing(score: number) {
  if (score >= 90) return 'border-emerald-500/50';
  if (score >= 50) return 'border-amber-500/50';
  return 'border-red-500/50';
}
function metricColor(val: number | null, warn: number, crit: number) {
  if (val == null) return 'text-charcoal-500';
  if (val > crit)  return 'text-red-400';
  if (val > warn)  return 'text-amber-400';
  return 'text-charcoal-300';
}
function fmtTs(ts: number): string {
  if (!ts || ts <= 0) return '—';
  return new Date(ts).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
const CSV_COLS: { header: string; get: (r: MetricRow) => string }[] = [
  { header: 'ID',        get: r => String(r.id) },
  { header: 'URL',       get: r => r.url },
  { header: 'Estrategia', get: r => r.strategy ?? 'mobile' },
  { header: 'Score',     get: r => String(r.score ?? '') },
  { header: 'TTFB (ms)', get: r => r.ttfb != null ? r.ttfb.toFixed(0) : '' },
  { header: 'LCP (s)',   get: r => r.lcp  != null ? (r.lcp / 1000).toFixed(3) : '' },
  { header: 'CLS',       get: r => r.cls  != null ? r.cls.toFixed(4) : '' },
  { header: 'TBT (ms)',  get: r => r.tbt  != null ? r.tbt.toFixed(0) : '' },
  { header: 'DOM Nodes', get: r => r.domSize != null ? String(r.domSize) : '' },
  { header: 'Timestamp', get: r => fmtTs(r.timestamp) },
  { header: 'Baseline',  get: r => r.is_baseline === 1 ? 'Sí' : 'No' },
];

function escapeCell(val: string): string {
  if (/[,"\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function exportToCsv(rows: MetricRow[], filename: string) {
  const header = CSV_COLS.map(c => c.header).join(',');
  const body   = rows.map(r =>
    CSV_COLS.map(c => escapeCell(c.get(r))).join(',')
  );
  const csv  = [header, ...body].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Tipos de filtro y sort ───────────────────────────────────────────────────
type SortKey = 'score' | 'ttfb' | 'lcp' | 'cls' | 'tbt' | 'domSize' | 'timestamp';
type SortDir = 'asc' | 'desc';
type DeviceFilter = 'all' | 'mobile' | 'desktop';
type HealthFilter = 'all' | 'critical' | 'improvable' | 'optimal';

// ─── Componente: SortIcon ─────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 text-[10px] ${active ? 'text-blue-400' : 'opacity-25'}`}>
      {!active ? '↕' : dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

// ─── Vista Principal ──────────────────────────────────────────────────────────
export default function ReportsView() {
  const [rows,    setRows]    = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filtros
  const [search,       setSearch]       = useState('');
  const [device,       setDevice]       = useState<DeviceFilter>('all');
  const [onlyBaseline, setOnlyBaseline] = useState(false);
  const [health,       setHealth]       = useState<HealthFilter>('all');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllMetrics();
      setRows(data);
    } catch (err: any) {
      setError(err.message ?? 'Error cargando métricas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Filas filtradas y ordenadas
  const filtered = rows
    .filter(r => {
      if (device !== 'all' && r.strategy !== device) return false;
      if (onlyBaseline && r.is_baseline !== 1)        return false;
      if (search && !r.url.toLowerCase().includes(search.toLowerCase())) return false;
      const s = r.score ?? 0;
      if (health === 'critical'  && s >= 50)  return false;
      if (health === 'improvable' && (s < 50 || s >= 90)) return false;
      if (health === 'optimal'   && s < 90)   return false;
      return true;
    })
    .sort((a, b) => {
      const va = (a[sortKey] ?? 0) as number;
      const vb = (b[sortKey] ?? 0) as number;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const handleExportAll     = () => exportToCsv(filtered, `wpo-report-${Date.now()}.csv`);

  // ─── COLS de tabla ────────────────────────────────────────────────────────
  const SORTABLE: { key: SortKey; label: string }[] = [
    { key: 'score',     label: 'Score' },
    { key: 'ttfb',      label: 'TTFB' },
    { key: 'lcp',       label: 'LCP' },
    { key: 'cls',       label: 'CLS' },
    { key: 'tbt',       label: 'TBT' },
    { key: 'domSize',   label: 'DOM' },
    { key: 'timestamp', label: 'Fecha' },
  ];

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

      {/* ── Cabecera de página ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h2 className="text-base font-semibold text-charcoal-100">Reports</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Historial completo de auditorías WPO · exportación nativa CSV
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Botón recargar */}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-charcoal-800 border border-charcoal-700/60 text-charcoal-300
              hover:bg-charcoal-700 hover:text-charcoal-100 transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>

          {/* Botón CSV */}
          <button
            onClick={handleExportAll}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/40
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar CSV
            {filtered.length > 0 && (
              <span className="ml-1 bg-emerald-700/50 px-1.5 py-0.5 rounded text-[10px] font-mono">
                {filtered.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Barra de filtros ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal-500 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por URL…"
            className="w-full pl-9 pr-3 py-2 text-xs bg-charcoal-800 border border-charcoal-700/60 rounded-lg
              text-charcoal-200 placeholder-charcoal-600
              focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />
        </div>

        {/* Dispositivo */}
        <select
          value={device}
          onChange={e => setDevice(e.target.value as DeviceFilter)}
          className="px-3 py-2 text-xs bg-charcoal-800 border border-charcoal-700/60 rounded-lg
            text-charcoal-300 cursor-pointer focus:outline-none focus:border-blue-500/70 transition-colors"
        >
          <option value="all">Todos los dispositivos</option>
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
        </select>

        {/* Estado de salud */}
        <select
          id="health-filter"
          value={health}
          onChange={e => setHealth(e.target.value as HealthFilter)}
          className="px-3 py-2 text-xs bg-charcoal-800 border border-charcoal-700/60 rounded-lg
            text-charcoal-300 cursor-pointer focus:outline-none focus:border-blue-500/70 transition-colors"
        >
          <option value="all">Todas las puntuaciones</option>
          <option value="critical">Críticas (&lt; 50)</option>
          <option value="improvable">Mejorables (50–89)</option>
          <option value="optimal">Óptimas (&ge; 90)</option>
        </select>

        {/* Solo Baseline */}
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-800 border border-charcoal-700/60 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyBaseline}
            onChange={e => setOnlyBaseline(e.target.checked)}
            className="accent-blue-500 w-3.5 h-3.5"
          />
          <span className="text-xs text-charcoal-400">Solo Baselines</span>
        </label>

        {/* Contador */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-800/40 border border-charcoal-700/30">
          <span className="text-xs text-charcoal-500 font-mono">
            <span className="text-charcoal-200 font-semibold">{filtered.length}</span>
            /{rows.length} registros
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded
            bg-blue-500/10 border border-blue-500/20 text-blue-400">
            Historial completo
          </span>
        </div>
      </div>

      {/* ── Estados: loading / error / vacío / tabla ── */}
      {loading && (
        <div className="card flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 text-charcoal-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs text-charcoal-500 animate-pulse">Cargando historial de auditorías…</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="card flex items-center gap-3 py-6 border-red-500/20 bg-red-500/5">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-medium text-red-400">Error cargando datos</p>
            <p className="text-[11px] text-charcoal-500 mt-0.5">{error}</p>
          </div>
          <button onClick={load}
            className="ml-auto text-xs text-red-400 hover:text-red-300 underline transition-colors">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 gap-3">
          <svg className="w-10 h-10 text-charcoal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-charcoal-500">
            {rows.length === 0 ? 'No hay auditorías registradas aún.' : 'Ningún resultado coincide con los filtros.'}
          </p>
          {rows.length > 0 && (
            <button
              onClick={() => { setSearch(''); setDevice('all'); setOnlyBaseline(false); setHealth('all'); }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-charcoal-700/50">
                  {/* Columnas con sort */}
                  {SORTABLE.map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-4 py-3 text-left font-medium text-charcoal-400 whitespace-nowrap
                        cursor-pointer hover:text-charcoal-200 select-none transition-colors"
                    >
                      {label}
                      <SortIcon active={sortKey === key} dir={sortDir} />
                    </th>
                  ))}
                  {/* Columnas fijas */}
                  {['URL', 'Disp.', 'Baseline'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-charcoal-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((row, idx) => {
                  const score  = row.score ?? 0;
                  const isBase = row.is_baseline === 1;
                  const ts     = fmtTs(row.timestamp);
                  const even   = idx % 2 === 0;

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-charcoal-800/60 transition-colors
                        ${even ? 'bg-charcoal-900/20' : 'bg-transparent'}
                        hover:bg-charcoal-800/40
                        ${isBase ? 'border-l-2 border-l-blue-500/50' : 'border-l-2 border-l-transparent'}`}
                    >
                      {/* Score */}
                      <td className="px-4 py-2.5">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center
                          font-semibold text-[10px] ${scoreColor(score)} ${scoreRing(score)}`}>
                          {score}
                        </div>
                      </td>

                      {/* TTFB */}
                      <td className={`px-4 py-2.5 font-mono ${metricColor(row.ttfb, 800, 1800)}`}>
                        {row.ttfb != null ? `${row.ttfb.toFixed(0)}` : '—'}
                        {row.ttfb != null && <span className="text-charcoal-600 ml-0.5">ms</span>}
                      </td>

                      {/* LCP */}
                      <td className={`px-4 py-2.5 font-mono ${metricColor(row.lcp, 2500, 4000)}`}>
                        {row.lcp != null ? (row.lcp / 1000).toFixed(2) : '—'}
                        {row.lcp != null && <span className="text-charcoal-600 ml-0.5">s</span>}
                      </td>

                      {/* CLS */}
                      <td className={`px-4 py-2.5 font-mono ${metricColor(row.cls, 0.1, 0.25)}`}>
                        {row.cls != null ? row.cls.toFixed(3) : '—'}
                      </td>

                      {/* TBT */}
                      <td className={`px-4 py-2.5 font-mono ${metricColor(row.tbt, 300, 600)}`}>
                        {row.tbt != null ? `${row.tbt.toFixed(0)}` : '—'}
                        {row.tbt != null && <span className="text-charcoal-600 ml-0.5">ms</span>}
                      </td>

                      {/* DOM */}
                      <td className="px-4 py-2.5 font-mono text-charcoal-400">
                        {row.domSize != null ? row.domSize.toLocaleString('es-ES') : '—'}
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-2.5 text-charcoal-500 whitespace-nowrap">{ts}</td>

                      {/* URL */}
                      <td className="px-4 py-2.5 max-w-[220px]">
                        <span
                          className="block truncate text-charcoal-200 font-medium"
                          title={row.url}
                        >
                          {row.url.replace(/^https?:\/\//, '')}
                        </span>
                      </td>

                      {/* Dispositivo */}
                      <td className="px-4 py-2.5 text-charcoal-400" title={row.strategy === 'desktop' ? 'Desktop' : 'Mobile'}>
                        {row.strategy === 'desktop' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                      </td>

                      {/* Baseline badge */}
                      <td className="px-4 py-2.5">
                        {isBase ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                            bg-blue-500/10 border border-blue-500/20 text-blue-400 tracking-wide">
                            ✓ BASE
                          </span>
                        ) : (
                          <span className="text-charcoal-700 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer de tabla */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-charcoal-700/30 bg-charcoal-900/20">
            <span className="text-[11px] text-charcoal-600">
              Mostrando <span className="text-charcoal-400 font-medium">{filtered.length}</span> de{' '}
              <span className="text-charcoal-400 font-medium">{rows.length}</span> auditorías
            </span>
            <button
              onClick={handleExportAll}
              className="flex items-center gap-1.5 text-[11px] text-charcoal-400 hover:text-emerald-400 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar vista actual (.csv)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
