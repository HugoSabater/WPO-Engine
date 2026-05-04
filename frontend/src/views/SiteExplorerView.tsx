import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAllMetrics, enqueueAudit } from '../services/api';
import type { MetricRow } from '../types';

// ─── API Crawler ──────────────────────────────────────────────────────────────
async function crawlUrl(url: string, limit: number): Promise<string[]> {
  const res = await fetch(`/api/crawl?url=${encodeURIComponent(url)}&limit=${limit}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status} al rastrear`);
  }
  const data = await res.json();
  return data.urls as string[];
}

async function enqueueBatch(urls: string[]): Promise<void> {
  const res = await fetch('/api/audit/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) throw new Error(`Error ${res.status} encolando batch`);
}

// ─── Tipos internos ────────────────────────────────────────────────────────────
interface SiteCard {
  url:           string;
  latest:        MetricRow;
  history:       MetricRow[];   // ordenado desc por timestamp
  scoreHistory:  number[];      // últimos N scores para sparkline
  hasBaseline:   boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 90) return 'text-emerald-400';
  if (s >= 50) return 'text-amber-400';
  return 'text-red-400';
}
function scoreRing(s: number) {
  if (s >= 90) return 'border-emerald-500/60';
  if (s >= 50) return 'border-amber-500/60';
  return 'border-red-500/60';
}
function scoreBg(s: number) {
  if (s >= 90) return 'bg-emerald-500/10';
  if (s >= 50) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}
function metricColor(val: number | null | undefined, warn: number, crit: number) {
  if (val == null) return 'text-charcoal-500';
  if (val > crit)  return 'text-red-400';
  if (val > warn)  return 'text-amber-400';
  return 'text-emerald-400';
}
function fmtTs(ts: number) {
  if (!ts || ts <= 0) return '—';
  return new Date(ts).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtUrl(url: string) {
  try { return new URL(url).hostname + new URL(url).pathname; }
  catch { return url; }
}

// ─── Sparkline SVG inline ─────────────────────────────────────────────────────
function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  if (values.length < 2) return <span className="text-charcoal-700 text-xs">–</span>;
  const W = 72; const H = 28;
  const max = Math.max(...values); const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = values[values.length - 1];
  const stroke = last >= 90 ? '#34d399' : last >= 50 ? '#fbbf24' : '#f87171';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={className}>
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ─── Skeleton de tarjeta ──────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-charcoal-700/40 bg-charcoal-900/60 p-5 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-charcoal-800" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-charcoal-800 rounded w-3/4" />
          <div className="h-2 bg-charcoal-800/60 rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-10 bg-charcoal-800/70 rounded-lg" />
        ))}
      </div>
      <div className="h-2 bg-charcoal-800/40 rounded w-full" />
    </div>
  );
}

// ─── Tarjeta de Sitio ─────────────────────────────────────────────────────────
function SiteCardComponent({ card, onRescan }: { card: SiteCard; onRescan: (url: string, strategy: string) => void }) {
  const { latest, scoreHistory, hasBaseline } = card;
  const score   = latest.score ?? 0;
  const device  = latest.strategy ?? 'mobile';
  const auditCount = card.history.length;

  return (
    <div className={`
      group relative rounded-xl border bg-charcoal-900/60 p-5
      flex flex-col gap-4 transition-all duration-200
      hover:border-charcoal-600/60 hover:bg-charcoal-800/40 hover:shadow-lg hover:shadow-black/20
      ${hasBaseline ? 'border-charcoal-700/50' : 'border-charcoal-800/50'}
    `}>

      {/* Baseline badge */}
      {hasBaseline && (
        <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest
          px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400">
          Baseline
        </span>
      )}

      {/* Cabecera: Score + URL */}
      <div className="flex items-center gap-3 pr-16">
        <div className={`
          w-11 h-11 rounded-full border-2 flex-shrink-0 flex items-center justify-center
          font-bold text-sm ${scoreColor(score)} ${scoreRing(score)} ${scoreBg(score)}
        `}>
          {score}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-charcoal-100 truncate" title={card.url}>
            {fmtUrl(card.url)}
          </p>
          <p className="text-[10px] text-charcoal-500 mt-0.5 flex items-center gap-1.5">
            {/* Icono dispositivo */}
            {device === 'desktop' ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            )}
            {device} · {auditCount} {auditCount === 1 ? 'auditoría' : 'auditorías'}
          </p>
        </div>
      </div>

      {/* Métricas CWV */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'TTFB', val: latest.ttfb, fmt: (v: number) => `${v.toFixed(0)}ms`, warn: 800,  crit: 1800 },
          { label: 'LCP',  val: latest.lcp,  fmt: (v: number) => `${(v/1000).toFixed(2)}s`, warn: 2500, crit: 4000 },
          { label: 'CLS',  val: latest.cls,  fmt: (v: number) => v.toFixed(3), warn: 0.1, crit: 0.25 },
          { label: 'TBT',  val: latest.tbt,  fmt: (v: number) => `${v.toFixed(0)}ms`, warn: 300,  crit: 600 },
        ].map(({ label, val, fmt, warn, crit }) => (
          <div key={label} className="rounded-lg bg-charcoal-800/60 border border-charcoal-700/30 px-2.5 py-2 text-center">
            <p className="text-[9px] text-charcoal-500 uppercase tracking-widest font-medium mb-0.5">{label}</p>
            <p className={`text-[11px] font-mono font-semibold ${metricColor(val, warn, crit)}`}>
              {val != null ? fmt(val) : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Sparkline + fecha */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-[9px] text-charcoal-600 uppercase tracking-widest">Tendencia score</p>
          <Sparkline values={scoreHistory} />
        </div>
        <div className="text-right">
          <p className="text-[9px] text-charcoal-600 uppercase tracking-widest">Último análisis</p>
          <p className="text-[10px] text-charcoal-400 mt-0.5">{fmtTs(latest.timestamp)}</p>
        </div>
      </div>

      {/* Footer: Re-escanear */}
      <div className="flex items-center justify-between pt-1 border-t border-charcoal-800/60">
        <a
          href={card.url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-charcoal-600 hover:text-blue-400 transition-colors flex items-center gap-1"
          onClick={e => e.stopPropagation()}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Abrir URL
        </a>
        <button
          onClick={() => onRescan(card.url, device)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-charcoal-400
            hover:text-charcoal-100 hover:bg-charcoal-700/60 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Re-escanear
        </button>
      </div>
    </div>
  );
}

// ─── Vista Principal ──────────────────────────────────────────────────────────
type SortMode = 'score_asc' | 'score_desc' | 'date_desc' | 'url_asc';
type DeviceFilter = 'all' | 'mobile' | 'desktop';

export default function SiteExplorerView() {
  const [rows,    setRows]    = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [sort,    setSort]    = useState<SortMode>('score_asc');
  const [device,  setDevice]  = useState<DeviceFilter>('all');
  const [rescanningUrl, setRescanningUrl] = useState<string | null>(null);
  const [rescanMsg, setRescanMsg] = useState<string | null>(null);

  // ── Crawler state ─────────────────────────────────────────────────────────
  const [crawlEnabled,  setCrawlEnabled]  = useState(false);
  const [crawlUrl_,     setCrawlUrl_]     = useState('');
  const [crawlLimit,    setCrawlLimit]    = useState(10);
  const [crawlStatus,   setCrawlStatus]   = useState<'idle'|'crawling'|'queuing'|'done'|'error'>('idle');
  const [crawlMsg,      setCrawlMsg]      = useState<string | null>(null);

  const handleCrawlAndAudit = async () => {
    if (!crawlUrl_) { setCrawlMsg('Introduce una URL base para rastrear.'); return; }
    try { new URL(crawlUrl_); } catch { setCrawlMsg('URL inválida. Incluye http:// o https://'); return; }
    setCrawlStatus('crawling'); setCrawlMsg(null);
    try {
      const urls = await crawlUrl(crawlUrl_, crawlLimit);
      if (urls.length === 0) { setCrawlStatus('error'); setCrawlMsg('No se encontraron enlaces internos en esa URL.'); return; }
      setCrawlStatus('queuing');
      await enqueueBatch(urls);
      setCrawlStatus('done');
      setCrawlMsg(`✓ ${urls.length} URL${urls.length > 1 ? 's' : ''} encoladas para auditoría.`);
      setTimeout(() => { setCrawlStatus('idle'); setCrawlMsg(null); }, 6000);
    } catch (e: any) {
      setCrawlStatus('error');
      setCrawlMsg(`✗ ${e.message}`);
      setTimeout(() => { setCrawlStatus('idle'); setCrawlMsg(null); }, 7000);
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAllMetrics();
      setRows(data);
    } catch (e: any) {
      setError(e.message ?? 'Error cargando datos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Agrupar por URL ───────────────────────────────────────────────────────
  const cards = useMemo<SiteCard[]>(() => {
    const groups: Record<string, MetricRow[]> = {};
    rows.forEach(r => {
      if (!groups[r.url]) groups[r.url] = [];
      groups[r.url].push(r);
    });

    return Object.entries(groups).map(([url, recs]) => {
      const sorted = [...recs].sort((a, b) => b.timestamp - a.timestamp);
      const latest = sorted[0];
      const scoreHistory = sorted.slice(0, 10).reverse().map(r => r.score ?? 0);
      const hasBaseline  = recs.some(r => r.is_baseline === 1);
      return { url, latest, history: sorted, scoreHistory, hasBaseline };
    });
  }, [rows]);

  // ── Filtrar y ordenar ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = cards.filter(c => {
      if (device !== 'all' && c.latest.strategy !== device) return false;
      if (search && !c.url.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    switch (sort) {
      case 'score_asc':  list.sort((a, b) => (a.latest.score ?? 0) - (b.latest.score ?? 0)); break;
      case 'score_desc': list.sort((a, b) => (b.latest.score ?? 0) - (a.latest.score ?? 0)); break;
      case 'date_desc':  list.sort((a, b) => b.latest.timestamp - a.latest.timestamp); break;
      case 'url_asc':    list.sort((a, b) => a.url.localeCompare(b.url)); break;
    }
    return list;
  }, [cards, search, sort, device]);

  // ── Re-escaneo ────────────────────────────────────────────────────────────
  const handleRescan = async (url: string, strategy: string) => {
    setRescanningUrl(url);
    setRescanMsg(null);
    try {
      await enqueueAudit(url, strategy as 'mobile' | 'desktop');
      setRescanMsg(`✓ Re-escaneo encolado para ${fmtUrl(url)}`);
      setTimeout(() => setRescanMsg(null), 4000);
    } catch (e: any) {
      setRescanMsg(`✗ Error: ${e.message}`);
      setTimeout(() => setRescanMsg(null), 5000);
    } finally {
      setRescanningUrl(null);
    }
  };

  // ─── Estadísticas rápidas de cabecera ─────────────────────────────────────
  const stats = useMemo(() => {
    if (!cards.length) return null;
    const scores = cards.map(c => c.latest.score ?? 0);
    const avg    = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const crit   = scores.filter(s => s < 50).length;
    const ok     = scores.filter(s => s >= 90).length;
    return { avg, crit, ok, total: cards.length };
  }, [cards]);

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

      {/* ── Cabecera ── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div>
          <h2 className="text-base font-semibold text-charcoal-100">Site Explorer</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Estado de salud de cada URL monitoreada · última auditoría y tendencia de score
          </p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-charcoal-800 border border-charcoal-700/60 text-charcoal-300
            hover:bg-charcoal-700 hover:text-charcoal-100 transition-colors disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* ── Panel Web Crawler ── */}
      <div className="rounded-xl border border-charcoal-700/50 bg-charcoal-900/50 p-4 space-y-3">
        {/* Cabecera del panel */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
            <span className="text-xs font-semibold text-charcoal-200">Web Crawler</span>
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full
              bg-blue-500/10 border border-blue-500/25 text-blue-400">Nuevo</span>
          </div>
          {/* Toggle */}
          <button
            id="crawler-toggle"
            onClick={() => setCrawlEnabled(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
              ${crawlEnabled ? 'bg-blue-600' : 'bg-charcoal-700'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
              ${crawlEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}/>
          </button>
        </div>

        {/* Cuerpo expandible */}
        {crawlEnabled && (
          <div className="space-y-3 pt-1 border-t border-charcoal-800/60">
            <p className="text-[10px] text-charcoal-500">
              Introduce una URL raíz. El sistema extraerá enlaces internos y los enviará en bloque a auditoría.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Input URL */}
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal-500 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
                <input
                  id="crawl-url-input"
                  type="url"
                  value={crawlUrl_}
                  onChange={e => setCrawlUrl_(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-charcoal-800 border border-charcoal-700/60 rounded-lg
                    text-charcoal-200 placeholder-charcoal-600
                    focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                />
              </div>

              {/* Input límite */}
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[10px] text-charcoal-500 whitespace-nowrap">Límite URLs</label>
                <input
                  id="crawl-limit-input"
                  type="number" min={1} max={50} value={crawlLimit}
                  onChange={e => setCrawlLimit(Math.min(50, Math.max(1, Number(e.target.value))))}
                  className="w-16 px-2 py-2 text-xs text-center bg-charcoal-800 border border-charcoal-700/60
                    rounded-lg text-charcoal-200 focus:outline-none focus:border-blue-500/70 transition-colors"
                />
              </div>

              {/* Botón Analizar */}
              <button
                id="crawl-submit-btn"
                onClick={handleCrawlAndAudit}
                disabled={crawlStatus === 'crawling' || crawlStatus === 'queuing'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold
                  bg-blue-600 hover:bg-blue-500 text-white transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              >
                {crawlStatus === 'crawling' && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {crawlStatus === 'queuing' && (
                  <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
                  </svg>
                )}
                {crawlStatus === 'crawling' ? 'Rastreando URLs…' :
                 crawlStatus === 'queuing'  ? 'Encolando batch…' :
                 'Rastrear y Auditar'}
              </button>
            </div>

            {/* Feedback */}
            {crawlMsg && (
              <p className={`text-[11px] px-3 py-2 rounded-lg border
                ${crawlMsg.startsWith('✓')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                {crawlMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Rescan toast ── */}
      {rescanMsg && (
        <div className={`text-xs px-4 py-2.5 rounded-lg border font-medium
          ${rescanMsg.startsWith('✓')
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {rescanMsg}
        </div>
      )}

      {/* ── Stats rápidas ── */}
      {!loading && !error && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'URLs monitoreadas', value: stats.total, color: 'text-charcoal-200' },
            { label: 'Score promedio',    value: stats.avg,   color: scoreColor(stats.avg) },
            { label: 'En buen estado',    value: stats.ok,    color: 'text-emerald-400' },
            { label: 'Estado crítico',    value: stats.crit,  color: stats.crit > 0 ? 'text-red-400' : 'text-charcoal-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-charcoal-900/60 border border-charcoal-800/60 px-4 py-3">
              <p className="text-[10px] text-charcoal-500 uppercase tracking-widest mb-1">{label}</p>
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtros ── */}
      {!loading && !error && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal-500 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar por URL…"
              className="w-full pl-9 pr-3 py-2 text-xs bg-charcoal-800 border border-charcoal-700/60 rounded-lg
                text-charcoal-200 placeholder-charcoal-600
                focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </div>

          {/* Dispositivo */}
          <select value={device} onChange={e => setDevice(e.target.value as DeviceFilter)}
            className="px-3 py-2 text-xs bg-charcoal-800 border border-charcoal-700/60 rounded-lg
              text-charcoal-300 cursor-pointer focus:outline-none focus:border-blue-500/70 transition-colors">
            <option value="all">Todos los dispositivos</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>

          {/* Ordenar */}
          <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
            className="px-3 py-2 text-xs bg-charcoal-800 border border-charcoal-700/60 rounded-lg
              text-charcoal-300 cursor-pointer focus:outline-none focus:border-blue-500/70 transition-colors">
            <option value="score_asc">Score: peor primero</option>
            <option value="score_desc">Score: mejor primero</option>
            <option value="date_desc">Más reciente</option>
            <option value="url_asc">URL (A→Z)</option>
          </select>

          {/* Contador */}
          <div className="flex items-center px-3 py-2 rounded-lg bg-charcoal-800/40 border border-charcoal-700/30">
            <span className="text-xs text-charcoal-500 font-mono">
              <span className="text-charcoal-200 font-semibold">{filtered.length}</span>
              /{cards.length} sitios
            </span>
          </div>
        </div>
      )}

      {/* ── Loading: Skeleton grid ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="card flex items-center gap-3 py-6 border-red-500/20 bg-red-500/5">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
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

      {/* ── Vacío ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-20 gap-4">
          <svg className="w-12 h-12 text-charcoal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
          </svg>
          <p className="text-sm text-charcoal-500">
            {cards.length === 0
              ? 'No hay URLs monitoreadas aún. Lanza tu primer análisis desde Dashboard.'
              : 'Ninguna URL coincide con los filtros actuales.'}
          </p>
          {cards.length > 0 && (
            <button onClick={() => { setSearch(''); setDevice('all'); }}
              className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Grid de tarjetas ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(card => (
            <SiteCardComponent
              key={card.url}
              card={card}
              onRescan={handleRescan}
            />
          ))}
        </div>
      )}
    </main>
  );
}
