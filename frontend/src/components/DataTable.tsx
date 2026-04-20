import { MetricRow } from '../types';
import { setBaseline, deleteAudit, enqueueAudit } from '../services/api';
import React, { useState, useMemo } from 'react';

// ─── Tipos de Sorting ──────────────────────────────────────────────────────────
type SortKey = 'score' | 'ttfb' | 'lcp' | 'cls' | 'tbt' | 'domSize' | 'timestamp';
type SortDir = 'asc' | 'desc';

interface DataTableProps {
  rows: MetricRow[];
  // FIX Bug 3: ID único del escaneo seleccionado (no la URL, que puede tener múltiples escaneos)
  activeRowId: number | null;
  onRowClick: (row: MetricRow) => void;
  onRefreshRequested: () => void;
}

// ─── Helpers de color ──────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function scoreRing(score: number) {
  if (score >= 90) return 'border-emerald-500/60';
  if (score >= 50) return 'border-amber-500/60';
  return 'border-red-500/60';
}

// ─── DeltaBadge ───────────────────────────────────────────────────────────────
function DeltaBadge({ current, baseline, unit, isInverse = true }: {
  current: number;
  baseline?: number;
  unit: string;
  isInverse?: boolean;
}) {
  if (baseline === undefined || baseline === null) return null;
  const delta = current - baseline;
  if (Math.abs(delta) < 0.001) return null;
  const isBetter = isInverse ? delta < 0 : delta > 0;

  return (
    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-mono
      ${isBetter ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
      {delta > 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(2)}{unit}
    </span>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-charcoal-600 text-xs">–</span>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 56; const h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  const stroke = last >= 90 ? '#34d399' : last >= 50 ? '#fbbf24' : '#f87171';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={pts.join(' ')} />
    </svg>
  );
}

// ─── Icono de Sort ────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return (
    <span className="ml-1 opacity-25 text-[10px]">↕</span>
  );
  return (
    <span className={`ml-1 text-[10px] text-blue-400`}>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

// ─── Columnas ordenables ──────────────────────────────────────────────────────
const SORTABLE_COLS: { key: SortKey; label: string; center?: boolean }[] = [
  { key: 'score',     label: 'Score',     center: true },
  { key: 'ttfb',      label: 'TTFB' },
  { key: 'lcp',       label: 'LCP' },
  { key: 'cls',       label: 'CLS' },
  { key: 'tbt',       label: 'TBT' },
  { key: 'domSize',   label: 'DOM' },
  { key: 'timestamp', label: 'Timestamp' },
];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function DataTable({ rows, activeRowId, onRowClick, onRefreshRequested }: DataTableProps) {
  const [settingBaselineId, setSettingBaselineId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // Acordeón: Set con los IDs de cluster ABIERTOS (todos abiertos por defecto)
  const [openClusters, setOpenClusters] = useState<Set<string>>(() => new Set());

  // Toggle de apertura/cierre de un cluster
  const handleToggleCluster = (clusterId: string) => {
    setOpenClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  // Inicializar todos los clusters como abiertos cuando los datos llegan
  const clusterKeys = useMemo(() => Object.keys(
    (() => {
      const g: Record<string, true> = {};
      rows.forEach(row => {
        try {
          const u = new URL(row.url);
          const segs = u.pathname.split('/').filter(Boolean);
          g[segs.length > 0 ? `/${segs[0]}/` : '/'] = true;
        } catch { g['/'] = true; }
      });
      return g;
    })()
  ).sort(), [rows]);

  // Sincronizar openClusters cuando llegan nuevos clusters
  React.useEffect(() => {
    setOpenClusters(prev => {
      const next = new Set(prev);
      clusterKeys.forEach(k => { if (!next.has(k)) next.add(k); });
      return next;
    });
  }, [clusterKeys]);

  // Toggle de sorting
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // FIX Bug 1: Clustering PRIMERO (orden alfabético inmutable de grupos),
  // luego sorting DENTRO de cada grupo sin mezclar clusters.
  const clusteredRows = useMemo(() => {
    // Paso 1 — agrupar sin ordenar (preserva orden de inserción de clusters)
    const groups: Record<string, MetricRow[]> = {};
    rows.forEach(row => {
      try {
        const u = new URL(row.url);
        const segs = u.pathname.split('/').filter(Boolean);
        const cluster = segs.length > 0 ? `/${segs[0]}/` : '/';
        if (!groups[cluster]) groups[cluster] = [];
        groups[cluster].push(row);
      } catch {
        if (!groups['/']) groups['/'] = [];
        groups['/'].push(row);
      }
    });

    // Paso 2 — ordenar DENTRO de cada grupo según sortKey/sortDir
    const sortedGroups: Record<string, MetricRow[]> = {};
    Object.keys(groups)
      .sort() // grupos en orden alfabético estricto e inmutable
      .forEach(cluster => {
        sortedGroups[cluster] = [...groups[cluster]].sort((a, b) => {
          const va = (a[sortKey] ?? 0) as number;
          const vb = (b[sortKey] ?? 0) as number;
          return sortDir === 'asc' ? va - vb : vb - va;
        });
      });

    return sortedGroups;
  }, [rows, sortKey, sortDir]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSetBaseline = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSettingBaselineId(id);
    try {
      await setBaseline(id);
      onRefreshRequested();
    } catch (err) {
      console.error(err);
      alert('Error fijando baseline');
    } finally {
      setSettingBaselineId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('¿Seguro que deseas eliminar esta auditoría permanentemente?')) return;
    setIsDeleting(id);
    try {
      await deleteAudit(id);
      onRefreshRequested();
    } catch (err) {
      console.error(err);
      alert('Error eliminando auditoría');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRefresh = async (e: React.MouseEvent, row: MetricRow) => {
    e.stopPropagation();
    setIsRefreshing(row.id);
    try {
      // FIX Req 8: usar los datos de la fila en curso, nunca de otra URL activa
      const targetUrl = row.url;
      const targetStrategy = row.strategy ?? 'mobile';
      await enqueueAudit(targetUrl, targetStrategy);
      alert(`Re-escaneo de ${targetUrl} [${targetStrategy}] encolado.`);
    } catch (err) {
      console.error(err);
      alert('Error encolando re-escaneo');
    } finally {
      setIsRefreshing(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-charcoal-200">Subpáginas Analizadas</h2>
        <span className="text-xs text-charcoal-400">
          {rows.length} registros · ordenado por <span className="text-charcoal-200 font-medium">{sortKey}</span> {sortDir === 'asc' ? '↑' : '↓'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-charcoal-700/50">
              {/* Columnas ordenables */}
              {SORTABLE_COLS.map(({ key, label, center }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`pb-2.5 pr-4 ${center ? 'text-center' : 'text-left'} font-medium text-charcoal-400 whitespace-nowrap cursor-pointer hover:text-charcoal-200 select-none transition-colors`}
                >
                  {label}
                  <SortIcon active={sortKey === key} dir={sortDir} />
                </th>
              ))}
              {/* Columnas no ordenables */}
              {['URL', 'Disp.', 'Baseline', 'Acciones'].map(h => (
                <th key={h} className="pb-2.5 pr-4 text-left font-medium text-charcoal-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Object.entries(clusteredRows).map(([clusterId, clusterRows]) => (
              <React.Fragment key={clusterId}>
                {/* Cabecera de Cluster — actúa como toggle del acordeón */}
                <tr
                  className="bg-charcoal-800/30 border-b border-charcoal-800 cursor-pointer select-none group/cluster hover:bg-charcoal-800/50 transition-colors"
                  onClick={() => handleToggleCluster(clusterId)}
                >
                  <td colSpan={11} className="py-2 pl-3 pr-4">
                    <span className="flex items-center gap-2 text-xs font-semibold text-charcoal-300 uppercase tracking-widest">
                      {/* Chevron animado: rotado 90º cuando está cerrado */}
                      <svg
                        className={`w-3.5 h-3.5 text-charcoal-500 flex-shrink-0 transition-transform duration-200
                          ${openClusters.has(clusterId) ? 'rotate-90' : 'rotate-0'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <svg className="w-3.5 h-3.5 text-charcoal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{clusterId}</span>
                      <span className="ml-auto text-[10px] font-normal text-charcoal-500 normal-case tracking-normal">
                        {clusterRows.length} {clusterRows.length === 1 ? 'escaneo' : 'escaneos'}
                      </span>
                    </span>
                  </td>
                </tr>

                {openClusters.has(clusterId) && clusterRows.map((row) => {
                  // FIX Bug 3: comparar por id único, nunca por url
                  const isActive = activeRowId === row.id;
                  const score = row.score ?? 0;
                  const isBase = row.is_baseline === 1;

                  // FIX Req 8: timestamp — si el valor es 0 o inválido, mostrar guión
                  const ts = row.timestamp && row.timestamp > 0
                    ? new Date(row.timestamp).toLocaleDateString('es-ES', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })
                    : '—';

                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(row)}
                      className={`border-b border-charcoal-800/60 cursor-pointer transition-colors cluster-row-enter
                        ${isActive
                          ? 'bg-charcoal-800/70 border-l-2 border-l-charcoal-400/50'
                          : 'hover:bg-charcoal-800/40 border-l-2 border-l-transparent'
                        }`}
                    >
                      {/* Score */}
                      <td className="py-2.5 pr-4 pl-1">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-[10px] mx-auto ${scoreColor(score)} ${scoreRing(score)}`}>
                          {score}
                        </div>
                      </td>

                      {/* TTFB */}
                      <td className={`py-2.5 pr-4 font-mono ${row.ttfb == null ? 'text-charcoal-500' : row.ttfb > 1800 ? 'text-red-400' : row.ttfb > 800 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.ttfb != null ? row.ttfb.toFixed(0) : '-'} <span className="text-charcoal-500 text-[10px]">ms</span>
                        {!isBase && <DeltaBadge current={row.ttfb} baseline={row.baseline_ttfb} unit="ms" />}
                      </td>

                      {/* LCP */}
                      <td className={`py-2.5 pr-4 font-mono ${row.lcp == null ? 'text-charcoal-500' : row.lcp > 4000 ? 'text-red-400' : row.lcp > 2500 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.lcp != null ? (row.lcp / 1000).toFixed(2) : '-'} <span className="text-charcoal-500 text-[10px]">s</span>
                        {!isBase && <DeltaBadge current={row.lcp != null ? row.lcp / 1000 : 0} baseline={row.baseline_lcp ? row.baseline_lcp / 1000 : undefined} unit="s" />}
                      </td>

                      {/* CLS */}
                      <td className={`py-2.5 pr-4 font-mono ${row.cls == null ? 'text-charcoal-500' : row.cls > 0.25 ? 'text-red-400' : row.cls > 0.1 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.cls != null ? row.cls.toFixed(3) : '-'}
                        {!isBase && <DeltaBadge current={row.cls} baseline={row.baseline_cls} unit="" />}
                      </td>

                      {/* TBT */}
                      <td className={`py-2.5 pr-4 font-mono ${row.tbt == null ? 'text-charcoal-500' : row.tbt > 600 ? 'text-red-400' : row.tbt > 300 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.tbt != null ? row.tbt.toFixed(0) : '-'} <span className="text-charcoal-500 text-[10px]">ms</span>
                        {!isBase && <DeltaBadge current={row.tbt} baseline={row.baseline_tbt} unit="ms" />}
                      </td>

                      {/* DOM Size */}
                      <td className="py-2.5 pr-4 font-mono text-charcoal-400">
                        {row.domSize != null ? row.domSize.toLocaleString() : '-'}
                      </td>

                      {/* Timestamp */}
                      <td className="py-2.5 pr-4 text-charcoal-500">{ts}</td>

                      {/* URL */}
                      <td className="py-2.5 pr-4 max-w-[200px]">
                        <span className="block truncate text-charcoal-200 font-medium" title={row.url}>
                          {row.url.replace(/^https?:\/\//, '')}
                        </span>
                        {isBase && (
                          <span className="text-[9px] text-charcoal-400 font-semibold tracking-wider uppercase mt-1 block">
                            ✓ BASELINE
                          </span>
                        )}
                      </td>

                      {/* Dispositivo */}
                      <td className="py-2.5 pr-4 font-mono text-charcoal-400">
                        {row.strategy === 'desktop' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                      </td>

                      {/* Baseline */}
                      <td className="py-2.5 pr-4">
                        {!isBase ? (
                          <button
                            onClick={(e) => handleSetBaseline(e, row.id)}
                            disabled={settingBaselineId === row.id}
                            className="px-2.5 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 border border-charcoal-700 rounded text-[10px] uppercase font-medium tracking-wide transition-colors disabled:opacity-50"
                          >
                            {settingBaselineId === row.id ? 'Fijando...' : 'Fijar'}
                          </button>
                        ) : (
                          <span className="text-charcoal-600 text-[10px] uppercase tracking-wide">Fijado</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 flex items-center gap-1.5 mt-0.5">
                        <button
                          onClick={(e) => handleRefresh(e, row)}
                          disabled={isRefreshing === row.id}
                          className="p-1.5 text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800 rounded transition"
                          title="Re-Escanear esta URL"
                        >
                          {isRefreshing === row.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, row.id)}
                          disabled={isDeleting === row.id}
                          className="p-1.5 text-charcoal-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                          title="Eliminar Auditoría"
                        >
                          {isDeleting === row.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
