import { MetricRow } from '../types';
import { setBaseline, deleteAudit, enqueueAudit } from '../services/api';
import React, { useState, useMemo } from 'react';

interface DataTableProps {
  rows: MetricRow[];
  activeUrl: string | null;
  onRowClick: (row: MetricRow) => void;
  onRefreshRequested: () => void;
}

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

function DeltaBadge({ current, baseline, unit, isInverse = true }: { current: number, baseline?: number, unit: string, isInverse?: boolean }) {
  if (baseline === undefined || baseline === null) return null;
  const delta = current - baseline;
  if (delta === 0) return null;
  // Si isInverse es true, menor es mejor (ej. tiempo)
  // Mejora
  const isBetter = isInverse ? delta < 0 : delta > 0;
  
  return (
    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${isBetter ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
      {delta > 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(2)}{unit}
    </span>
  );
}

// Sparkline simple en SVG (5 puntos de tendencia simulados de los datos reales)
function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-charcoal-600 text-xs">–</span>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 56;
  const h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  });
  const lastScore = values[values.length - 1];
  const stroke = lastScore >= 90 ? '#34d399' : lastScore >= 50 ? '#fbbf24' : '#f87171';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={pts.join(' ')} />
    </svg>
  );
}

export default function DataTable({ rows, activeUrl, onRowClick, onRefreshRequested }: DataTableProps) {
  const [settingBaselineId, setSettingBaselineId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<number | null>(null);
  
  const clusteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (a.score || 0) - (b.score || 0));
    const groups: Record<string, typeof sorted> = {};
    
    sorted.forEach(row => {
      try {
        const u = new URL(row.url);
        const pathSegments = u.pathname.split('/').filter(Boolean);
        const cluster = pathSegments.length > 0 ? `/${pathSegments[0]}/` : '/';
        
        if (!groups[cluster]) groups[cluster] = [];
        groups[cluster].push(row);
      } catch {
        if (!groups['/']) groups['/'] = [];
        groups['/'].push(row);
      }
    });
    
    // Convertir de nuevo en array plano metiendo primero las de '/' // o devolver el record
    return groups;
  }, [rows]);

  const handleSetBaseline = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSettingBaselineId(id);
    try {
      await setBaseline(id);
      onRefreshRequested();
    } catch (err) {
      console.error(err);
      alert("Error fijando baseline");
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
      alert("Error eliminando auditoría");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRefresh = async (e: React.MouseEvent, row: MetricRow) => {
    e.stopPropagation();
    setIsRefreshing(row.id);
    try {
      await enqueueAudit(row.url, row.strategy || 'mobile');
      // Alert omitted or simple success handled by generic UI polling.
      alert(`Re-escaneo de ${row.url} encolado.`);
    } catch (err) {
      console.error(err);
      alert("Error encolando re-escaneo");
    } finally {
      setIsRefreshing(null);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-charcoal-200">Subpáginas Analizadas</h2>
        <span className="text-xs text-charcoal-400">{rows.length} registros · orden: peor → mejor</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-charcoal-700/50">
              {['Score', 'URL', 'TTFB', 'LCP', 'CLS', 'TBT', 'Disp.', 'Timestamp', 'Baseline', 'Acciones'].map((h, i) => (
                <th key={i} className={`pb-2.5 pr-4 ${h === 'Score' ? 'text-center' : 'text-left'} font-medium text-charcoal-400 whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(clusteredRows).map(([clusterId, clusterRows]) => (
              <React.Fragment key={clusterId}>
                <tr className="bg-charcoal-900/50 border-b border-charcoal-800">
                  <td colSpan={10} className="py-2 pl-4 text-xs font-semibold text-charcoal-300 uppercase tracking-widest bg-charcoal-800/30">
                    <span className="flex items-center gap-2">
                       <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                       {clusterId}
                    </span>
                  </td>
                </tr>
                {clusterRows.map((row) => {
                  const isActive = activeUrl === row.url;
                  const score = row.score ?? 0;
                  const isBase = row.is_baseline === 1;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(row)}
                      className={`border-b border-charcoal-800/60 cursor-pointer transition-colors
                        ${isActive ? 'bg-blue-500/10' : 'hover:bg-charcoal-800/50'}`}
                    >
                      <td className="py-2.5 pr-4 pl-1">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-[10px] mx-auto ${scoreColor(score)} ${scoreRing(score)}`}>
                          {score}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 max-w-[200px]">
                        <span className="block truncate text-charcoal-200 font-medium" title={row.url}>
                          {row.url.replace(/^https?:\/\//, '')}
                        </span>
                        {isBase && <span className="text-[9px] text-blue-400 font-semibold tracking-wider uppercase mt-1">✓ BASELINE ACTIVO</span>}
                      </td>
                      
                      <td className={`py-2.5 pr-4 font-mono ${row.ttfb == null ? 'text-charcoal-500' : row.ttfb > 1800 ? 'text-red-400' : row.ttfb > 800 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.ttfb != null ? row.ttfb.toFixed(0) : '-'} <span className="text-charcoal-500 text-[10px]">ms</span>
                        {!isBase && <DeltaBadge current={row.ttfb} baseline={row.baseline_ttfb} unit="ms" />}
                      </td>
                      
                      <td className={`py-2.5 pr-4 font-mono ${row.lcp == null ? 'text-charcoal-500' : row.lcp > 4000 ? 'text-red-400' : row.lcp > 2500 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.lcp != null ? (row.lcp / 1000).toFixed(2) : '-'} <span className="text-charcoal-500 text-[10px]">s</span>
                        {!isBase && <DeltaBadge current={row.lcp != null ? row.lcp / 1000 : 0} baseline={row.baseline_lcp ? row.baseline_lcp / 1000 : undefined} unit="s" />}
                      </td>
                      
                      <td className={`py-2.5 pr-4 font-mono ${row.cls == null ? 'text-charcoal-500' : row.cls > 0.25 ? 'text-red-400' : row.cls > 0.1 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.cls != null ? row.cls.toFixed(3) : '-'}
                        {!isBase && <DeltaBadge current={row.cls} baseline={row.baseline_cls} unit="" />}
                      </td>
                      
                      <td className={`py-2.5 pr-4 font-mono ${row.tbt == null ? 'text-charcoal-500' : row.tbt > 600 ? 'text-red-400' : row.tbt > 300 ? 'text-amber-400' : 'text-charcoal-300'}`}>
                        {row.tbt != null ? row.tbt.toFixed(0) : '-'} <span className="text-charcoal-500 text-[10px]">ms</span>
                        {!isBase && <DeltaBadge current={row.tbt} baseline={row.baseline_tbt} unit="ms" />}
                      </td>
                      
                      <td className="py-2.5 pr-4 font-mono text-charcoal-400">
                        {row.strategy === 'desktop' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        )}
                      </td>

                      <td className="py-2.5 pr-4 text-charcoal-500">
                        {new Date(row.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      
                      <td className="py-2.5 pr-4">
                        {!isBase ? (
                          <button 
                            onClick={(e) => handleSetBaseline(e, row.id)}
                            disabled={settingBaselineId === row.id}
                            className="px-2.5 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 border border-charcoal-700 rounded text-[10px] uppercase font-medium tracking-wide transition-colors disabled:opacity-50"
                          >
                             {settingBaselineId === row.id ? 'Fijando...' : 'Fijar Baseline'}
                          </button>
                        ) : (
                          <span className="text-charcoal-600 text-[10px] uppercase tracking-wide">Actual</span>
                        )}
                      </td>

                      <td className="py-2.5 flex items-center gap-1.5 mt-0.5">
                        <button
                          onClick={(e) => handleRefresh(e, row)}
                          disabled={isRefreshing === row.id}
                          className="p-1.5 text-charcoal-400 hover:text-blue-400 hover:bg-charcoal-800 rounded transition"
                          title="Re-Escanear URL con esta misma estrategia"
                        >
                          {isRefreshing === row.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, row.id)}
                          disabled={isDeleting === row.id}
                          className="p-1.5 text-charcoal-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                          title="Eliminar Auditoría Permanentemente"
                        >
                           {isDeleting === row.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
